
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

export type AuditLog =
  Database["public"]["Tables"]["audit_logs"]["Row"];

export type AuditFilters = {
  startDate: string;
  endDate: string;
  table: string;
  action: string;
};

export async function getAuditLogs(
  filters: AuditFilters
): Promise<AuditLog[]> {
  const rows: AuditLog[] = [];
  const pageSize = 500;

  for (
    let offset = 0;
    ;
    offset += pageSize
  ) {
    let query = supabase
      .from("audit_logs")
      .select("*");

    if (filters.startDate) {
      query = query.gte(
        "changed_at",
        `${filters.startDate}T00:00:00+05:30`
      );
    }

    if (filters.endDate) {
      query = query.lte(
        "changed_at",
        `${filters.endDate}T23:59:59.999999+05:30`
      );
    }

    if (filters.table !== "all") {
      query = query.eq(
        "table_name",
        filters.table
      );
    }

    if (filters.action !== "all") {
      query = query.eq(
        "action",
        filters.action
      );
    }

    const { data, error } = await query
      .order("changed_at", {
        ascending: false,
      })
      .order("id", {
        ascending: false,
      })
      .range(
        offset,
        offset + pageSize - 1
      );

    if (error) {
      throw new Error(error.message);
    }

    const page = data ?? [];

    rows.push(...page);

    if (page.length < pageSize) break;
  }

  return rows;
}

export function auditTableLabel(
  table: string
) {
  const labels: Record<string, string> = {
    products: "Products",
    customers: "Customers",
    suppliers: "Suppliers",
    inventory_items: "Inventory materials",
    boms: "Bills of materials",
    bom_items: "BOM materials",
    sales_orders: "Sales orders",
    sales_order_items: "Sales order items",
    purchases: "Purchases",
    purchase_items: "Purchase items",
    production_runs: "Production batches",
    production_consumption:
      "Production consumption",
    stock_movements: "Stock movements",
    invoices: "Invoices",
    invoice_items: "Invoice items",
    dispatches: "Dispatches",
    payments: "Payments",
    credit_notes: "Credit notes",
    credit_note_items: "Credit note items",
    company_settings: "Company settings",
    profiles: "User profiles",
  };

  return labels[table] ??
    table.replaceAll("_", " ");
}

export function formatAuditTime(
  value: string
) {
  return new Date(value).toLocaleString(
    "en-IN",
    {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }
  );
}
