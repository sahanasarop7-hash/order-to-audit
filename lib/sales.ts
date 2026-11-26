import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

export type SalesOrder =
  Database["public"]["Tables"]["sales_orders"]["Row"];

export type SalesOrderItem =
  Database["public"]["Tables"]["sales_order_items"]["Row"];

export type OrderItemInput = {
  product_id: number;
  quantity: number;
};

// Fetch orders with customer and product details.

export async function getSalesOrders() {
  const { data, error } = await supabase
    .from("sales_orders")
    .select(`
      *,
      customers (
        name,
        customer_type,
        phone,
        state,
        state_code,
        gstin
      ),
      sales_order_items (
        *,
        products (
          name,
          sku,
          packet_size_g,
          packets_per_carton
        )
      )
    `)
    .order("order_date", { ascending: false })
    .order("id", { ascending: false });

  if (error) throw new Error(error.message);

  return data ?? [];
}

export type OrderDetails =
  Awaited<ReturnType<typeof getSalesOrders>>[number];

// Fetch physical, reserved and available stock.

export async function getProductStock() {
  const { data, error } = await supabase.rpc(
    "secure_product_stock"
  );

  if (error) throw new Error(error.message);

  return data ?? [];
}

export type ProductStock =
  Awaited<ReturnType<typeof getProductStock>>[number];

// Create or update a pending order.

export async function saveSalesOrder(values: {
  customerId: number;
  items: OrderItemInput[];
  orderId?: number;
}) {
  const { data, error } = await supabase.rpc(
    "secure_save_order",
    {
      p_customer_id: values.customerId,
      p_items: values.items,
      ...(values.orderId !== undefined
        ? { p_order_id: values.orderId }
        : {}),
    }
  );

  if (error) throw new Error(error.message);

  return data;
}

// Approve an order and reserve stock.

export async function approveSalesOrder(
  orderId: number
) {
  const { error } = await supabase.rpc(
    "secure_approve_order",
    {
      p_order_id: orderId,
    }
  );

  if (error) throw new Error(error.message);
}

// Reopen an approved order and release reservation.

export async function reopenSalesOrder(
  orderId: number
) {
  const { error } = await supabase.rpc(
    "secure_reopen_order",
    {
      p_order_id: orderId,
    }
  );

  if (error) throw new Error(error.message);
}

// Reject or cancel an eligible order.

export async function closeSalesOrder(
  orderId: number,
  action: "reject" | "cancel",
  reason: string
) {
  const { error } = await supabase.rpc(
    "secure_close_order",
    {
      p_order_id: orderId,
      p_action: action,
      p_reason: reason,
    }
  );

  if (error) throw new Error(error.message);
}

// Calculate estimated order totals for display.

export function calculateOrderTotals(
  items: {
    quantity: number;
    unit_price: number;
    gst_rate: number;
  }[]
) {
  let taxablePaise = 0;
  let gstPaise = 0;

  for (const item of items) {
    const lineTaxablePaise =
      item.quantity *
      Math.round(item.unit_price * 100);

    const lineGSTPaise = Math.round(
      (lineTaxablePaise * item.gst_rate) / 100
    );

    taxablePaise += lineTaxablePaise;
    gstPaise += lineGSTPaise;
  }

  return {
    taxableAmount: taxablePaise / 100,
    gstAmount: gstPaise / 100,
    totalAmount: (taxablePaise + gstPaise) / 100,
  };
}