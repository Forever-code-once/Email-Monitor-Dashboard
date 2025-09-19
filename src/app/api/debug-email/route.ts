import { NextRequest, NextResponse } from 'next/server'
import { getAwsConnection } from '@/lib/awsDatabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const emailId = searchParams.get('emailId')
    
    if (!emailId) {
      return NextResponse.json({ error: 'emailId parameter required' }, { status: 400 })
    }

    // Get email content from database
    const connection = await getAwsConnection()
    
    try {
      const [rows] = await connection.execute(`
        SELECT email_id, subject, from_email, body, received_date_time
        FROM emails 
        WHERE email_id = ?
      `, [emailId])
      
      const email = (rows as any[])[0]
      
      if (!email) {
        return NextResponse.json({ error: 'Email not found' }, { status: 404 })
      }

      return NextResponse.json({
        emailId: email.email_id,
        subject: email.subject,
        fromEmail: email.from_email,
        body: email.body,
        receivedDateTime: email.received_date_time
      })
    } finally {
      await connection.end()
    }
    
  } catch (error) {
    console.error('❌ Error fetching email:', error)
    return NextResponse.json(
      { error: 'Failed to fetch email', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}