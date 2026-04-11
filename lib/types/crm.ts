export type Lead = {
  id: string;
  user_id: string;
  full_name: string;
  platform: string;
  email: string;
  phone: string;
  zip_code: string;
  utm_campaign: string;
  lead_score_value: number;
  lead_score: "hot" | "warm" | "cold";
  created_at: string;
  credit_score?: string;
  timeline?: string;
  down_payment?: string;
  status?: string;
  retailer_item_id?: string;
};
