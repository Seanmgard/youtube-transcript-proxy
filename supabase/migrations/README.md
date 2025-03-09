# Database Migrations

This directory contains SQL migrations for your Supabase database.

## How to Apply Migrations

### Using Supabase CLI

If you have the Supabase CLI installed, you can apply migrations with:

```bash
supabase db push
```

### Manual Application

If you don't have the CLI, you can manually apply migrations:

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy the contents of the migration file
4. Paste into the SQL Editor and run the query

## Recent Migrations

### 20240701000000_add_avatar_url_to_profiles.sql

This migration adds the `avatar_url` column to the profiles table, which is needed for user avatars in the dashboard.

**What it does:**
- Adds an `avatar_url` TEXT column to the profiles table
- Creates a Row Level Security policy to allow users to update their own avatar

**Why it's needed:**
The application code expects this column to exist, and without it, you'll see errors like:
"Error fetching profile: column profiles.avatar_url does not exist" 