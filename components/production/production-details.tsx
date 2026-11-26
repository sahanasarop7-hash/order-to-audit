"use client";

import { getLocalizedName } from "@/lib/localized-name";



import { useState } from "react";
import { CheckCircle, XCircle, Undo2 } from "lucide-react";
import { toast } from "sonner";

import {
  postProduction,
  cancelProduction,
  reverseProduction,
  calculateVariance,
  calculateYield,
  calculateProductionCost,
  type ProductionDetails,
  type ProductionSummary,
} from "@/lib/production";

import {
  formatCurrency,
  formatNumber,
  formatDate,
} from "@/lib/format";

import { useLanguage } from "@/contexts/language-context";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/shared/status-badge";

type ProductionAction = "post" | "cancel" | "reverse";

const actionDetails = {
  post: {
    title: "Post production",
    description:
      "Actual material consumption will be deducted from inventory and good output will be added to finished goods. This batch will no longer be editable.",
  },
  cancel: {
    title: "Cancel production",
    description:
      "This production draft will be cancelled without affecting inventory.",
  },
  reverse: {
    title: "Reverse production",
    description:
      "The database will reverse the stock movements if this batch is eligible for reversal.",
  },
};

export function ProductionDetailsDialog({
  run,
  summary,
  role,
  onClose,
  onSuccess,
}: {
  run: ProductionDetails;
  summary?: ProductionSummary;
  role: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t, language } = useLanguage();

  const [action, setAction] =
    useState<ProductionAction | null>(null);

  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const canManage = [
    "admin",
    "production",
  ].includes(role);

  const canPost =
    canManage && run.status === "draft";

  const canReverse =
    role === "admin" && run.status === "posted";

  const actualOutput = run.actual_output ?? 0;

  const yieldPercentage =
    summary?.yield_percentage ??
    calculateYield(
      run.planned_output,
      actualOutput
    );

  const materialRows =
    run.production_consumption.map((item) => {
      const variance = calculateVariance(
        item.planned_quantity,
        item.actual_quantity
      );

      const unitCost =
        run.status === "draft"
          ? item.inventory_items?.average_unit_cost ?? 0
          : item.unit_cost;

      return {
        ...item,
        variance,
        displayUnitCost: unitCost,
      };
    });

  const varianceAlerts = materialRows.filter(
    (item) => item.variance.isAlert
  ).length;

  const estimate = calculateProductionCost(
    materialRows.map((item) => ({
      quantity: item.actual_quantity,
      unitCost: item.displayUnitCost ?? 0,
    })),
    run.labour_cost,
    run.utility_cost,
    actualOutput,
    run.boms?.products?.selling_price ?? 0
  );

  const costing =
    run.status === "posted"
      ? {
          materialCost: summary?.material_cost,
          totalCost: summary?.total_production_cost,
          costPerPacket: summary?.cost_per_packet,
          marginPerPacket: summary?.margin_per_packet,
          marginPercentage: summary?.margin_percentage,
        }
      : run.status === "draft"
        ? estimate
        : null;

  function money(value: number | null | undefined) {
    return value == null
      ? "—"
      : formatCurrency(value);
  }

  function selectAction(value: ProductionAction) {
    setAction(value);
    setReason("");
    setError("");
  }

  async function handleConfirm() {
    if (!action || processing) return;

    setError("");

    if (action !== "post" && !reason.trim()) {
      setError(t("Enter a reason to continue."));
      return;
    }

    setProcessing(true);

    try {
      if (action === "post") {
        await postProduction(run.id);

        toast.success(
          t("Production posted successfully.")
        );
      }

      if (action === "cancel") {
        await cancelProduction(run.id, reason);

        toast.success(
          t("Production cancelled successfully.")
        );
      }

      if (action === "reverse") {
        await reverseProduction(run.id, reason);

        toast.success(
          t("Production reversed successfully.")
        );
      }

      onSuccess();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : t("Unable to complete transaction.")
      );
    } finally {
      setProcessing(false);
    }
  }

  const metrics = [
    {
      label: "Planned output",
      value: formatNumber(run.planned_output),
      color: "text-slate-900",
    },
    {
      label: "Actual good output",
      value: formatNumber(actualOutput),
      color: "text-slate-900",
    },
    {
      label: "Production yield",
      value: `${yieldPercentage.toFixed(2)}%`,
      color:
        Math.abs(yieldPercentage - 100) > 3
          ? "text-amber-600"
          : "text-emerald-600",
    },
    {
      label: "Damaged pouches",
      value: formatNumber(run.damaged_pouches),
      color: "text-slate-900",
    },
    {
      label: "Material variance alerts",
      value: String(varianceAlerts),
      color:
        varianceAlerts > 0
          ? "text-red-600"
          : "text-emerald-600",
    },
  ];

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !processing) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            {run.batch_number}
          </DialogTitle>

          <DialogDescription>
            {t("Production batch details")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">

          {/* Batch information */}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-slate-50 p-4">
            <div>
              <p className="font-semibold">
                {run.boms?.products ? getLocalizedName(run.boms?.products, language) : "—"}
              </p>

              <p className="text-sm text-slate-500">
                {run.boms?.products?.sku}
                {" · BOM V"}
                {run.boms?.version ?? "—"}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {formatDate(run.production_date)}
              </p>
            </div>

            <StatusBadge status={run.status} />
          </div>

          {/* Production metrics */}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-xl border p-3"
              >
                <p className="text-xs text-slate-500">
                  {t(metric.label)}
                </p>

                <p
                  className={`mt-2 text-xl font-bold ${metric.color}`}
                >
                  {metric.value}
                </p>
              </div>
            ))}
          </div>

          {/* Material consumption table */}

          <div className="space-y-3">
            <h3 className="font-semibold">
              {t("Material consumption and variance")}
            </h3>

            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[800px] text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-600">
                  <tr>
                    <th className="p-3">
                      {t("Material")}
                    </th>

                    <th className="p-3">
                      {t("Unit")}
                    </th>

                    <th className="p-3 text-right">
                      {t("Planned")}
                    </th>

                    <th className="p-3 text-right">
                      {t("Actual")}
                    </th>

                    <th className="p-3 text-right">
                      {t("Variance")}
                    </th>

                    <th className="p-3 text-right">
                      {t("Variance %")}
                    </th>

                    <th className="p-3 text-right">
                      {t("Unit cost")}
                    </th>

                    <th className="p-3">
                      {t("Status")}
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {materialRows.map((item) => (
                    <tr
                      key={item.id}
                      className="border-t"
                    >
                      <td className="p-3">
                        <p className="font-medium">
                          {item.inventory_items ? getLocalizedName(item.inventory_items, language) : "—"}
                        </p>

                        <p className="text-xs text-slate-500">
                          {item.inventory_items?.sku}
                        </p>
                      </td>

                      <td className="p-3">
                        {t(item.inventory_items?.unit ?? "—")}
                      </td>

                      <td className="p-3 text-right">
                        {formatNumber(item.planned_quantity)}
                      </td>

                      <td className="p-3 text-right">
                        {formatNumber(item.actual_quantity)}
                      </td>

                      <td className="p-3 text-right">
                        {item.variance.difference > 0
                          ? "+"
                          : ""}
                        {formatNumber(item.variance.difference)}
                      </td>

                      <td
                        className={`p-3 text-right font-medium ${
                          item.variance.isAlert
                            ? "text-red-600"
                            : "text-emerald-600"
                        }`}
                      >
                        {item.variance.percentage === null
                          ? "—"
                          : `${
                              item.variance.percentage > 0
                                ? "+"
                                : ""
                            }${item.variance.percentage.toFixed(2)}%`}
                      </td>

                      <td className="p-3 text-right">
                        {money(item.displayUnitCost)}
                      </td>

                      <td className="p-3">
                        <StatusBadge
                          status={
                            item.variance.isAlert
                              ? "alert"
                              : "within_tolerance"
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-slate-500">
              {t(
                "Absolute material variance exceeding 3% requires review."
              )}
            </p>
          </div>

          {/* Production costing */}

          {costing && (
            <div className="space-y-4 rounded-xl border border-indigo-100 bg-indigo-50 p-4">
              <h3 className="font-semibold text-indigo-900">
                {t(
                  run.status === "draft"
                    ? "Estimated production costing"
                    : "Production costing"
                )}
              </h3>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    label: "Material cost",
                    value: costing.materialCost,
                  },
                  {
                    label: "Labour cost",
                    value: run.labour_cost,
                  },
                  {
                    label: "Utility cost",
                    value: run.utility_cost,
                  },
                  {
                    label: "Total production cost",
                    value: costing.totalCost,
                  },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-xs text-slate-600">
                      {t(item.label)}
                    </p>

                    <p className="mt-1 text-lg font-bold">
                      {money(item.value)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 border-t border-indigo-200 pt-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-slate-600">
                    {t("Cost per packet")}
                  </p>

                  <p className="text-xl font-bold text-indigo-700">
                    {money(costing.costPerPacket)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-600">
                    {t("Margin per packet")}
                  </p>

                  <p
                    className={`text-xl font-bold ${
                      (costing.marginPerPacket ?? 0) < 0
                        ? "text-red-600"
                        : "text-emerald-700"
                    }`}
                  >
                    {money(costing.marginPerPacket)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-600">
                    {t("Margin percentage")}
                  </p>

                  <p className="text-xl font-bold">
                    {costing.marginPercentage == null
                      ? "—"
                      : `${costing.marginPercentage.toFixed(2)}%`}
                  </p>
                </div>
              </div>

              <p className="text-xs text-indigo-700">
                {t(
                  run.status === "draft"
                    ? "Estimated using current weighted average material costs."
                    : "Material costs are based on recorded production consumption costs."
                )}
              </p>

              {run.status === "posted" && !summary && (
                <p className="text-sm text-amber-700">
                  {t("Posted production summary is unavailable.")}
                </p>
              )}
            </div>
          )}

          {run.status === "posted" && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <p className="font-semibold">
                {t("Inventory updated")}
              </p>

              <p className="mt-1">
                {t(
                  "Material consumption and finished goods output have been recorded in the stock ledger."
                )}
              </p>
            </div>
          )}

          {run.status === "cancelled" && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <p className="font-semibold">
                {t("Cancellation reason")}
              </p>

              <p className="mt-1 whitespace-pre-wrap">
                {run.cancellation_reason || "—"}
              </p>
            </div>
          )}

          {/* Transaction actions */}

          {!action && (
            <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
              <Button
                variant="outline"
                onClick={onClose}
              >
                {t("Close")}
              </Button>

              {canPost && (
                <>
                  <Button
                    variant="destructive"
                    onClick={() =>
                      selectAction("cancel")
                    }
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    {t("Cancel production")}
                  </Button>

                  <Button
                    onClick={() =>
                      selectAction("post")
                    }
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    {t("Post production")}
                  </Button>
                </>
              )}

              {canReverse && (
                <Button
                  variant="destructive"
                  onClick={() =>
                    selectAction("reverse")
                  }
                >
                  <Undo2 className="mr-2 h-4 w-4" />
                  {t("Reverse production")}
                </Button>
              )}
            </div>
          )}

          {/* Confirmation */}

          {action && (
            <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="font-semibold">
                {t(actionDetails[action].title)}
              </h3>

              <p className="text-sm text-slate-700">
                {t(actionDetails[action].description)}
              </p>

              {action !== "post" && (
                <Textarea
                  aria-label={t("Reason")}
                  placeholder={t("Enter reason...")}
                  value={reason}
                  disabled={processing}
                  onChange={(e) =>
                    setReason(e.target.value)
                  }
                />
              )}

              {error && (
                <p
                  role="alert"
                  className="rounded-lg bg-red-100 p-3 text-sm text-red-700"
                >
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  disabled={processing}
                  onClick={() => {
                    setAction(null);
                    setError("");
                  }}
                >
                  {t("Back")}
                </Button>

                <Button
                  disabled={processing}
                  variant={
                    action === "post"
                      ? "default"
                      : "destructive"
                  }
                  onClick={handleConfirm}
                >
                  {t(
                    processing
                      ? "Processing..."
                      : "Confirm"
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
