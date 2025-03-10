"use server";

import { encodedRedirect } from "@/utils/utils";
import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const signUpAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const firstName = formData.get("firstName")?.toString();
  const lastName = formData.get("lastName")?.toString();
  const supabase = await createClient();
  const origin = (await headers()).get("origin") || process.env.NEXT_PUBLIC_SITE_URL;

  if (!email || !password) {
    return encodedRedirect(
      "error",
      "/sign-up",
      "Email and password are required",
    );
  }

  if (!firstName || !lastName) {
    return encodedRedirect(
      "error",
      "/sign-up",
      "First name and last name are required",
    );
  }

  try {
    // Check if the email already exists
    const { data: existingUsers, error: lookupError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .limit(1);
      
    if (lookupError) {
      console.error('Error checking existing user:', lookupError);
    } else if (existingUsers && existingUsers.length > 0) {
      return encodedRedirect(
        "error",
        "/sign-up",
        "This email is already registered. Please sign in instead."
      );
    }
    
    // Configure sign-up with explicit email verification settings
    const { data: authData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Provide a redirect URL for email verification if needed
        emailRedirectTo: `${origin}/auth/callback`,
        data: {
          first_name: firstName,
          last_name: lastName,
        }
      },
    });

    if (error) {
      console.error('Sign up error:', error.code, error.message);
      if (error.message.includes('rate limit')) {
        return encodedRedirect(
          "error",
          "/sign-up",
          "Too many sign-up attempts. Please try again later or contact support."
        );
      }
      return encodedRedirect("error", "/sign-up", error.message);
    }

    // Create or update profile
    if (authData?.user) {
      try {
        // Use a SQL query to insert the profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            email: email, // Store email in profiles table for easier lookup
            full_name: `${firstName} ${lastName}`,
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            is_admin: false
          } as any);

        if (profileError) {
          console.error('Profile creation error:', profileError);
        }
      } catch (profileError) {
        console.error('Profile creation error:', profileError);
        // Continue anyway - the profile might be created by a trigger
      }
    }

    // Check if email confirmation is needed based on Supabase response
    const emailConfirmationNeeded = authData?.user && !authData.session;
    
    if (emailConfirmationNeeded) {
      return encodedRedirect(
        "success",
        "/auth/sign-in",
        "Account created successfully. Please check your email for a confirmation link."
      );
    } else {
      // Redirect to sign-in page after successful sign-up
      return encodedRedirect(
        "success",
        "/auth/sign-in",
        "Account created successfully. Please sign in with your new credentials."
      );
    }
  } catch (error: any) {
    console.error('Unexpected error during sign up:', error);
    return encodedRedirect(
      "error",
      "/sign-up",
      "An unexpected error occurred. Please try again."
    );
  }
};

export async function signInAction(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const supabase = await createClient()

  try {
    // Sign in with password
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      console.error('Sign-in error:', error.message)
      return { error: error.message }
    }

    // Ensure we have a session
    if (!data.session) {
      // Try to refresh the session
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
      
      if (refreshError || !refreshData.session) {
        console.error('Session refresh error:', refreshError?.message)
        return { error: 'Authentication failed. Please try again.' }
      }
    }

    // Set cookies with the session
    const cookieOptions = {
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
    }

    // Redirect to dashboard
    redirect('/dashboard')
  } catch (error: any) {
    console.error('Unexpected sign-in error:', error)
    return { error: 'An unexpected error occurred. Please try again.' }
  }
}

export const forgotPasswordAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const supabase = await createClient();
  const origin = (await headers()).get("origin");
  const callbackUrl = formData.get("callbackUrl")?.toString();

  if (!email) {
    return encodedRedirect("error", "/forgot-password", "Email is required");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?redirect_to=/protected/reset-password`,
  });

  if (error) {
    console.error(error.message);
    return encodedRedirect(
      "error",
      "/forgot-password",
      "Could not reset password",
    );
  }

  if (callbackUrl) {
    return redirect(callbackUrl);
  }

  return encodedRedirect(
    "success",
    "/forgot-password",
    "Check your email for a link to reset your password.",
  );
};

export const resetPasswordAction = async (formData: FormData) => {
  const supabase = await createClient();

  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || !confirmPassword) {
    encodedRedirect(
      "error",
      "/protected/reset-password",
      "Password and confirm password are required",
    );
  }

  if (password !== confirmPassword) {
    encodedRedirect(
      "error",
      "/protected/reset-password",
      "Passwords do not match",
    );
  }

  const { error } = await supabase.auth.updateUser({
    password: password,
  });

  if (error) {
    encodedRedirect(
      "error",
      "/protected/reset-password",
      "Password update failed",
    );
  }

  encodedRedirect("success", "/protected/reset-password", "Password updated");
};

export const signOutAction = async () => {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return redirect("/sign-in");
};
