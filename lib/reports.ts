
import { supabase } from "@/lib/supabase";

export type ReportRow = Record<
  string,
  string | number | boolean | null
>;

export type ReportCategory =
  | "Sales"
  | "GST"
  | "Purchases"
  | "Inventory"
  | "Production"
  | "Finance";

export type ReportDefinition = {
  id: string;
  title: string;
  description: string;
  category: ReportCategory;
  periodBased: boolean;
  roles: readonly string[];
  columns: string[];
};

const FINANCE = [
  "admin",
  "accountant",
  "owner",
] as const;

const OPERATIONS = [
  "admin",
  "production",
  "accountant",
  "owner",
] as const;

export const REPORTS: ReportDefinition[] = [
  {
    id: "sales_register",
    title: "Sales register",
    description:
      "Invoice-wise sales, taxes and dispatch details.",
    category: "Sales",
    periodBased: true,
    roles: FINANCE,
    columns: [
      "invoice_number",
      "invoice_date",
      "order_number",
      "salesman_name",
      "customer_name",
      "customer_type",
      "customer_gstin",
      "place_of_supply",
      "taxable_amount",
      "cgst_amount",
      "sgst_amount",
      "igst_amount",
      "total_gst",
      "total_amount",
      "invoice_status",
      "order_status",
      "dispatch_date",
    ],
  },
  {
    id: "customer_sales",
    title: "Customer-wise sales",
    description:
      "Sales and tax totals grouped by customer.",
    category: "Sales",
    periodBased: true,
    roles: FINANCE,
    columns: [
      "name",
      "type",
      "total_invoices",
      "taxable_sales",
      "total_gst",
      "total_sales",
    ],
  },
  {
    id: "product_sales",
    title: "Product-wise sales",
    description:
      "Quantity sold and sales value by product.",
    category: "Sales",
    periodBased: true,
    roles: FINANCE,
    columns: [
      "sku",
      "product_name",
      "total_invoices",
      "quantity_sold",
      "taxable_sales",
      "total_gst",
      "total_sales",
    ],
  },
  {
    id: "gst_register",
    title: "GST outward supplies",
    description:
      "Invoice and credit note details for GST reconciliation.",
    category: "GST",
    periodBased: true,
    roles: FINANCE,
    columns: [
      "document_type",
      "document_number",
      "document_date",
      "original_invoice_number",
      "customer_name",
      "customer_gstin",
      "state_code",
      "supply_type",
      "gst_rate",
      "taxable_amount",
      "cgst_amount",
      "sgst_amount",
      "igst_amount",
      "total_amount",
    ],
  },
  {
    id: "gst_summary",
    title: "GST summary",
    description:
      "Net taxable supplies and GST grouped by supply type.",
    category: "GST",
    periodBased: true,
    roles: FINANCE,
    columns: [],
  },
  {
    id: "purchase_register",
    title: "Purchase register",
    description:
      "Posted material purchases and supplier invoice details.",
    category: "Purchases",
    periodBased: true,
    roles: FINANCE,
    columns: [
      "invoice_number",
      "purchase_date",
      "supplier_name",
      "sku",
      "item_name",
      "category",
      "unit",
      "quantity",
      "unit_price",
      "total_amount",
      "purchase_status",
    ],
  },
  {
    id: "supplier_purchases",
    title: "Supplier-wise purchases",
    description:
      "Purchase totals grouped by supplier.",
    category: "Purchases",
    periodBased: true,
    roles: FINANCE,
    columns: [
      "supplier_code",
      "supplier_name",
      "total_purchases",
      "total_purchase_value",
      "last_purchase_date",
    ],
  },
  {
    id: "stock_summary",
    title: "Stock reconciliation",
    description:
      "Opening stock, receipts, issues, adjustments and closing stock.",
    category: "Inventory",
    periodBased: true,
    roles: OPERATIONS,
    columns: [
      "sku",
      "item_name",
      "category",
      "unit",
      "opening_stock",
      "receipts",
      "issues",
      "adjustments",
      "closing_stock",
    ],
  },
  {
    id: "stock_ledger",
    title: "Stock movement ledger",
    description:
      "Traceable inventory movements with running balances.",
    category: "Inventory",
    periodBased: true,
    roles: OPERATIONS,
    columns: [
      "movement_date",
      "sku",
      "item_name",
      "category",
      "unit",
      "movement_type",
      "stock_in",
      "stock_out",
      "running_balance",
      "unit_cost",
      "reference_type",
      "reference_id",
    ],
  },
  {
    id: "production_summary",
    title: "Production summary and costing",
    description:
      "Production yield, wastage, material cost and overhead allocation.",
    category: "Production",
    periodBased: true,
    roles: OPERATIONS,
    columns: [
      "batch_number",
      "production_date",
      "product_name",
      "planned_output",
      "actual_output",
      "output_variance",
      "yield_percentage",
      "yield_variance_percentage",
      "yield_status",
      "damaged_pouches",
      "material_cost",
      "labour_cost",
      "utility_cost",
      "total_production_cost",
      "cost_per_packet",
      "selling_price",
      "margin_per_packet",
      "margin_percentage",
    ],
  },
  {
    id: "production_variance",
    title: "Material consumption variance",
    description:
      "Planned versus actual material usage and tolerance alerts.",
    category: "Production",
    periodBased: true,
    roles: OPERATIONS,
    columns: [
      "batch_number",
      "production_date",
      "product_name",
      "material_name",
      "category",
      "unit",
      "planned_quantity",
      "actual_quantity",
      "quantity_variance",
      "variance_percentage",
      "variance_status",
      "unit_cost",
      "cost_variance",
    ],
  },
  {
    id: "production_margin",
    title: "Production margin",
    description:
      "Production cost and estimated margin per packet.",
    category: "Production",
    periodBased: true,
    roles: FINANCE,
    columns: [
      "batch_number",
      "production_date",
      "product_name",
      "actual_output",
      "cost_per_packet",
      "selling_price",
      "margin_per_packet",
      "margin_percentage",
    ],
  },
  {
    id: "payment_collections",
    title: "Payment collections",
    description:
      "Valid customer payments during the selected period.",
    category: "Finance",
    periodBased: true,
    roles: FINANCE,
    columns: [
      "payment_date",
      "invoice_number",
      "customer_name",
      "salesman_name",
      "amount",
      "payment_method",
      "reference_number",
    ],
  },
  {
    id: "invoice_receivables",
    title: "Invoice receivables",
    description:
      "Current invoice-wise outstanding balances.",
    category: "Finance",
    periodBased: false,
    roles: FINANCE,
    columns: [
      "invoice_number",
      "customer_name",
      "invoice_date",
      "due_date",
      "total_amount",
      "amount_paid",
      "outstanding_amount",
      "payment_status",
      "overdue_days",
    ],
  },
  {
    id: "customer_outstanding",
    title: "Customer outstanding",
    description:
      "Current customer-wise collections and outstanding balances.",
    category: "Finance",
    periodBased: false,
    roles: FINANCE,
    columns: [
      "customer_name",
      "customer_type",
      "total_invoices",
      "total_invoiced",
      "total_collected",
      "total_outstanding",
      "overdue_amount",
    ],
  },
  {
    id: "receivables_ageing",
    title: "Receivables ageing",
    description:
      "Current outstanding balances grouped by overdue duration.",
    category: "Finance",
    periodBased: false,
    roles: FINANCE,
    columns: [
      "invoice_number",
      "customer_name",
      "due_date",
      "outstanding_amount",
      "overdue_days",
      "ageing_bucket",
    ],
  },
];

// Validate the response before displaying or exporting it.

function parseRows(
  data: unknown,
  error: { message: string } | null
): ReportRow[] {
  if (error) {
    throw new Error(error.message);
  }

  if (data == null) return [];

  if (
    !Array.isArray(data) ||
    data.some(
      (row) =>
        row === null ||
        typeof row !== "object" ||
        Array.isArray(row)
    )
  ) {
    throw new Error(
      "Unexpected report response format."
    );
  }

  return data as ReportRow[];
}

// Read large view-based reports in batches instead
// of silently stopping at the default API row limit.

async function fetchPages(
  fetchPage: (
    from: number,
    to: number
  ) => PromiseLike<{
    data: unknown;
    error: { message: string } | null;
  }>
): Promise<ReportRow[]> {
  const pageSize = 500;
  const rows: ReportRow[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await fetchPage(
      offset,
      offset + pageSize - 1
    );

    const page = parseRows(data, error);

    rows.push(...page);

    if (page.length < pageSize) break;
  }

  return rows;
}

export async function loadReport(
  reportId: string,
  startDate: string,
  endDate: string
): Promise<ReportRow[]> {
  const definition = REPORTS.find(
    (report) => report.id === reportId
  );

  if (!definition) {
    throw new Error("Unknown report.");
  }

  if (
    definition.periodBased &&
    (!startDate ||
      !endDate ||
      startDate > endDate)
  ) {
    throw new Error(
      "Select a valid report date range."
    );
  }

  const dates = {
    p_start_date: startDate,
    p_end_date: endDate,
  };

  switch (reportId) {
    case "sales_register":
      return fetchPages((from, to) =>
        supabase
          .from("sales_register")
          .select("*")
          .gte("invoice_date", startDate)
          .lte("invoice_date", endDate)
          .order("invoice_date")
          .order("invoice_id")
          .range(from, to)
      );

    case "customer_sales":
      return fetchPages((from, to) =>
        supabase
          .rpc("customer_sales_report", dates)
          .order("customer_id")
          .range(from, to)
      );

    case "product_sales":
      return fetchPages((from, to) =>
        supabase
          .rpc("product_sales_report", dates)
          .order("product_id")
          .range(from, to)
      );

    case "gst_register": {
      const { data, error } = await supabase.rpc(
        "secure_gst_register",
        dates
      );

      return parseRows(data, error);
    }

    case "gst_summary": {
      const { data, error } = await supabase.rpc(
        "secure_gst_summary_report",
        dates
      );

      return parseRows(data, error);
    }

    case "purchase_register":
      return fetchPages((from, to) =>
        supabase
          .from("purchase_register")
          .select("*")
          .gte("purchase_date", startDate)
          .lte("purchase_date", endDate)
          .order("purchase_date")
          .order("purchase_id")
          .order("inventory_item_id")
          .range(from, to)
      );

    case "supplier_purchases":
      return fetchPages((from, to) =>
        supabase
          .rpc("supplier_purchase_report", dates)
          .order("supplier_id")
          .range(from, to)
      );

    case "stock_summary":
      return fetchPages((from, to) =>
        supabase
          .rpc("secure_stock_period_report", dates)
          .order("category")
          .order("sku")
          .range(from, to)
      );

    case "stock_ledger":
      return fetchPages((from, to) =>
        supabase
          .from("stock_ledger_report")
          .select("*")
          .gte("movement_date", startDate)
          .lte("movement_date", endDate)
          .order("movement_date")
          .order("movement_id")
          .range(from, to)
      );

    case "production_summary":
    case "production_margin":
      return fetchPages((from, to) =>
        supabase
          .from("production_summary_report")
          .select("*")
          .gte("production_date", startDate)
          .lte("production_date", endDate)
          .order("production_date")
          .order("production_run_id")
          .range(from, to)
      );

    case "production_variance":
      return fetchPages((from, to) =>
        supabase
          .from("production_variance_report")
          .select("*")
          .gte("production_date", startDate)
          .lte("production_date", endDate)
          .order("production_date")
          .order("production_run_id")
          .order("sku")
          .range(from, to)
      );

    case "payment_collections":
    case "invoice_receivables":
    case "customer_outstanding":
    case "receivables_ageing": {
      const reportNames: Record<string, string> = {
        payment_collections:
          "payment_collection_report",

        invoice_receivables:
          "invoice_receivables",

        customer_outstanding:
          "customer_outstanding_report",

        receivables_ageing:
          "receivables_ageing",
      };

      const { data, error } = await supabase.rpc(
        "secure_financial_report",
        {
          p_report: reportNames[reportId],
        }
      );

      const rows = parseRows(data, error);

      if (reportId === "payment_collections") {
        return rows.filter((row) => {
          const date = String(
            row.payment_date ?? ""
          );

          return (
            date >= startDate &&
            date <= endDate
          );
        });
      }

      return rows;
    }

    default:
      throw new Error(
        "Report is not implemented."
      );
  }
}

// Convert database column names into readable headings.

export function reportColumnLabel(key: string) {
  const labels: Record<string, string> = {
    sku: "SKU",
    customer_gstin: "Customer GSTIN",
    cgst_amount: "CGST amount",
    sgst_amount: "SGST amount",
    igst_amount: "IGST amount",
    gst_rate: "GST rate (%)",
    total_gst: "Total GST",
    state_code: "State code",
    yield_percentage: "Yield (%)",
    yield_variance_percentage: "Yield variance (%)",
    variance_percentage: "Variance (%)",
    margin_percentage: "Margin (%)",
  };

  if (labels[key]) return labels[key];

  const label = key.replaceAll("_", " ");

  return (
    label.charAt(0).toUpperCase() +
    label.slice(1)
  );
}

export function getReportColumns(
  report: ReportDefinition,
  rows: ReportRow[]
): string[] {
  if (report.columns.length > 0) {
    return report.columns;
  }

  // Use actual response columns for dynamic summaries.

  return Array.from(
    new Set(
      rows.flatMap((row) => Object.keys(row))
    )
  );
}
