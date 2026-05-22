export interface FeatureFlagRecord {
  key: string;
  enabled: boolean;
  description: string | null;
  category: "surface" | "feature" | "operational" | string | null;
  updated_at: string;
  updated_by: string | null;
}
