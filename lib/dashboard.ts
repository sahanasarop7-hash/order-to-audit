import { supabase } from "@/lib/supabase";

import type {
  DashboardData,
  ReorderAlert,
} from "@/types/dashboard";

export async function getDashboardData(
  startDate: string,
  endDate: string
): Promise<DashboardData> {
  if (!startDate || !endDate || startDate > endDate) {
    throw new Error("Invalid date range.");
  }

  const { data, error } = await supabase.rpc(
    "secure_dashboard",
    {
      p_start_date: startDate,
      p_end_date: endDate,
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Dashboard data is unavailable.");
  }

  return data as unknown as DashboardData;
}

export async function getReorderAlerts(): Promise<
  ReorderAlert[]
> {
  const { data, error } = await supabase.rpc(
    "secure_reorder_alerts"
  );

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as ReorderAlert[];
}