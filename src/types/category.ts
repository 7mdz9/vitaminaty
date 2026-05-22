export type ParentNav = "Sport Nutrition" | "Health & Wellness" | "Snacks & Drinks";

export type GoalTag =
  | "build_muscle"
  | "boost_energy"
  | "recovery"
  | "weight_management"
  | "endurance";

export interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
  parent_nav: ParentNav;
  subcategories: string[];
  supported_goals: GoalTag[];
  listing_copy: string | null;
  seo_title: string | null;
  seo_description: string | null;
  is_visible: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
