# Facebook OAuth Integration

This guide explains how to set up Facebook OAuth integration for the OptimAi CRM Dashboard.

## Prerequisites

1. A Facebook App ID and App Secret from [Facebook Developers](https://developers.facebook.com)
2. Supabase project with authentication enabled
3. Node.js 16+ and npm

## Setup Instructions

### 1. Create a Facebook App

1. Go to [Facebook Developers](https://developers.facebook.com)
2. Create a new app with type "Business"
3. Add "Facebook Login" product
4. In Settings → Basic, copy your **App ID** and **App Secret**

### 2. Configure Facebook App Settings

1. Go to Settings → Basic in your Facebook App
2. Add Platform:
   - Platform: Website
   - Site URL: `https://yourdomain.com`
3. In Facebook Login → Settings:
   - Valid OAuth Redirect URIs: `https://yourdomain.com/api/auth/facebook/callback`

### 3. Set Up Required Permissions

Request access to these permissions:
- `ads_read` - Read ad accounts
- `ads_management` - Manage ad campaigns
- `leads_retrieval` - Access lead data
- `catalog_management` - Manage product catalogs
- `pages_messaging` - Manage page messages
- `business_management` - Manage business assets

### 4. Create Supabase Table

Run the SQL migration in your Supabase dashboard:

```sql
-- See migrations/create_facebook_connections.sql
```

### 5. Add Environment Variables

Add these to your `.env.local` file:

```env
# Facebook OAuth
FACEBOOK_APP_ID=your_app_id_here
FACEBOOK_APP_SECRET=your_app_secret_here

# Your app URL
NEXT_PUBLIC_URL=https://yourdomain.com

# Supabase (already configured)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
```

### 6. Update Settings Page

In your Settings component, add a button that redirects to the OAuth flow:

```tsx
<button
  onClick={() => {
    window.location.href = "/api/auth/facebook";
  }}
  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
>
  Connect Facebook
</button>
```

### 7. Handle OAuth Callback

After successful connection, the user is redirected to:
- Success: `/settings?fb=connected`
- Error: `/settings?fb=error&message=error_description`

You can handle these query parameters in your Settings page:

```tsx
"use client";

import { useSearchParams } from "next/navigation";

export function SettingsSection() {
  const searchParams = useSearchParams();
  const fbStatus = searchParams.get("fb");
  const fbMessage = searchParams.get("message");

  return (
    <div>
      {fbStatus === "connected" && (
        <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-500">
          Facebook successfully connected!
        </div>
      )}
      {fbStatus === "error" && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500">
          Error: {fbMessage}
        </div>
      )}
    </div>
  );
}
```

## API Routes

### GET `/api/auth/facebook`
Initiates the Facebook OAuth flow. Redirects user to Facebook login.

**Query Parameters:** None

**Response:** Redirects to Facebook OAuth dialog

### GET `/api/auth/facebook/callback`
Handles the OAuth callback from Facebook.

**Query Parameters:**
- `code` - Authorization code from Facebook
- `error` - Error code (if any)
- `error_description` - Error description (if any)

**Response:** 
- Success: Redirects to `/settings?fb=connected`
- Error: Redirects to `/settings?fb=error&message=...`

## Stored Data

The following information is stored in the `facebook_connections` table:
- `user_id` - Your app's user ID (from auth)
- `facebook_user_id` - Facebook user ID
- `facebook_name` - Facebook user's name
- `facebook_email` - Facebook user's email
- `access_token` - OAuth access token (encrypted in production)
- `token_type` - Token type (usually "Bearer")
- `connected_at` - Timestamp of connection

## Security Notes

1. **Access tokens are sensitive** - In production, consider encrypting them in the database
2. **Token refresh** - Facebook access tokens expire; implement token refresh logic if needed
3. **HTTPS only** - Always use HTTPS in production
4. **Environment variables** - Never commit `.env.local` to Git

## Troubleshooting

### "Missing Facebook configuration"
- Check that `FACEBOOK_APP_ID` and `NEXT_PUBLIC_URL` are set in your environment

### "Failed to exchange code for token"
- Verify your `FACEBOOK_APP_SECRET` is correct
- Check that your redirect URI matches in Facebook App settings
- Ensure your App is in Development or Live mode

### "No authenticated user session"
- User must be logged in before connecting Facebook
- Check that authentication is working properly

### "Failed to save connection"
- Verify the `facebook_connections` table exists in Supabase
- Check that Row Level Security (RLS) policies are correctly configured

## Testing

1. Make sure your app is running locally or deployed
2. Update `NEXT_PUBLIC_URL` to match your current environment
3. Click "Connect Facebook" button in Settings
4. You should be redirected to Facebook login
5. After authorizing, you'll be redirected back with success message

## References

- [Facebook Login Documentation](https://developers.facebook.com/docs/facebook-login)
- [Facebook Graph API](https://developers.facebook.com/docs/graph-api)
- [OAuth 2.0 Specification](https://tools.ietf.org/html/rfc6749)
