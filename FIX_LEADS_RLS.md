# Fixing the Leads Query Issue

## Problem
The Customers and Deals pages show "No leads found" even though there are 15 records in the Supabase `leads` table.

## Root Cause
The `leads` table likely has Row Level Security (RLS) enabled without a proper SELECT policy to allow authenticated users to read the data.

## Solution
Run the migration in `migrations/fix_leads_rls.sql`:

1. Open your Supabase dashboard: https://app.supabase.com
2. Go to your project's **SQL Editor**
3. Create a new query and paste the contents of `migrations/fix_leads_rls.sql`
4. Execute the query

## What the Migration Does
- Enables RLS on the `leads` table (if not already enabled)
- Drops any existing blocking policies
- Creates a new policy: "Enable read access for authenticated users on leads"
- This allows any authenticated user to read all records in the leads table

## Quick Verification
After running the migration, check that the policy was created:

```sql
SELECT * FROM pg_policies WHERE tablename = 'leads';
```

You should see:
- **Policy name**: "Enable read access for authenticated users on leads"
- **Command**: SELECT
- **Roles**: authenticated
- **Expression**: true (meaning no filtering)

## If Still Not Working
1. Check browser DevTools Console (F12) for the exact Supabase error
2. Verify you're signed in as an authenticated user
3. Check that your Supabase ANON_KEY is correctly set in `.env.local`
4. Try disabling RLS completely if you're in development:
   ```sql
   alter table leads disable row level security;
   ```

## Expected Result
After applying the migration:
- Customers page should display all leads
- Deals page should display all leads
- Both should show lead cards with full information
- Real-time subscriptions should work
