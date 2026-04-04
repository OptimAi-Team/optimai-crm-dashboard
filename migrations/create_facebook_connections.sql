-- Create facebook_connections table to store Facebook OAuth tokens and user info
-- Run this migration in your Supabase dashboard under SQL Editor

create table if not exists facebook_connections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  facebook_user_id varchar(255) not null,
  facebook_name varchar(255),
  facebook_email varchar(255),
  access_token text not null,
  token_type varchar(50) default 'Bearer',
  connected_at timestamp with time zone not null,
  updated_at timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

-- Create index on user_id for faster lookups
create index if not exists facebook_connections_user_id_idx 
  on facebook_connections(user_id);

-- Enable RLS for security
alter table facebook_connections enable row level security;

-- Create RLS policy - users can only view/edit their own connections
create policy "Users can view their own Facebook connections"
  on facebook_connections
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own Facebook connections"
  on facebook_connections
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own Facebook connections"
  on facebook_connections
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own Facebook connections"
  on facebook_connections
  for delete
  using (auth.uid() = user_id);
