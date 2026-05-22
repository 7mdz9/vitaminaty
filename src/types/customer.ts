export interface CustomerRecord {
  id: string;
  full_name: string;
  phone_e164: string | null;
  email_verified_at: string | null;
  marketing_opt_in: boolean;
  marketing_opt_in_at: string | null;
  consent_version: string;
  consent_at: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}
