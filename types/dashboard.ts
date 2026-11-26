export type DashboardData = {
  net_sales: number;
  total_gst: number;
  total_invoice_value: number;
  payments_collected: number;
  outstanding_amount: number;
  overdue_amount: number;
  pending_orders: number;
  dispatched_orders: number;
  production_batches: number;
  planned_output: number;
  actual_output: number;
  production_yield: number | null;
  material_variance_alerts: number;
  yield_alerts: number;
  material_stock_value: number;
  reorder_alert_count: number;
};

export type ReorderAlert = {
  item_id: number;
  sku: string;
  item_name: string;
  category: string;
  unit: string;
  available_stock: number;
  reorder_level: number;
  shortage_quantity: number;
  alert_status: string;
};