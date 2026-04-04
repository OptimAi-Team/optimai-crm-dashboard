// Type definitions for Facebook OAuth and connections

export interface FacebookConnection {
  id: string;
  user_id: string;
  facebook_user_id: string;
  facebook_name: string | null;
  facebook_email: string | null;
  access_token: string;
  token_type: string;
  connected_at: string;
  updated_at: string;
  created_at: string;
}

export interface FacebookOAuthtoken {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export interface FacebookUserInfo {
  id: string;
  name: string;
  email: string;
}

export interface FacebookOAuthError {
  error: {
    message: string;
    type: string;
    code: number;
  };
}
