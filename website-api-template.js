// Simple Website API Endpoint
// File: pages/api/notifications/send-email.js (Next.js)

import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get notification data from database trigger
    const { notification_id, user_id, title, message, type, data } = req.body;

    console.log('📧 Email request for notification:', title);

    // Get user email from database
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: user } = await supabase
      .from('users')
      .select('email, name')
      .eq('id', user_id)
      .single();

    if (!user?.email) {
      return res.status(400).json({ error: 'User email not found' });
    }

    // Create email transporter
    const transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: true,
      auth: {
        user: process.env.SMTP_NOTIFY_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Generate simple email
    const emailHtml = generateSimpleEmail(title, message, data, user);

    // Send email
    await transporter.sendMail({
      from: `"Colabify" <${process.env.SMTP_NOTIFY_USER}>`,
      to: user.email,
      subject: `[Colabify] ${title}`,
      html: emailHtml,
    });

    console.log('✅ Email sent to:', user.email);
    res.status(200).json({ success: true });

  } catch (error) {
    console.error('❌ Email error:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
}

function generateSimpleEmail(title, message, data, user) {
  const gitData = data || {};
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">🔔 ${title}</h2>
      <p style="color: #666; font-size: 16px;">${message}</p>
      
      ${gitData.contributor ? `
      <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <strong>Git Activity:</strong><br>
        👤 ${gitData.contributor} • 🔄 ${gitData.action}<br>
        🌿 ${gitData.branch} • 📁 ${gitData.repository}
        ${gitData.commitHash ? `<br>🔗 ${gitData.commitHash}` : ''}
      </div>
      ` : ''}
      
      <p style="margin-top: 20px;">
        <a href="https://colabify.xyz/inbox" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
          View in Colabify
        </a>
      </p>
      
      <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
      <p style="color: #999; font-size: 12px;">
        <a href="https://colabify.xyz/settings">Manage preferences</a>
      </p>
    </div>
  `;
}