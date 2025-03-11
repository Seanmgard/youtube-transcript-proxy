import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createServerSupabaseClient } from '@/utils/supabase/server';
import type { Database } from '@/lib/database.types';
import { SupabaseClient } from '@supabase/supabase-js';

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
    const supabase = await createServerSupabaseClient() as SupabaseClient<Database>;
    const { data: { session } } = await supabase.auth.getSession();

    if (!session || !session.user) {
      console.error('Authentication error: No valid session found');
      return NextResponse.json(
        { error: 'You must be logged in to submit a feature suggestion' },
        { status: 401 }
      );
    }

    const user = session.user;
    
    // Explicitly type user ID to match profiles table
    const userId: Database['public']['Tables']['profiles']['Row']['id'] = user.id;

    // Get user profile information
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('first_name,last_name')
      .eq('id', userId)
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

    // Format user's full name if available
    const userFullName = profile && !profileError ? 
      `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 
      user.email;

    // Prepare email content
    const mailOptions = {
      from: senderEmail,
      to: recipientEmail,
      replyTo: user.email,
      subject: `QuizLab AI Feature Suggestion: ${title}`,
      text: `
Feature Suggestion from ${userFullName}

Title: ${title}
Description:
${description}

User ID: ${userId}
User Email: ${user.email}
      `,
      html: `
<h2>New Feature Suggestion</h2>
<p><strong>From:</strong> ${userFullName}</p>
<p><strong>Title:</strong> ${title}</p>
<p><strong>Description:</strong></p>
<p>${description.replace(/\n/g, '<br>')}</p>
<hr>
<p><strong>User ID:</strong> ${userId}</p>
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
      const suggestionData: Database['public']['Tables']['feature_suggestions']['Insert'] = {
        user_id: userId,
        title,
        description,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('feature_suggestions')
        .insert(suggestionData);

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