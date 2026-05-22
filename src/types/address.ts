export type UaeEmirate =
  | "Abu Dhabi"
  | "Dubai"
  | "Sharjah"
  | "Ajman"
  | "Umm Al Quwain"
  | "Ras Al Khaimah"
  | "Fujairah";

export interface AddressRecord {
  id: string;
  customer_id: string;
  label: string | null;
  recipient_name: string;
  phone_e164: string;
  line1: string;
  line2: string | null;
  city: string;
  emirate: UaeEmirate;
  country_code: "AE";
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export type AddressSnapshot = Pick<
  AddressRecord,
  "recipient_name" | "phone_e164" | "line1" | "line2" | "city" | "emirate" | "country_code"
>;
