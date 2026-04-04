-- Create facebook_connections table to store Facebook OAuth tokens and user info
-- Run this migration in your Supabase dashboard under SQL Editor

create table if not exists facebook_connections (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null unique references auth.users(id) on delete cascade,
  fb_user_id varchar(255) not null,
  access_token text not null,
  token_expires_at timestamp with time zone not null,
  ad_account_ids text[] default array[]::text[],
  page_ids text[] default array[]::text[],
  connected_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

-- Create index on client_id for faster lookups
create index if not exists facebook_connections_client_id_idx 
  on facebook_connections(client_id);

-- Enable RLS for security
alter table facebook_connections enable row level security;

-- Create RLS policy - users can only view/edit their own connections
create policy "Users can view their own Facebook connections"
  on facebook_connections
  for select
  using (auth.uid() = client_id);

create policy "Users can insert their own Facebook connections"
  on facebook_connections
  for insert
  with check (auth.uid() = client_id);

create policy "Users can update their own Facebook connections"
  on facebook_connections
  for update
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);

create policy "Users can delete their own Facebook connections"
  on facebook_connections
  for delete
  using (auth.uid() = client_id);
