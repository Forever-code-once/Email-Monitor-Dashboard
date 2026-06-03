/**
 * LoadPlus → MySQL Replica Sync Script
 *
 * Replicates the Azure SQL (LoadPlus / VLPCONARD) database into a MySQL
 * database (loadplus_replica) on the AWS RDS server.
 *
 * Strategy: Daily full replace per table (truncate + bulk insert).
 * Skips: log/temp tables and empty tables.
 *
 * Usage:
 *   node scripts/sync-loadplus.js              # full sync
 *   node scripts/sync-loadplus.js --table=CARRIER  # single table
 *   node scripts/sync-loadplus.js --dry-run    # show plan, don't write
 */

require('dotenv').config({ path: '.env.local' })
const sql = require('mssql')
const mysql = require('mysql2/promise')
const fs = require('fs')
const path = require('path')

// =========================================================================
// Configuration
// =========================================================================

const REPLICA_DB_NAME = process.env.LOADPLUS_REPLICA_DB || 'loadplus_replica'

const SKIP_TABLES = new Set([
  // log/temp tables
  'CRUDLOG', 'PROGLOG', 'GRIDLOG', 'WEBERROR', 'DOT_TEMP',
  'LOGIN', 'PRTEMPGL', 'TEMP_LINK',
  // app's own tables that already live elsewhere — don't pollute the replica
  'truck_availability', 'deleted_trucks',
])

const BATCH_SIZE = 500  // rows per insert batch

const args = process.argv.slice(2)
const SINGLE_TABLE = args.find(a => a.startsWith('--table='))?.split('=')[1]
const DRY_RUN = args.includes('--dry-run')

const sourceConfig = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true,
    requestTimeout: 600000,  // 10 min for large tables
    connectTimeout: 60000,
  },
  pool: { max: 1, min: 0 },
}

const targetConfig = {
  host: process.env.AWS_RDS_HOST,
  user: process.env.AWS_RDS_USER,
  password: process.env.AWS_RDS_PASSWORD,
  port: parseInt(process.env.AWS_RDS_PORT || '3306'),
  multipleStatements: true,
  ...(process.env.AWS_RDS_SSL_ENABLED === 'true' && {
    ssl: { rejectUnauthorized: false },
  }),
}

// =========================================================================
// Logging
// =========================================================================

const LOG_DIR = path.join(__dirname, '..', 'logs')
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })
const LOG_FILE = path.join(LOG_DIR, `sync-loadplus-${new Date().toISOString().slice(0, 10)}.log`)
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' })

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`
  console.log(line)
  logStream.write(line + '\n')
}

// =========================================================================
// MSSQL → MySQL type mapping
// =========================================================================

function mapType(col) {
  const t = col.DATA_TYPE.toLowerCase()
  const len = col.CHARACTER_MAXIMUM_LENGTH
  const precision = col.NUMERIC_PRECISION
  const scale = col.NUMERIC_SCALE

  switch (t) {
    case 'int': return 'INT'
    case 'smallint': return 'SMALLINT'
    case 'tinyint': return 'TINYINT UNSIGNED'
    case 'bigint': return 'BIGINT'
    case 'bit': return 'TINYINT(1)'
    case 'float': return 'DOUBLE'
    case 'real': return 'FLOAT'
    case 'money': return 'DECIMAL(19,4)'
    case 'smallmoney': return 'DECIMAL(10,4)'
    case 'numeric':
    case 'decimal': {
      const p = precision && precision > 0 ? Math.min(precision, 65) : 18
      const s = scale != null ? Math.min(scale, p) : 0
      return `DECIMAL(${p},${s})`
    }
    case 'char':
    case 'nchar':
      return len && len > 0 && len <= 255 ? `CHAR(${len})` : 'TEXT'
    case 'varchar':
    case 'nvarchar':
      if (len === -1 || !len) return 'LONGTEXT'
      if (len <= 255) return `VARCHAR(${len})`
      if (len <= 65535) return `VARCHAR(${len})`
      return 'LONGTEXT'
    case 'text':
    case 'ntext':
    case 'xml':
      return 'LONGTEXT'
    case 'date': return 'DATE'
    case 'datetime':
    case 'smalldatetime':
      return 'DATETIME NULL'
    case 'datetime2':
    case 'datetimeoffset':
      return 'DATETIME(6) NULL'
    case 'time': return 'TIME'
    case 'timestamp':
    case 'rowversion':
      return 'BINARY(8)'
    case 'uniqueidentifier': return 'CHAR(36)'
    case 'binary':
    case 'varbinary':
      return len === -1 || !len || len > 65535 ? 'LONGBLOB' : `VARBINARY(${len})`
    case 'image': return 'LONGBLOB'
    default:
      log(`  WARN: unknown type "${t}", falling back to LONGTEXT`)
      return 'LONGTEXT'
  }
}

// MSSQL datetime min is 1753-01-01; MySQL DATETIME min is 1000-01-01.
// But many LoadPlus rows use 1900-01-01 placeholder which is fine.
// MSSQL also has 0001-01-01 in datetime2 columns - need to handle.
function sanitizeValue(val, dataType) {
  if (val === null || val === undefined) return null
  const t = (dataType || '').toLowerCase()

  if (t.includes('date') || t === 'datetime' || t === 'smalldatetime' || t === 'datetime2' || t === 'datetimeoffset') {
    if (val instanceof Date) {
      const year = val.getUTCFullYear()
      if (year < 1000 || year > 9999) return null
      return val
    }
    return val
  }
  if (t === 'uniqueidentifier' && typeof val === 'string') {
    return val.toLowerCase()
  }
  if (Buffer.isBuffer(val)) return val
  if (typeof val === 'string') {
    // strip null bytes (MySQL chokes on them in some configs)
    return val.replace(/\0/g, '')
  }
  return val
}

// =========================================================================
// Sync logic
// =========================================================================

async function ensureReplicaDatabase(rootConn) {
  await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${REPLICA_DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
  log(`Replica database \`${REPLICA_DB_NAME}\` ready`)
}

async function getTablesToSync(sourcePool) {
  const result = await sourcePool.request().query(`
    SELECT
      t.TABLE_NAME as table_name,
      p.rows as row_count
    FROM INFORMATION_SCHEMA.TABLES t
    INNER JOIN sys.tables st ON st.name = t.TABLE_NAME
    INNER JOIN sys.partitions p ON st.object_id = p.object_id
    WHERE t.TABLE_TYPE = 'BASE TABLE'
      AND p.index_id <= 1
    GROUP BY t.TABLE_NAME, p.rows
    ORDER BY p.rows DESC
  `)

  return result.recordset.filter(r => {
    if (SKIP_TABLES.has(r.table_name)) return false
    if (SINGLE_TABLE && r.table_name.toLowerCase() !== SINGLE_TABLE.toLowerCase()) return false
    if (!SINGLE_TABLE && r.row_count === 0) return false
    return true
  })
}

async function getTableColumns(sourcePool, tableName) {
  const result = await sourcePool.request()
    .input('tableName', sql.NVarChar, tableName)
    .query(`
      SELECT
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        NUMERIC_PRECISION,
        NUMERIC_SCALE,
        IS_NULLABLE,
        ORDINAL_POSITION
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = @tableName
      ORDER BY ORDINAL_POSITION
    `)
  return result.recordset
}

async function recreateTargetTable(targetConn, tableName, columns) {
  const tableNameLower = tableName.toLowerCase()
  const colDefs = columns.map(c => {
    const colName = c.COLUMN_NAME
    const colType = mapType(c)
    // Always allow NULL on the replica — source data can have weird date placeholders
    return `  \`${colName}\` ${colType.replace(/ NOT NULL$/i, '')} NULL`
  }).join(',\n')

  await targetConn.query(`DROP TABLE IF EXISTS \`${tableNameLower}\``)
  const createSql = `CREATE TABLE \`${tableNameLower}\` (\n${colDefs}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  try {
    await targetConn.query(createSql)
  } catch (err) {
    log(`  ERROR creating table:\n${createSql}`)
    throw err
  }
}

async function copyTableData(sourcePool, targetConn, tableName, columns) {
  const tableNameLower = tableName.toLowerCase()
  const colNames = columns.map(c => c.COLUMN_NAME)
  const colTypes = columns.map(c => c.DATA_TYPE)
  const escapedColList = colNames.map(n => `\`${n}\``).join(', ')

  // Use streaming for large tables — sourcePool.request().query streams rows.
  const request = sourcePool.request()
  request.stream = true
  request.query(`SELECT * FROM [${tableName}]`)

  let buffer = []
  let totalRows = 0
  let inserted = 0

  const flush = async () => {
    if (buffer.length === 0) return
    const placeholders = buffer.map(() => `(${colNames.map(() => '?').join(',')})`).join(',')
    const flatValues = []
    for (const row of buffer) {
      for (let i = 0; i < colNames.length; i++) {
        flatValues.push(sanitizeValue(row[colNames[i]], colTypes[i]))
      }
    }
    const insertSql = `INSERT INTO \`${tableNameLower}\` (${escapedColList}) VALUES ${placeholders}`
    try {
      await targetConn.query(insertSql, flatValues)
      inserted += buffer.length
    } catch (err) {
      log(`  ERROR inserting batch (${buffer.length} rows): ${err.message}`)
      // Try one-by-one to skip bad rows
      for (const row of buffer) {
        try {
          const oneVals = colNames.map((n, i) => sanitizeValue(row[n], colTypes[i]))
          const onePlace = `(${colNames.map(() => '?').join(',')})`
          await targetConn.query(`INSERT INTO \`${tableNameLower}\` (${escapedColList}) VALUES ${onePlace}`, oneVals)
          inserted++
        } catch (rowErr) {
          // skip
        }
      }
    }
    buffer = []
  }

  return new Promise((resolve, reject) => {
    request.on('row', (row) => {
      buffer.push(row)
      totalRows++
      if (buffer.length >= BATCH_SIZE) {
        request.pause()
        flush().then(() => request.resume()).catch(reject)
      }
    })
    request.on('error', reject)
    request.on('done', async () => {
      try {
        await flush()
        resolve({ totalRows, inserted })
      } catch (err) {
        reject(err)
      }
    })
  })
}

async function syncTable(sourcePool, targetConn, tableInfo) {
  const { table_name: tableName, row_count: rowCount } = tableInfo
  log(`\n→ ${tableName} (~${rowCount} rows)`)

  if (DRY_RUN) {
    log(`  [DRY RUN] would sync ${rowCount} rows`)
    return { tableName, status: 'dry-run', rows: rowCount }
  }

  const startedAt = Date.now()
  try {
    const columns = await getTableColumns(sourcePool, tableName)
    if (columns.length === 0) {
      log(`  SKIP: no columns found`)
      return { tableName, status: 'skipped', rows: 0 }
    }

    await recreateTargetTable(targetConn, tableName, columns)
    log(`  Schema recreated (${columns.length} columns)`)

    const { totalRows, inserted } = await copyTableData(sourcePool, targetConn, tableName, columns)
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
    log(`  ✓ Inserted ${inserted}/${totalRows} rows in ${elapsed}s`)
    return { tableName, status: 'success', rows: inserted, elapsed: parseFloat(elapsed) }
  } catch (err) {
    log(`  ✗ FAILED: ${err.message}`)
    return { tableName, status: 'failed', error: err.message }
  }
}

// =========================================================================
// Main
// =========================================================================

async function main() {
  const startedAt = Date.now()
  log('='.repeat(70))
  log('LoadPlus → MySQL Replica Sync')
  log(`Source: ${sourceConfig.server} / ${sourceConfig.database}`)
  log(`Target: ${targetConfig.host} / ${REPLICA_DB_NAME}`)
  if (SINGLE_TABLE) log(`Single table mode: ${SINGLE_TABLE}`)
  if (DRY_RUN) log('DRY RUN MODE — no writes')
  log('='.repeat(70))

  let sourcePool, targetConn
  try {
    log('Connecting to source (Azure SQL)...')
    sourcePool = await sql.connect(sourceConfig)

    log('Connecting to target (MySQL)...')
    const rootConn = await mysql.createConnection(targetConfig)
    if (!DRY_RUN) await ensureReplicaDatabase(rootConn)
    await rootConn.end()

    targetConn = await mysql.createConnection({ ...targetConfig, database: REPLICA_DB_NAME })
    await targetConn.query('SET FOREIGN_KEY_CHECKS=0')
    await targetConn.query('SET UNIQUE_CHECKS=0')
    await targetConn.query("SET sql_mode='NO_ENGINE_SUBSTITUTION'")

    log('Discovering tables...')
    const tables = await getTablesToSync(sourcePool)
    log(`Found ${tables.length} tables to sync\n`)

    const results = []
    for (const tableInfo of tables) {
      const result = await syncTable(sourcePool, targetConn, tableInfo)
      results.push(result)
    }

    // Summary
    const success = results.filter(r => r.status === 'success')
    const failed = results.filter(r => r.status === 'failed')
    const totalRows = success.reduce((sum, r) => sum + r.rows, 0)
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)

    log('\n' + '='.repeat(70))
    log('SYNC SUMMARY')
    log('='.repeat(70))
    log(`Total tables: ${results.length}`)
    log(`Success: ${success.length}`)
    log(`Failed: ${failed.length}`)
    log(`Total rows synced: ${totalRows}`)
    log(`Total elapsed: ${elapsed}s`)
    if (failed.length > 0) {
      log('\nFailed tables:')
      failed.forEach(f => log(`  - ${f.tableName}: ${f.error}`))
    }
    log('='.repeat(70))

    process.exitCode = failed.length > 0 ? 1 : 0
  } catch (err) {
    log(`\nFATAL ERROR: ${err.message}`)
    log(err.stack)
    process.exitCode = 2
  } finally {
    if (sourcePool) await sourcePool.close().catch(() => {})
    if (targetConn) await targetConn.end().catch(() => {})
    logStream.end()
  }
}

main()
