"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";

import type { ReorderAlert } from "@/types/dashboard";
import { formatNumber } from "@/lib/format";
import { StatusBadge } from "@/components/shared/status-badge";
import { useLanguage } from "@/contexts/language-context";

export function InventoryAlerts({
  alerts,
}: {
  alerts: ReorderAlert[];
}) {
  const { t } = useLanguage();

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">
          {t("Low stock alerts")}
        </h2>

        <Link
          href="/inventory"
          className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline"
        >
          {t("View")}
          <ArrowRight size={15} />
        </Link>
      </div>

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <CheckCircle2 className="mb-3 h-9 w-9 text-emerald-500" />

          <p className="text-sm text-slate-500">
            {t("No matching records found.")}
          </p>
        </div>
      ) : (
        <div className="mt-4 max-h-80 divide-y divide-slate-100 overflow-y-auto">
          {alerts.map((item) => (
            <div
              key={`${item.category}-${item.item_id}`}
              className="flex items-start gap-3 py-4"
            >
              <div className="rounded-lg bg-amber-50 p-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">
                  {item.item_name}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {item.sku}
                </p>

                <p className="mt-2 text-sm text-slate-700">
                  {formatNumber(item.available_stock)}
                  {" "}{item.unit}
                  {" / "}
                  {formatNumber(item.reorder_level)}
                  {" "}{item.unit}
                </p>
              </div>

              <StatusBadge status={item.alert_status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}