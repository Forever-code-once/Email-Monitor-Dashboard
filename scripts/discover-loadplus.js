/**
 * LoadPlus Database Discovery Script
 *
 * Connects to the Azure SQL (LoadPlus) database and lists all tables
 * with row counts, sizes, and column details.
 *
 * Usage: node scripts/discover-loadplus.js
 */

require('dotenv').config({ path: '.env.local' })
const sql = require('mssql')

const config = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true,
    requestTimeout: 120000,
    connectTimeout: 60000,
  },
}

async function discover() {
  console.log('='.repeat(70))
  console.log('LoadPlus Database Discovery')
  console.log(`Server: ${config.server}`)
  console.log(`Database: ${config.database}`)
  console.log('='.repeat(70))
  console.log('')

  let pool
  try {
    console.log('Connecting to Azure SQL...')
    pool = await sql.connect(config)
    console.log('Connected successfully!\n')

    // 1. Get all tables with row counts and sizes
    console.log('-'.repeat(70))
    console.log('ALL TABLES (sorted by row count descending)')
    console.log('-'.repeat(70))

    const tablesResult = await pool.request().query(`
      SELECT
        t.TABLE_SCHEMA as [schema],
        t.TABLE_NAME as [table_name],
        p.rows as [row_count],
        CAST(ROUND(SUM(a.total_pages) * 8.0 / 1024, 2) AS DECIMAL(18,2)) as [size_mb],
        CAST(ROUND(SUM(a.used_pages) * 8.0 / 1024, 2) AS DECIMAL(18,2)) as [used_mb]
      FROM INFORMATION_SCHEMA.TABLES t
      INNER JOIN sys.tables st ON st.name = t.TABLE_NAME
      INNER JOIN sys.indexes i ON st.object_id = i.object_id
      INNER JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
      INNER JOIN sys.allocation_units a ON p.partition_id = a.container_id
      WHERE t.TABLE_TYPE = 'BASE TABLE'
        AND i.index_id <= 1
      GROUP BY t.TABLE_SCHEMA, t.TABLE_NAME, p.rows
      ORDER BY p.rows DESC
    `)

    let totalRows = 0
    let totalSizeMb = 0

    console.log(
      'Schema'.padEnd(10) +
      'Table'.padEnd(40) +
      'Rows'.padStart(12) +
      'Size (MB)'.padStart(12) +
      'Used (MB)'.padStart(12)
    )
    console.log('-'.repeat(86))

    for (const row of tablesResult.recordset) {
      totalRows += row.row_count
      totalSizeMb += parseFloat(row.size_mb)
      console.log(
        row.schema.padEnd(10) +
        row.table_name.padEnd(40) +
        row.row_count.toString().padStart(12) +
        row.size_mb.toString().padStart(12) +
        row.used_mb.toString().padStart(12)
      )
    }

    console.log('-'.repeat(86))
    console.log(
      ''.padEnd(10) +
      `TOTAL (${tablesResult.recordset.length} tables)`.padEnd(40) +
      totalRows.toString().padStart(12) +
      totalSizeMb.toFixed(2).toString().padStart(12)
    )

    // 2. Identify potential junk/skip tables (large log tables, etc.)
    console.log('\n')
    console.log('-'.repeat(70))
    console.log('POTENTIAL TABLES TO SKIP (logs, errors, large audit tables)')
    console.log('-'.repeat(70))

    const skipCandidates = tablesResult.recordset.filter(row => {
      const name = row.table_name.toLowerCase()
      return name.includes('log') ||
        name.includes('error') ||
        name.includes('audit') ||
        name.includes('trace') ||
        name.includes('temp') ||
        name.includes('tmp') ||
        name.includes('history') ||
        name.includes('archive')
    })

    if (skipCandidates.length > 0) {
      for (const row of skipCandidates) {
        console.log(`  ${row.table_name.padEnd(40)} ${row.row_count.toString().padStart(12)} rows  ${row.size_mb.toString().padStart(8)} MB`)
      }
    } else {
      console.log('  (none detected by name pattern)')
    }

    // 3. List tables that look like customer/carrier tables
    console.log('\n')
    console.log('-'.repeat(70))
    console.log('LIKELY CUSTOMER/CARRIER TABLES')
    console.log('-'.repeat(70))

    const customerCandidates = tablesResult.recordset.filter(row => {
      const name = row.table_name.toLowerCase()
      return name.includes('customer') ||
        name.includes('carrier') ||
        name.includes('company') ||
        name.includes('client') ||
        name.includes('vendor') ||
        name.includes('contact') ||
        name.includes('driver')
    })

    if (customerCandidates.length > 0) {
      for (const row of customerCandidates) {
        console.log(`  ${row.table_name.padEnd(40)} ${row.row_count.toString().padStart(12)} rows  ${row.size_mb.toString().padStart(8)} MB`)
      }
    } else {
      console.log('  (none detected by name pattern — check full list above)')
    }

    // 4. Check for timestamp columns (useful for incremental sync)
    console.log('\n')
    console.log('-'.repeat(70))
    console.log('TABLES WITH TIMESTAMP/MODIFIED COLUMNS (good for incremental sync)')
    console.log('-'.repeat(70))

    const timestampResult = await pool.request().query(`
      SELECT
        TABLE_NAME,
        COLUMN_NAME,
        DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE (
        COLUMN_NAME LIKE '%modified%' OR
        COLUMN_NAME LIKE '%updated%' OR
        COLUMN_NAME LIKE '%changed%' OR
        COLUMN_NAME LIKE '%timestamp%' OR
        COLUMN_NAME LIKE '%last_%date%'
      )
      AND DATA_TYPE IN ('datetime', 'datetime2', 'timestamp', 'datetimeoffset', 'smalldatetime')
      ORDER BY TABLE_NAME
    `)

    if (timestampResult.recordset.length > 0) {
      for (const row of timestampResult.recordset) {
        console.log(`  ${row.TABLE_NAME.padEnd(40)} ${row.COLUMN_NAME.padEnd(30)} ${row.DATA_TYPE}`)
      }
    } else {
      console.log('  (none found — will use full-replace strategy for daily sync)')
    }

    // 5. Show column details for key tables (avalload, trkstops, loadtrk)
    console.log('\n')
    console.log('-'.repeat(70))
    console.log('COLUMN DETAILS FOR KEY TABLES')
    console.log('-'.repeat(70))

    const keyTables = ['avalload', 'trkstops', 'loadtrk']
    // Also add customer/carrier candidates
    for (const candidate of customerCandidates) {
      if (!keyTables.includes(candidate.table_name.toLowerCase())) {
        keyTables.push(candidate.table_name)
      }
    }

    for (const tableName of keyTables) {
      const colResult = await pool.request()
        .input('tableName', sql.NVarChar, tableName)
        .query(`
          SELECT
            COLUMN_NAME,
            DATA_TYPE,
            CHARACTER_MAXIMUM_LENGTH,
            IS_NULLABLE,
            COLUMN_DEFAULT
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = @tableName
          ORDER BY ORDINAL_POSITION
        `)

      if (colResult.recordset.length > 0) {
        console.log(`\n  TABLE: ${tableName} (${colResult.recordset.length} columns)`)
        console.log('  ' + '-'.repeat(66))
        for (const col of colResult.recordset) {
          const typeStr = col.CHARACTER_MAXIMUM_LENGTH
            ? `${col.DATA_TYPE}(${col.CHARACTER_MAXIMUM_LENGTH})`
            : col.DATA_TYPE
          console.log(
            `    ${col.COLUMN_NAME.padEnd(35)} ${typeStr.padEnd(20)} ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}`
          )
        }
      }
    }

    // 6. List all views
    console.log('\n')
    console.log('-'.repeat(70))
    console.log('VIEWS')
    console.log('-'.repeat(70))

    const viewsResult = await pool.request().query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS ORDER BY TABLE_NAME
    `)

    if (viewsResult.recordset.length > 0) {
      for (const row of viewsResult.recordset) {
        console.log(`  ${row.TABLE_NAME}`)
      }
    } else {
      console.log('  (none)')
    }

    console.log('\n' + '='.repeat(70))
    console.log('Discovery complete!')
    console.log('='.repeat(70))

  } catch (error) {
    console.error('\nERROR:', error.message)
    if (error.code === 'ELOGIN') {
      console.error('  → Check AZURE_SQL_USER and AZURE_SQL_PASSWORD in .env.local')
    } else if (error.code === 'ETIMEOUT') {
      console.error('  → Check AZURE_SQL_SERVER and firewall rules')
    } else if (error.code === 'ENOTFOUND') {
      console.error('  → Server not found. Check AZURE_SQL_SERVER in .env.local')
    }
  } finally {
    if (pool) await pool.close()
  }
}

discover()
