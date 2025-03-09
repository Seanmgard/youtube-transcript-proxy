-- Function to check if a column exists in a table
CREATE OR REPLACE FUNCTION public.check_column_exists(
  table_name text,
  column_name text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  column_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = check_column_exists.table_name
    AND column_name = check_column_exists.column_name
  ) INTO column_exists;
  
  RETURN json_build_object('exists', column_exists);
END;
$$;

-- Function to add a column to the profiles table
CREATE OR REPLACE FUNCTION public.add_column_to_profiles(
  column_name text,
  column_type text,
  default_value text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sql_statement text;
BEGIN
  -- Construct the SQL statement
  sql_statement := format(
    'ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS %I %s DEFAULT %s',
    column_name,
    column_type,
    default_value
  );
  
  -- Execute the SQL statement
  EXECUTE sql_statement;
END;
$$; 