import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

export type Invoice =
  Database["public"]["Tables"]["invoices"]["Row"];

export type InvoiceItem =
  Database["public"]["Tables"]["invoice_items"]["Row"];

export type CreditNote =
  Database["public"]["Tables"]["credit_notes"]["Row"];

// Retrieve invoices with their original order and items.

export async function getInvoices() {
  const { data, error } = await supabase
    .from("invoices")
    .select(`
      *,
      sales_orders (
        id,
        order_number,
        salesman_name,
        salesman_id,
        status
      ),
      invoice_items (*)
    `)
    .order("invoice_date", { ascending: false })
    .order("id", { ascending: false });

  if (error) throw new Error(error.message);

  return data ?? [];
}

export type InvoiceDetails =
  Awaited<ReturnType<typeof getInvoices>>[number];

// Retrieve approved orders awaiting invoice generation.

export async function getInvoiceEligibleOrders() {
  const { data, error } = await supabase
    .from("sales_orders")
    .select(`
      *,
      customers (
        name,
        state,
        state_code,
        gstin
      ),
      sales_order_items (
        *,
        products (
          name,
          sku
        )
      )
    `)
    .eq("status", "approved")
    .order("order_date", { ascending: false });

  if (error) throw new Error(error.message);

  return data ?? [];
}

export type InvoiceEligibleOrder =
  Awaited<
    ReturnType<typeof getInvoiceEligibleOrders>
  >[number];

// Generate an invoice using the secure database function.

export async function generateInvoice(
  orderId: number
) {
  const { data, error } = await supabase.rpc(
    "secure_generate_invoice",
    {
      p_order_id: orderId,
    }
  );

  if (error) throw new Error(error.message);

  return data;
}

// Dispatch an invoiced order and deduct physical stock.

export async function dispatchOrder(
  orderId: number
) {
  const { error } = await supabase.rpc(
    "secure_dispatch_order",
    {
      p_order_id: orderId,
    }
  );

  if (error) throw new Error(error.message);
}

// Retrieve credit notes and their item details.

export async function getCreditNotes() {
  const { data, error } = await supabase
    .from("credit_notes")
    .select(`
      *,
      credit_note_items (*)
    `)
    .order("id", { ascending: false });

  if (error) throw new Error(error.message);

  return data ?? [];
}

export type CreditNoteDetails =
  Awaited<ReturnType<typeof getCreditNotes>>[number];

// Cancel an eligible invoice through a credit note.

export async function issueCreditNote(
  invoiceId: number,
  reason: string
) {
  if (!reason.trim()) {
    throw new Error(
      "A cancellation reason is required."
    );
  }

  const { data, error } = await supabase.rpc(
    "secure_issue_credit_note",
    {
      p_invoice_id: invoiceId,
      p_reason: reason.trim(),
    }
  );

  if (error) throw new Error(error.message);

  return data;
}