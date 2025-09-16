import mysql from 'mysql2/promise'

// AWS RDS MySQL configuration for truck data
const awsConfig = {
  host: process.env.AWS_RDS_HOST || 'your-aws-rds-endpoint.amazonaws.com',
  user: process.env.AWS_RDS_USER || 'admin',
  password: process.env.AWS_RDS_PASSWORD || 'your-password',
  database: process.env.AWS_RDS_DATABASE || 'email_monitor',
  port: parseInt(process.env.AWS_RDS_PORT || '3306'),
  ssl: {
    rejectUnauthorized: false // AWS RDS requires SSL
  },
  connectionLimit: 10,
  acquireTimeout: 60000,
  timeout: 60000,
}

/**
 * Get AWS RDS MySQL connection
 */
export async function getAwsConnection(): Promise<mysql.Connection> {
  try {
    const connection = await mysql.createConnection(awsConfig)
    return connection
  } catch (error) {
    console.error('❌ Failed to create AWS RDS connection:', error)
    throw error
  }
}

/**
 * Test AWS RDS connection
 */
export async function testAwsConnection(): Promise<boolean> {
  try {
    const connection = await getAwsConnection()
    await connection.ping()
    await connection.end()
    console.log('✅ AWS RDS connection successful')
    return true
  } catch (error) {
    console.error('❌ AWS RDS connection failed:', error)
    return false
  }
}

/**
 * AWS RDS Database queries for truck data
 */
export const awsDatabaseQueries = {
  // Get all truck availability from AWS RDS
  async getAllTruckAvailability() {
    const connection = await getAwsConnection()
    
    try {
      const [rows] = await connection.execute(`
        SELECT * FROM truck_availability 
        WHERE is_deleted = 0 OR is_deleted IS NULL
        ORDER BY created_at DESC
      `)
      return rows as any[]
    } finally {
      await connection.end()
    }
  },

  // Save truck availability to AWS RDS
  async saveTruckAvailability(truckData: {
    customer: string
    customerEmail: string
    date: string
    city: string
    state: string
    additionalInfo: string
    emailId: string
    emailSubject: string
    emailDate: string
  }) {
    const connection = await getAwsConnection()
    
    try {
      const [result] = await connection.execute(`
        INSERT INTO truck_availability 
        (customer, customer_email, date, city, state, additional_info, email_id, email_subject, email_date, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
        truckData.customer,
        truckData.customerEmail,
        truckData.date,
        truckData.city,
        truckData.state,
        truckData.additionalInfo,
        truckData.emailId,
        truckData.emailSubject,
        truckData.emailDate
      ])
      return result
    } finally {
      await connection.end()
    }
  },

  // Get truck availability by customer
  async getTruckAvailabilityByCustomer(customerEmail: string) {
    const connection = await getAwsConnection()
    
    try {
      const [rows] = await connection.execute(`
        SELECT * FROM truck_availability 
        WHERE customer_email = ? AND (is_deleted = 0 OR is_deleted IS NULL)
        ORDER BY created_at DESC
      `, [customerEmail])
      return rows as any[]
    } finally {
      await connection.end()
    }
  },

  // Get truck availability by date
  async getTruckAvailabilityByDate(date: string) {
    const connection = await getAwsConnection()
    
    try {
      const [rows] = await connection.execute(`
        SELECT * FROM truck_availability 
        WHERE date = ? AND (is_deleted = 0 OR is_deleted IS NULL)
        ORDER BY created_at DESC
      `, [date])
      return rows as any[]
    } finally {
      await connection.end()
    }
  },

  // Delete truck availability (soft delete)
  async deleteTruckAvailability(id: string) {
    const connection = await getAwsConnection()
    
    try {
      const [result] = await connection.execute(`
        UPDATE truck_availability 
        SET is_deleted = 1, deleted_date = NOW() 
        WHERE id = ?
      `, [id])
      return result
    } finally {
      await connection.end()
    }
  },

  // Restore truck availability
  async restoreTruckAvailability(id: string) {
    const connection = await getAwsConnection()
    
    try {
      const [result] = await connection.execute(`
        UPDATE truck_availability 
        SET is_deleted = 0, deleted_date = NULL 
        WHERE id = ?
      `, [id])
      return result
    } finally {
      await connection.end()
    }
  },

  // Save email record to AWS RDS (for truck-related emails)
  async saveEmail(emailData: {
    emailId: string
    subject: string
    fromEmail: string
    fromName: string
    body: string
    receivedDateTime: string
    isForwarded: boolean
    originalSender?: string
  }) {
    const connection = await getAwsConnection()
    
    try {
      const [result] = await connection.execute(`
        INSERT INTO emails 
        (email_id, subject, from_email, from_name, body, received_date_time, is_forwarded, original_sender, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
        subject = VALUES(subject),
        from_name = VALUES(from_name),
        body = VALUES(body)
      `, [
        emailData.emailId,
        emailData.subject,
        emailData.fromEmail,
        emailData.fromName,
        emailData.body,
        emailData.receivedDateTime,
        emailData.isForwarded ? 1 : 0,
        emailData.originalSender || null
      ])
      return result
    } finally {
      await connection.end()
    }
  },

  // Save customer record to AWS RDS
  async saveCustomer(customerData: {
    customerName: string
    customerEmail: string
    firstSeen: string
    lastSeen: string
  }) {
    const connection = await getAwsConnection()
    
    try {
      const [result] = await connection.execute(`
        INSERT INTO customers 
        (customer_name, customer_email, first_seen, last_seen, created_at)
        VALUES (?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
        customer_name = VALUES(customer_name),
        last_seen = VALUES(last_seen),
        updated_at = NOW()
      `, [
        customerData.customerName,
        customerData.customerEmail,
        customerData.firstSeen,
        customerData.lastSeen
      ])
      return result
    } finally {
      await connection.end()
    }
  }
}