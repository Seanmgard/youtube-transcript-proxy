"use server";

import { encodedRedirect } from "@/utils/utils";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Database } from "@/lib/database.types";

export const signUpAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const firstName = formData.get("firstName")?.toString();
  const lastName = formData.get("lastName")?.toString();
  const supabase = await createClient();
  
  // Await headers() to resolve the Promise
  const headersList = await headers();
  const origin = headersList.get("origin");

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
    // First, attempt to sign up the user
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
        data: {
          first_name: firstName,
          last_name: lastName,
        }
      },
    });

    if (signUpError) {
      console.error('Sign up error:', signUpError.code, signUpError.message);
      
      if (signUpError.message.includes('rate limit')) {
        return encodedRedirect(
          "error",
          "/sign-up",
          "Too many sign-up attempts. Please try again later."
        );
      }
      
      if (signUpError.message.includes('weak password')) {
        return encodedRedirect(
          "error",
          "/sign-up",
          "Password is too weak. Please use a stronger password."
        );
      }

      return encodedRedirect("error", "/sign-up", signUpError.message);
    }

    if (!authData.user) {
      return encodedRedirect(
        "error",
        "/sign-up",
        "Failed to create user account. Please try again."
      );
    }

    // Check if the user already exists but hasn't confirmed their email
    if (authData.user.identities?.length === 0) {
      return encodedRedirect(
        "error",
        "/sign-up",
        "Email address is already registered. Please sign in or reset your password."
      );
    }

    // Create or update profile using RLS policies
    try {
      const profileData: Database['public']['Tables']['profiles']['Insert'] = {
        first_name: firstName,
        last_name: lastName,
        email: email,
        updated_at: new Date().toISOString(),
        is_admin: false,
      };

      const { error: profileError } = await supabase
        .from('profiles')
        .insert(profileData)
        .select()
        .single();

      if (profileError) {
        console.error('Profile creation error:', profileError);
        // Profile creation failed, but auth succeeded
        // The database trigger should handle profile creation as fallback
      }
    } catch (profileError) {
      console.error('Unexpected error creating profile:', profileError);
    }

    // Check if email confirmation is required
    if (authData.user.confirmation_sent_at) {
      return encodedRedirect(
        "success",
        "/sign-up",
        "Please check your email for a confirmation link to complete your registration."
      );
    }

    // No email confirmation required, proceed to dashboard
    return redirect('/dashboard');
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
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const supabase = await createClient();

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return { error: error.message };
    }

    if (!data.user) {
      return { error: "Failed to sign in. Please try again." };
    }

    return redirect('/dashboard');
  } catch (error: any) {
    return { error: "An unexpected error occurred. Please try again." };
  }
}

export const forgotPasswordAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const supabase = await createClient();
  
  // Await headers() to resolve the Promise
  const headersList = await headers();
  const origin = headersList.get("origin");
  const callbackUrl = formData.get("callbackUrl")?.toString();

  if (!email) {
    return encodedRedirect("error", "/forgot-password", "Email is required");
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?redirect_to=/protected/reset-password`,
    });

    if (error) {
      console.error('Password reset error:', error);
      return encodedRedirect(
        "error",
        "/forgot-password",
        "Could not send password reset email. Please try again."
      );
    }

    if (callbackUrl) {
      return redirect(callbackUrl);
    }

    return encodedRedirect(
      "success",
      "/forgot-password",
      "Check your email for a link to reset your password."
    );
  } catch (error) {
    console.error('Unexpected error during password reset:', error);
    return encodedRedirect(
      "error",
      "/forgot-password",
      "An unexpected error occurred. Please try again."
    );
  }
};

export const resetPasswordAction = async (formData: FormData) => {
  const supabase = await createClient();
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || !confirmPassword) {
    return encodedRedirect(
      "error",
      "/protected/reset-password",
      "Password and confirm password are required"
    );
  }

  if (password !== confirmPassword) {
    return encodedRedirect(
      "error",
      "/protected/reset-password",
      "Passwords do not match"
    );
  }

  try {
    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    if (error) {
      return encodedRedirect(
        "error",
        "/protected/reset-password",
        "Password update failed. Please try again."
      );
    }

    return encodedRedirect(
      "success", 
      "/protected/reset-password",
      "Password updated successfully"
    );
  } catch (error) {
    console.error('Unexpected error during password reset:', error);
    return encodedRedirect(
      "error",
      "/protected/reset-password",
      "An unexpected error occurred. Please try again."
    );
  }
};

export const signOutAction = async () => {
  const supabase = await createClient();
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Sign out error:', error);
    }
  } catch (error) {
    console.error('Unexpected error during sign out:', error);
  }
  return redirect("/sign-in");
};
