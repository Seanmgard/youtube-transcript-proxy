import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

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

    // Get the current user
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'You must be logged in to submit a feature suggestion' },
        { status: 401 }
      );
    }

    // Get user profile information
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // Configure email transporter using existing SendGrid configuration
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false, // true for 465, false for other ports like 587
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Get recipient email from environment variables or use default
    const recipientEmail = process.env.CONTACT_EMAIL || 'support@quizlabai.com';

    // Prepare email content
    const mailOptions = {
      from: process.env.SMTP_SENDER,
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
    await transporter.sendMail(mailOptions);

    // Store the suggestion in the database
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
      console.error('Error storing suggestion:', error);
      // Continue even if DB storage fails, as we've sent the email
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing feature suggestion:', error);
    return NextResponse.json(
      { error: 'Failed to submit suggestion' },
      { status: 500 }
    );
  }
} 