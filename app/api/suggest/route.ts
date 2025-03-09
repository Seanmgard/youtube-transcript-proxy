// @ts-nocheck
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createServerSupabaseClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const { title, description } = await request.json();

    // Validate input
    if (!title || !description) {
      return NextResponse.json(
        { error: 'Title and description are required' },
        { status: 400 }
      );
    }

    // Get the current user using server-side Supabase client
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session || !session.user) {
      console.error('Authentication error: No valid session found');
      return NextResponse.json(
        { error: 'You must be logged in to submit a feature suggestion' },
        { status: 401 }
      );
    }

    const user = session.user;

    // Get user profile information
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      // Continue without profile info
    }

    // Configure email transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || '587'),
      secure: false, // true for 465, false for other ports like 587
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Verify SMTP connection
    try {
      await transporter.verify();
      console.log('SMTP connection verified');
    } catch (smtpError) {
      console.error('SMTP verification failed:', smtpError);
      // Continue anyway, we'll try to send the email
    }

    // Get recipient email from environment variables or use default
    const recipientEmail = process.env.CONTACT_EMAIL || 'support@quizlabai.com';
    const senderEmail = process.env.SMTP_SENDER || 'noreply@quizlabai.com';

    // Prepare email content
    const mailOptions = {
      from: senderEmail,
      to: recipientEmail,
      replyTo: user.email,
      subject: `QuizLab AI Feature Suggestion: ${title}`,
      text: `
Feature Suggestion from ${profile?.full_name || user.email}

Title: ${title}
Description:
${description}

User ID: ${user.id}
User Email: ${user.email}
      `,
      html: `
<h2>New Feature Suggestion</h2>
<p><strong>From:</strong> ${profile?.full_name || user.email}</p>
<p><strong>Title:</strong> ${title}</p>
<p><strong>Description:</strong></p>
<p>${description.replace(/\n/g, '<br>')}</p>
<hr>
<p><strong>User ID:</strong> ${user.id}</p>
<p><strong>User Email:</strong> ${user.email}</p>
      `,
    };

    // Send email
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', info.messageId);
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      return NextResponse.json(
        { error: 'Failed to send suggestion email. Please try again later.' },
        { status: 500 }
      );
    }

    // Store the suggestion in the database
    try {
      const { data, error } = await supabase
        .from('feature_suggestions')
        .insert([
          {
            user_id: user.id,
            title,
            description,
            status: 'pending',
          },
        ]);

      if (error) {
        console.error('Error storing suggestion in database:', error);
        // Continue even if DB storage fails, as we've sent the email
      }
    } catch (dbError) {
      console.error('Database error:', dbError);
      // Continue even if DB storage fails, as we've sent the email
    }

    return NextResponse.json({ 
      success: true,
      message: 'Suggestion submitted successfully'
    });
  } catch (error) {
    console.error('Error processing feature suggestion:', error);
    return NextResponse.json(
      { error: 'Failed to submit suggestion. Please try again later.' },
      { status: 500 }
    );
  }
} 