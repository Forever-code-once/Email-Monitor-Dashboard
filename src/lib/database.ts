import sql from 'mssql'

// Azure SQL Database configuration
const dbConfig: sql.config = {
  server: process.env.AZURE_SQL_SERVER || 'your-server.database.windows.net',
  database: process.env.AZURE_SQL_DATABASE || 'your-database-name',
  user: process.env.AZURE_SQL_USER || 'your-username',
  password: process.env.AZURE_SQL_PASSWORD || 'your-password',
  options: {
    encrypt: true, // Required for Azure SQL Database
    trustServerCertificate: true, // Required for Azure SQL Database
    enableArithAbort: true,
    requestTimeout: 30000, // 30 seconds
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
}

// Global connection pool
let pool: sql.ConnectionPool | null = null

/**
 * Get or create a database connection pool
 */
export async function getConnection(): Promise<sql.ConnectionPool> {
  if (!pool) {
    try {
      pool = await sql.connect(dbConfig)
    } catch (error) {
      console.error('❌ Failed to create database connection pool:', error)
      throw error
    }
  }
  return pool
}

/**
 * Execute a query and return results
 */
export async function executeQuery<T = any>(
  query: string, 
  params?: { name: string; type: any; value: any }[]
): Promise<T[]> {
  const connection = await getConnection()
  
  try {
    const request = connection.request()
    
    // Add parameters if provided
    if (params) {
      params.forEach(param => {
        request.input(param.name, param.type, param.value)
      })
    }
    
    const result = await request.query(query)
    return result.recordset
  } catch (error) {
    console.error('❌ Database query error:', error)
    throw error
  }
}

/**
 * Execute a stored procedure
 */
export async function executeStoredProcedure<T = any>(
  procedureName: string,
  params?: { name: string; type: any; value: any }[]
): Promise<T[]> {
  const connection = await getConnection()
  
  try {
    const request = connection.request()
    
    // Add parameters if provided
    if (params) {
      params.forEach(param => {
        request.input(param.name, param.type, param.value)
      })
    }
    
    const result = await request.execute(procedureName)
    return result.recordset
  } catch (error) {
    console.error('❌ Stored procedure error:', error)
    throw error
  }
}

/**
 * Close the database connection pool
 */
export async function closeConnection(): Promise<void> {
  if (pool) {
    try {
      await pool.close()
      pool = null
    } catch (error) {
      console.error('❌ Error closing database connection:', error)
    }
  }
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const connection = await getConnection()
    const result = await connection.request().query('SELECT 1 as test')
    return true
  } catch (error) {
    console.error('❌ Database connection test failed:', error)
    return false
  }
}

// Example functions for your email monitoring system
export const databaseQueries = {
  // Save truck availability data
  async saveTruckAvailability(truckData: {
    customer: string
    customerEmail: string
    date: string
    city: string
    state: string
    additionalInfo?: string
    emailId: string
    emailSubject: string
    emailDate: Date
  }) {
    const query = `
      INSERT INTO TruckAvailability 
      (Customer, CustomerEmail, Date, City, State, AdditionalInfo, EmailId, EmailSubject, EmailDate, CreatedAt)
      VALUES (@customer, @customerEmail, @date, @city, @state, @additionalInfo, @emailId, @emailSubject, @emailDate, GETDATE())
    `
    
    const params = [
      { name: 'customer', type: sql.NVarChar, value: truckData.customer },
      { name: 'customerEmail', type: sql.NVarChar, value: truckData.customerEmail },
      { name: 'date', type: sql.NVarChar, value: truckData.date },
      { name: 'city', type: sql.NVarChar, value: truckData.city },
      { name: 'state', type: sql.NVarChar, value: truckData.state },
      { name: 'additionalInfo', type: sql.NVarChar, value: truckData.additionalInfo || null },
      { name: 'emailId', type: sql.NVarChar, value: truckData.emailId },
      { name: 'emailSubject', type: sql.NVarChar, value: truckData.emailSubject },
      { name: 'emailDate', type: sql.DateTime, value: truckData.emailDate },
    ]
    
    return executeQuery(query, params)
  },

  // Get truck availability by customer
  async getTruckAvailabilityByCustomer(customerEmail: string) {
    const query = `
      SELECT * FROM TruckAvailability 
      WHERE CustomerEmail = @customerEmail 
      ORDER BY EmailDate DESC
    `
    
    const params = [
      { name: 'customerEmail', type: sql.NVarChar, value: customerEmail }
    ]
    
    return executeQuery(query, params)
  },

  // Get all truck availability
  async getAllTruckAvailability() {
    const query = `
      SELECT * FROM TruckAvailability 
      ORDER BY EmailDate DESC
    `
    
    return executeQuery(query)
  },

  // Delete truck availability
  async deleteTruckAvailability(id: string) {
    const query = `
      DELETE FROM TruckAvailability 
      WHERE Id = @id
    `
    
    const params = [
      { name: 'id', type: sql.NVarChar, value: id }
    ]
    
    return executeQuery(query, params)
  },

  // Save email data
  async saveEmail(emailData: {
    emailId: string
    subject: string
    fromEmail: string
    fromName: string
    body: string
    receivedDateTime: Date
    isForwarded: boolean
    originalSender?: string
  }) {
    const query = `
      INSERT INTO Emails 
      (EmailId, Subject, FromEmail, FromName, Body, ReceivedDateTime, IsForwarded, OriginalSender, CreatedAt)
      VALUES (@emailId, @subject, @fromEmail, @fromName, @body, @receivedDateTime, @isForwarded, @originalSender, GETDATE())
    `
    
    const params = [
      { name: 'emailId', type: sql.NVarChar, value: emailData.emailId },
      { name: 'subject', type: sql.NVarChar, value: emailData.subject },
      { name: 'fromEmail', type: sql.NVarChar, value: emailData.fromEmail },
      { name: 'fromName', type: sql.NVarChar, value: emailData.fromName },
      { name: 'body', type: sql.NText, value: emailData.body },
      { name: 'receivedDateTime', type: sql.DateTime, value: emailData.receivedDateTime },
      { name: 'isForwarded', type: sql.Bit, value: emailData.isForwarded },
      { name: 'originalSender', type: sql.NVarChar, value: emailData.originalSender || null },
    ]
    
    return executeQuery(query, params)
  },

  // Save or update customer data
  async saveCustomer(customerData: {
    customerName: string
    customerEmail: string
    firstSeen: string
    lastSeen: string
  }) {
    // First check if customer exists
    const checkQuery = `
      SELECT Id FROM Customers WHERE CustomerEmail = @customerEmail
    `
    
    const checkParams = [
      { name: 'customerEmail', type: sql.NVarChar, value: customerData.customerEmail }
    ]
    
    const existing = await executeQuery(checkQuery, checkParams)
    
    if (existing.length > 0) {
      // Update existing customer
      const updateQuery = `
        UPDATE Customers 
        SET CustomerName = @customerName, LastSeen = GETDATE(), UpdatedAt = GETDATE()
        WHERE CustomerEmail = @customerEmail
      `
      
      const updateParams = [
        { name: 'customerName', type: sql.NVarChar, value: customerData.customerName },
        { name: 'customerEmail', type: sql.NVarChar, value: customerData.customerEmail }
      ]
      
      return executeQuery(updateQuery, updateParams)
    } else {
      // Insert new customer
      const insertQuery = `
        INSERT INTO Customers 
        (CustomerName, CustomerEmail, FirstSeen, LastSeen, CreatedAt)
        VALUES (@customerName, @customerEmail, GETDATE(), GETDATE(), GETDATE())
      `
      
      const insertParams = [
        { name: 'customerName', type: sql.NVarChar, value: customerData.customerName },
        { name: 'customerEmail', type: sql.NVarChar, value: customerData.customerEmail }
      ]
      
      return executeQuery(insertQuery, insertParams)
    }
  },

  // Get available loads from database (based on your PHP query)
  async getAvailableLoads() {
    const query = `
      SELECT 
        avalload.*,
        avalload.actual_name as company_name,
        avalload.depart_date as use_depart_date,
        stop1.pu_drop_date1,
        stop1.pu_drop_time1,
        stoplast.pu_drop_date1 as dropoff_date,
        stoplast.pu_drop_time1 as dropoff_time,
        avalload.dispatcher_id as dispatcher_initials,
        (STUFF((SELECT ' ' + cast([int_notes] as varchar(8000))
          FROM loadtrk ltrk
          WHERE (ltrk.ref_number = avalload.ref_number
          and cast([int_notes] as varchar(8000)) <> ''
        ) 
        FOR XML PATH ('')), 1, 2, '')) AS notes
      FROM avalload
        LEFT JOIN trkstops stop1 ON stop1.ref_number = avalload.ref_number AND stop1.sequence_num = 1
        LEFT JOIN trkstops stoplast ON stoplast.ref_number = avalload.ref_number 
          AND stoplast.recnum = (SELECT MAX(recnum) FROM trkstops WHERE trkstops.ref_number = avalload.ref_number)
      WHERE load_status = 'A' 
        AND avalload.ACTUAL_NAME IS NOT NULL 
        AND avalload.ACTUAL_NAME != ''
        AND avalload.ref_number IS NOT NULL
      ORDER BY depart_date, stop1.pu_drop_date1, stop1.pu_drop_time1
    `
    
    return executeQuery(query)
  },

  // Get loads by company
  async getLoadsByCompany(companyName: string) {
    const query = `
      SELECT 
        avalload.*,
        avalload.actual_name as company_name,
        avalload.depart_date as use_depart_date,
        stop1.pu_drop_date1,
        stop1.pu_drop_time1,
        stoplast.pu_drop_date1 as dropoff_date,
        stoplast.pu_drop_time1 as dropoff_time,
        avalload.dispatcher_id as dispatcher_initials,
        (STUFF((SELECT ' ' + cast([int_notes] as varchar(8000))
          FROM loadtrk ltrk
          WHERE (ltrk.ref_number = avalload.ref_number
          and cast([int_notes] as varchar(8000)) <> ''
        ) 
        FOR XML PATH ('')), 1, 2, '')) AS notes
      FROM avalload
        LEFT JOIN trkstops stop1 ON stop1.ref_number = avalload.ref_number AND stop1.sequence_num = 1
        LEFT JOIN trkstops stoplast ON stoplast.ref_number = avalload.ref_number 
          AND stoplast.recnum = (SELECT MAX(recnum) FROM trkstops WHERE trkstops.ref_number = avalload.ref_number)
      WHERE load_status = 'A' 
        AND avalload.ACTUAL_NAME LIKE @companyName
        AND avalload.ACTUAL_NAME IS NOT NULL 
        AND avalload.ACTUAL_NAME != ''
        AND avalload.ref_number IS NOT NULL
      ORDER BY depart_date, stop1.pu_drop_date1, stop1.pu_drop_time1
    `
    
    const params = [
      { name: 'companyName', type: sql.NVarChar, value: `%${companyName}%` }
    ]
    
    return executeQuery(query, params)
  }
} 