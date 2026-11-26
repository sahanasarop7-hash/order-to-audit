"use client";

import { useCallback, useEffect, useState } from "react";

import {
  IndianRupee,
  Wallet,
  Factory,
  ShoppingCart,
  Banknote,
  AlertTriangle,
  RefreshCw,
  Truck,
  Package,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { useLanguage } from "@/contexts/language-context";

import {
  getDashboardData,
  getReorderAlerts,
} from "@/lib/dashboard";

import {
  formatCurrency,
  formatNumber,
  formatPercentage,
  currentMonthRange,
} from "@/lib/format";

import type {
  DashboardData,
  ReorderAlert,
} from "@/types/dashboard";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";

import {
  LoadingState,
  ErrorState,
} from "@/components/shared/page-state";

import {
  DateRangeFilter,
  type DateRange,
} from "@/components/shared/date-range-filter";

import { KPICard } from "@/components/dashboard/kpi-card";
import { ProductionChart } from "@/components/dashboard/production-chart";
import { InventoryAlerts } from "@/components/dashboard/inventory-alerts";

import {
  RecentOrders,
  type RecentOrder,
} from "@/components/dashboard/recent-orders";

export default function DashboardPage() {
  const { profile } = useAuth();
  const { t } = useLanguage();

  const role = profile?.role;

  const financialAccess =
    role === "admin" ||
    role === "accountant" ||
    role === "owner";

  const productionAccess =
    financialAccess || role === "production";

  const salesAccess =
    financialAccess || role === "salesman";

  const [range, setRange] = useState<DateRange>(
    currentMonthRange
  );

  const [summary, setSummary] =
    useState<DashboardData | null>(null);

  const [alerts, setAlerts] =
    useState<ReorderAlert[]>([]);

  const [orders, setOrders] =
    useState<RecentOrder[]>([]);

  const [orderCounts, setOrderCounts] = useState({
    pending: 0,
    dispatched: 0,
  });

  const [production, setProduction] = useState({
    planned: 0,
    actual: 0,
    batches: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    if (!role) return;

    if (!range.start || !range.end || range.start > range.end) {
      setError("Please select a valid date range.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (financialAccess) {
        const result = await getDashboardData(
          range.start,
          range.end
        );

        setSummary(result);

        setProduction({
          planned: result.planned_output,
          actual: result.actual_output,
          batches: result.production_batches,
        });
      }

      if (productionAccess) {
        const result = await getReorderAlerts();
        setAlerts(result);
      }

      if (role === "production") {
        const { data, error } = await supabase
          .from("production_summary_report")
          .select("planned_output, actual_output")
          .gte("production_date", range.start)
          .lte("production_date", range.end);

        if (error) throw error;

        const rows = data ?? [];

        setProduction({
          planned: rows.reduce(
            (sum, row) =>
              sum + Number(row.planned_output ?? 0),
            0
          ),
          actual: rows.reduce(
            (sum, row) =>
              sum + Number(row.actual_output ?? 0),
            0
          ),
          batches: rows.length,
        });
      }

      if (salesAccess) {
        const { data, error } = await supabase
          .from("sales_orders")
          .select(
            "id, order_number, order_date, status, customers(name)"
          )
          .gte("order_date", range.start)
          .lte("order_date", range.end)
          .order("order_date", { ascending: false })
          .order("id", { ascending: false })
          .limit(10);

        if (error) throw error;

        setOrders(
          (data ?? []) as unknown as RecentOrder[]
        );
      }

      if (role === "salesman") {
        const [pending, dispatched] = await Promise.all([
          supabase
            .from("sales_orders")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending"),

          supabase
            .from("sales_orders")
            .select("id", { count: "exact", head: true })
            .eq("status", "dispatched")
            .gte("order_date", range.start)
            .lte("order_date", range.end),
        ]);

        if (pending.error) throw pending.error;
        if (dispatched.error) throw dispatched.error;

        setOrderCounts({
          pending: pending.count ?? 0,
          dispatched: dispatched.count ?? 0,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "object" &&
              error !== null &&
              "message" in error
            ? String(error.message)
            : "Unable to load dashboard.";

      setError(message);
    } finally {
      setLoading(false);
    }
  }, [
    role,
    financialAccess,
    productionAccess,
    salesAccess,
    range.start,
    range.end,
  ]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const productionYield =
    production.planned > 0
      ? (production.actual / production.planned) * 100
      : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Business overview")}
        description={`${t("Welcome back")}, ${profile?.full_name ?? ""}.`}
        actions={
          <Button
            variant="outline"
            onClick={loadDashboard}
            disabled={loading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${
                loading ? "animate-spin" : ""
              }`}
            />
            {t("Refresh")}
          </Button>
        }
      />

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <DateRangeFilter
          value={range}
          onChange={setRange}
        />
      </div>

      {loading ? (
        <LoadingState message={t("Loading data...")} />
      ) : error ? (
        <ErrorState
          message={error}
          onRetry={loadDashboard}
        />
      ) : (
        <>
          {financialAccess && summary && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <KPICard
                title={t("Net sales")}
                value={formatCurrency(summary.net_sales)}
                icon={IndianRupee}
                tone="indigo"
                description="Selected reporting period"
              />

              <KPICard
                title={t("Outstanding")}
                value={formatCurrency(
                  summary.outstanding_amount
                )}
                icon={Wallet}
                tone="amber"
                description="Current unpaid balance"
              />

              <KPICard
                title={t("Production yield")}
                value={formatPercentage(
                  summary.production_yield
                )}
                icon={Factory}
                tone="green"
              />

              <KPICard
                title={t("Pending orders")}
                value={formatNumber(
                  summary.pending_orders
                )}
                icon={ShoppingCart}
                tone="blue"
                description="Current pending orders"
              />

              <KPICard
                title={t("Payments collected")}
                value={formatCurrency(
                  summary.payments_collected
                )}
                icon={Banknote}
                tone="green"
                description="Selected reporting period"
              />

              <KPICard
                title={t("Low stock alerts")}
                value={summary.reorder_alert_count}
                icon={AlertTriangle}
                tone="amber"
                description="Current inventory position"
              />
            </div>
          )}

          {role === "production" && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <KPICard
                title={t("Production")}
                value={production.batches}
                icon={Factory}
              />

              <KPICard
                title={t("Production yield")}
                value={formatPercentage(productionYield)}
                icon={Package}
                tone="green"
              />

              <KPICard
                title={t("Low stock alerts")}
                value={alerts.length}
                icon={AlertTriangle}
                tone="amber"
              />
            </div>
          )}

          {role === "salesman" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <KPICard
                title={t("Pending orders")}
                value={orderCounts.pending}
                icon={ShoppingCart}
                tone="amber"
              />

              <KPICard
                title={t("dispatched")}
                value={orderCounts.dispatched}
                icon={Truck}
                tone="green"
              />
            </div>
          )}

          {productionAccess && (
            <div className="grid gap-6 xl:grid-cols-2">
              <ProductionChart
                planned={production.planned}
                actual={production.actual}
              />

              <InventoryAlerts alerts={alerts} />
            </div>
          )}

          {financialAccess && summary && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />

                <h2 className="font-semibold text-amber-900">
                  {t("Attention required")}
                </h2>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-sm text-amber-800">
                    {t("Material variance alerts")}
                  </p>

                  <p className="mt-1 text-xl font-semibold text-amber-900">
                    {summary.material_variance_alerts}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-amber-800">
                    {t("Production yield alerts")}
                  </p>

                  <p className="mt-1 text-xl font-semibold text-amber-900">
                    {summary.yield_alerts}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-amber-800">
                    {t("Overdue amount")}
                  </p>

                  <p className="mt-1 text-xl font-semibold text-amber-900">
                    {formatCurrency(summary.overdue_amount)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {salesAccess && (
            <RecentOrders orders={orders} />
          )}
        </>
      )}
    </div>
  );
}