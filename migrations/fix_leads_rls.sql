-- Migration: Fix leads table RLS policies
-- The leads table likely has RLS enabled but missing SELECT policies
-- This causes queries to return empty results even though data exists
-- 
-- Apply this migration in your Supabase SQL Editor

-- Step 1: Check if leads table exists and has RLS enabled
-- SELECT tablename FROM pg_tables WHERE tablename = 'leads';
-- SELECT relname FROM pg_class WHERE relkind = 'r' AND relname = 'leads';

-- Step 2: Ensure RLS is enabled
alter table if exists leads enable row level security;

-- Step 3: Drop any existing policies that might be blocking access
drop policy if exists "Enable read access for all users" on leads;
drop policy if exists "Enable read access for authenticated users" on leads;
drop policy if exists "Authenticated users can view leads" on leads;
drop policy if exists "Anyone can view leads" on leads;
drop policy if exists "Users can view leads" on leads;
drop policy if exists "Public can view leads" on leads;

-- Step 4: Create a policy that allows authenticated users to read all leads
-- This is the CORRECT fix - authenticated users should be able to query the leads table
create policy "Enable read access for authenticated users on leads"
  on leads
  for select
  to authenticated
  using (true);

-- If you want completely public access (not recommended for production, but works for development):
-- create policy "Enable read access for all users on leads"
--   on leads
--   for select
--   to public
--   using (true);

-- Step 5: Verify the policy was created
-- SELECT * FROM pg_policies WHERE tablename = 'leads';

