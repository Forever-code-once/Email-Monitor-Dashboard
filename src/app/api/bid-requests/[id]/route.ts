import { NextRequest, NextResponse } from 'next/server'
import mysql from 'mysql2/promise'
import { notifyWebSocketClients } from '@/lib/websocket'

// Database configuration
const dbConfig = {
  host: process.env.AWS_RDS_HOST,
  user: process.env.AWS_RDS_USER,
  password: process.env.AWS_RDS_PASSWORD,
  database: process.env.AWS_RDS_DATABASE,
  ssl: { rejectUnauthorized: false }
}

// Create database connection pool
const pool = mysql.createPool(dbConfig)

// DELETE - Delete bid request by ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    
    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Bid request ID is required'
      }, { status: 400 })
    }
    
    const connection = await pool.getConnection()
    
    try {
      // Check if bid request exists
      const [rows] = await connection.execute(`
        SELECT id FROM bid_requests WHERE id = ?
      `, [id])
      
      if ((rows as any[]).length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Bid request not found'
        }, { status: 404 })
      }
      
      // Delete the bid request
      await connection.execute(`
        DELETE FROM bid_requests WHERE id = ?
      `, [id])
      
      // Notify WebSocket clients about bid request deletion
      try {
        await notifyWebSocketClients('BID_REQUEST_DELETED', {
          id: parseInt(id),
          deletedAt: new Date().toISOString()
        })
      } catch (error) {
        console.error('❌ Delete API: Failed to send WebSocket notification', error)
      }
      
      return NextResponse.json({
        success: true,
        message: 'Bid request deleted successfully'
      })
    } finally {
      connection.release()
    }
  } catch (error) {
    console.error('Error deleting bid request:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to delete bid request'
    }, { status: 500 })
  }
}

// PUT - Update bid request (for future use)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    
    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Bid request ID is required'
      }, { status: 400 })
    }
    
    // For now, just return not implemented
    return NextResponse.json({
      success: false,
      error: 'Update functionality not implemented yet'
    }, { status: 501 })
  } catch (error) {
    console.error('Error updating bid request:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to update bid request'
    }, { status: 500 })
  }
}