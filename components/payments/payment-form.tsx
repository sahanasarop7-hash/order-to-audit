
"use client";

import { useState } from "react";

import {
  recordPayment,
  type Receivable,
  type PaymentMethod,
} from "@/lib/payments";

import {
  formatCurrency,
  formatDate,
} from "@/lib/format";

import { useLanguage } from "@/contexts/language-context";

import { MasterDialog } from "@/components/masters/master-dialog";

import {
  MasterField,
  MasterSelect,
} from "@/components/masters/master-form-fields";

import { Button } from "@/components/ui/button";

export function PaymentForm({
  receivables,
  initialInvoiceId,
  onSuccess,
  onCancel,
}: {
  receivables: Receivable[];
  initialInvoiceId?: number;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();

  const [invoiceId, setInvoiceId] = useState(
    String(initialInvoiceId ?? "")
  );

  const [amount, setAmount] = useState("");

  const [method, setMethod] =
    useState<PaymentMethod>("cash");

  const [reference, setReference] =
    useState("");

  // Only invoices with outstanding balances
  // can receive new payments.

  const eligibleInvoices = receivables.filter(
    (invoice) =>
      invoice.outstanding_amount > 0
  );

  const selectedInvoice = eligibleInvoices.find(
    (invoice) =>
      String(invoice.invoice_id) === invoiceId
  );

  const outstanding =
    selectedInvoice?.outstanding_amount ?? 0;

  const enteredAmount = Number(amount);

  const validAmount =
    amount.trim() !== "" &&
    Number.isFinite(enteredAmount) &&
    enteredAmount > 0;

  // Use integer paise for the balance preview.

  const remainingBalance =
    (
      Math.round(outstanding * 100) -
      Math.round(enteredAmount * 100)
    ) / 100;

  const overpayment =
    validAmount &&
    Math.round(enteredAmount * 100) >
      Math.round(outstanding * 100);

  async function handleSave() {
    if (!selectedInvoice) {
      throw new Error(
        "Select an invoice with an outstanding balance."
      );
    }

    if (!validAmount) {
      throw new Error(
        "Enter a valid positive payment amount."
      );
    }

    if (
      Math.abs(
        enteredAmount * 100 -
        Math.round(enteredAmount * 100)
      ) > 0.000001
    ) {
      throw new Error(
        "Payment amount supports only two decimal places."
      );
    }

    if (overpayment) {
      throw new Error(
        `Payment exceeds outstanding balance of ${formatCurrency(outstanding)}.`
      );
    }

    await recordPayment({
      invoiceId: selectedInvoice.invoice_id,
      amount: enteredAmount,
      method,
      reference,
    });
  }

  return (
    <MasterDialog
      title="Record payment"
      description="Record a customer payment against an outstanding invoice."
      onSave={handleSave}
      onSuccess={onSuccess}
      onCancel={onCancel}
    >
      <div className="space-y-5">

        {/* Invoice selection */}

        <MasterSelect
          label="Invoice"
          value={invoiceId}
          onChange={(value) => {
            setInvoiceId(value);
            setAmount("");
          }}
          required
        >
          <option value="">
            {t("Select invoice")}
          </option>

          {eligibleInvoices.map((invoice) => (
            <option
              key={invoice.invoice_id}
              value={invoice.invoice_id}
            >
              {invoice.invoice_number} —{" "}
              {invoice.customer_name} —{" "}
              {formatCurrency(
                invoice.outstanding_amount
              )}
            </option>
          ))}
        </MasterSelect>

        {eligibleInvoices.length === 0 && (
          <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
            {t("There are no outstanding invoices.")}
          </p>
        )}

        {/* Selected invoice information */}

        {selectedInvoice && (
          <div className="space-y-4 rounded-xl border bg-slate-50 p-4">
            <div>
              <p className="font-semibold">
                {selectedInvoice.customer_name}
              </p>

              <p className="text-xs text-slate-500">
                {selectedInvoice.invoice_number}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {t("Due date")}:{" "}
                {selectedInvoice.due_date
                  ? formatDate(
                      selectedInvoice.due_date
                    )
                  : "—"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-500">
                  {t("Invoice total")}
                </p>

                <p className="font-semibold">
                  {formatCurrency(
                    selectedInvoice.total_amount
                  )}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  {t("Amount paid")}
                </p>

                <p className="font-semibold text-emerald-700">
                  {formatCurrency(
                    selectedInvoice.amount_paid
                  )}
                </p>
              </div>
            </div>

            <div className="border-t pt-3">
              <p className="text-xs text-slate-500">
                {t("Outstanding balance")}
              </p>

              <p className="text-xl font-bold text-amber-600">
                {formatCurrency(outstanding)}
              </p>
            </div>
          </div>
        )}

        {/* Payment amount */}

        <MasterField
          label="Payment amount (INR)"
          type="number"
          value={amount}
          onChange={setAmount}
          min={0.01}
          step="0.01"
          required
        />

        {selectedInvoice && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setAmount(outstanding.toFixed(2))
            }
          >
            {t("Pay full outstanding amount")}
          </Button>
        )}

        {overpayment && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {t("Payment exceeds outstanding balance.")}
          </p>
        )}

        {/* Payment method */}

        <MasterSelect
          label="Payment method"
          value={method}
          onChange={(value) =>
            setMethod(value as PaymentMethod)
          }
          required
        >
          <option value="cash">
            {t("Cash")}
          </option>

          <option value="upi">
            {t("UPI")}
          </option>

          <option value="bank_transfer">
            {t("Bank transfer")}
          </option>

          <option value="cheque">
            {t("Cheque")}
          </option>
        </MasterSelect>

        <MasterField
          label="Reference number"
          value={reference}
          onChange={setReference}
          placeholder="Transaction ID or receipt number"
        />

        {/* Remaining balance preview */}

        {selectedInvoice &&
          validAmount &&
          !overpayment && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
              <p className="text-sm text-indigo-800">
                {t("Remaining outstanding")}
              </p>

              <p className="mt-1 text-2xl font-bold text-indigo-700">
                {formatCurrency(remainingBalance)}
              </p>

              <p className="mt-2 text-xs text-indigo-700">
                {remainingBalance === 0
                  ? t("Invoice will be fully paid.")
                  : t("Invoice will remain partially paid.")}
              </p>
            </div>
          )}

        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          {t(
            "Saving records the payment immediately. Verify the amount and payment method before continuing."
          )}
        </p>
      </div>
    </MasterDialog>
  );
}
