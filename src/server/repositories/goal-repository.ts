import "server-only";

import { createSupabaseServerClient } from "@/server/db/supabase-server";
import type { Database } from "@/lib/supabase/types.generated";
import type { GoalRecord, GoalTag } from "@/types/category";

type PublicClient = Pick<Awaited<ReturnType<typeof createSupabaseServerClient>>, "from">;
type GoalRow = Database["public"]["Tables"]["goals"]["Row"];

const GOAL_COLUMNS = "tag, display_name, description, sort_order";

export async function listGoals(client?: PublicClient): Promise<GoalRecord[]> {
  const supabase = await resolvePublicClient(client);
  const { data, error } = await supabase
    .from("goals")
    .select(GOAL_COLUMNS)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(`Goals query failed: ${error.message}`);
  }

  return (data as unknown as GoalRow[]).map(mapGoal);
}

export async function getGoal(tag: GoalTag, client?: PublicClient): Promise<GoalRecord | null> {
  const supabase = await resolvePublicClient(client);
  const { data, error } = await supabase
    .from("goals")
    .select(GOAL_COLUMNS)
    .eq("tag", tag)
    .maybeSingle();

  if (error) {
    throw new Error(`Goal query failed: ${error.message}`);
  }

  return data ? mapGoal(data as unknown as GoalRow) : null;
}

async function resolvePublicClient(client?: PublicClient): Promise<PublicClient> {
  return client ?? createSupabaseServerClient();
}

function mapGoal(row: GoalRow): GoalRecord {
  return row;
}
