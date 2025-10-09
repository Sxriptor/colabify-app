import nodemailer from 'nodemailer'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { testEmail } = body

    if (!testEmail) {
      return NextResponse.json({ error: 'Test email is required' }, { status: 400 })
    }

    // Test SMTP configuration
    console.log('Testing SMTP with config:')
    console.log('Host:', process.env.SMTP_HOST)
    console.log('Port:', process.env.SMTP_PORT)
    console.log('Secure:', process.env.SMTP_SECURE)
    console.log('Auth User:', process.env.SMTP_HOST_USER)
    console.log('From User:', process.env.SMTP_INVITE_USER)
    console.log('Pass length:', process.env.SMTP_PASS?.length)

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_HOST_USER, // Use the main account for authentication
        pass: process.env.SMTP_PASS,
      },
      debug: true, // Enable debug output
      logger: true, // Log to console
    })

    // Verify connection
    console.log('Verifying SMTP connection...')
    await transporter.verify()
    console.log('SMTP connection verified successfully')

    // Send test email
    const result = await transporter.sendMail({
      from: `Colabify Test <${process.env.SMTP_INVITE_USER}>`,
      to: testEmail,
      subject: 'SMTP Test Email',
      text: 'This is a test email to verify SMTP configuration.',
      html: '<p>This is a test email to verify SMTP configuration.</p>',
    })

    console.log('Test email sent:', result.messageId)

    return NextResponse.json({ 
      success: true,
      messageId: result.messageId,
      message: 'SMTP test successful'
    })

  } catch (error) {
    console.error('SMTP test error:', error)
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error
    }, { status: 500 })
  }
}