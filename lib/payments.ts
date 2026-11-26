
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

export type Payment =
  Database["public"]["Tables"]["payments"]["Row"];

export type Receivable = {
  invoice_id: number;
  invoice_number: string;
  customer_name: string;
  invoice_date: string;
  due_date: string | null;
  total_amount: number;
  amount_paid: number;
  outstanding_amount: number;
  payment_status: string;
  overdue_days: number;
};

export type AgeingRow = {
  invoice_id: number;
  invoice_number: string;
  customer_name: string;
  due_date: string | null;
  outstanding_amount: number;
  overdue_days: number;
  ageing_bucket: string;
};

export type CustomerOutstanding = {
  customer_id: number;
  customer_name: string;
  customer_type: string;
  total_invoices: number;
  total_invoiced: number;
  total_collected: number;
  total_outstanding: number;
  overdue_amount: number;
};

export type PaymentMethod =
  | "cash"
  | "upi"
  | "bank_transfer"
  | "cheque";

// Retrieve recorded and reversed payments.

export async function getPayments() {
  const { data, error } = await supabase
    .from("payments")
    .select(
      "*, invoices(invoice_number, customer_name, total_amount)"
    )
    .order("payment_date", {
      ascending: false,
    })
    .order("id", {
      ascending: false,
    });

  if (error) throw new Error(error.message);

  return data ?? [];
}

export type PaymentDetails =
  Awaited<ReturnType<typeof getPayments>>[number];

// Retrieve financial reports using the secured RPC.

async function getFinancialReport<T>(
  report: string
): Promise<T[]> {
  const { data, error } = await supabase.rpc(
    "secure_financial_report",
    {
      p_report: report,
    }
  );

  if (error) throw new Error(error.message);

  if (data == null) return [];

  if (!Array.isArray(data)) {
    throw new Error(
      "Unexpected financial report format."
    );
  }

  return data as unknown as T[];
}

// Invoice-wise outstanding balances.

export function getReceivables() {
  return getFinancialReport<Receivable>(
    "invoice_receivables"
  );
}

// Outstanding invoices grouped by overdue duration.

export function getReceivablesAgeing() {
  return getFinancialReport<AgeingRow>(
    "receivables_ageing"
  );
}

// Customer-wise financial balances.

export function getCustomerOutstanding() {
  return getFinancialReport<CustomerOutstanding>(
    "customer_outstanding_report"
  );
}

// Record a new payment.

export async function recordPayment(input: {
  invoiceId: number;
  amount: number;
  method: PaymentMethod;
  reference?: string;
}) {
  if (
    !Number.isFinite(input.amount) ||
    input.amount <= 0
  ) {
    throw new Error(
      "Payment amount must be positive."
    );
  }

  if (
    Math.abs(
      input.amount * 100 -
      Math.round(input.amount * 100)
    ) > 0.000001
  ) {
    throw new Error(
      "Payment amount supports only two decimal places."
    );
  }

  const { error } = await supabase.rpc(
    "secure_record_payment",
    {
      p_invoice_id: input.invoiceId,
      p_amount: input.amount,
      p_method: input.method,

      ...(input.reference?.trim()
        ? {
            p_reference: input.reference.trim(),
          }
        : {}),
    }
  );

  if (error) throw new Error(error.message);
}

// Reverse an incorrect payment without deleting it.

export async function reversePayment(
  paymentId: number,
  reason: string
) {
  if (!reason.trim()) {
    throw new Error(
      "A reversal reason is required."
    );
  }

  const { error } = await supabase.rpc(
    "secure_reverse_payment",
    {
      p_payment_id: paymentId,
      p_reason: reason.trim(),
    }
  );

  if (error) throw new Error(error.message);
}
