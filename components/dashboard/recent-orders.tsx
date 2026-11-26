"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate } from "@/lib/format";
import { useLanguage } from "@/contexts/language-context";

export type RecentOrder = {
  id: number;
  order_number: string;
  order_date: string;
  status: string;
  customers: {
    name: string;
  } | null;
};

export function RecentOrders({
  orders,
}: {
  orders: RecentOrder[];
}) {
  const { t } = useLanguage();

  const columns: Column<RecentOrder>[] = [
    {
      key: "number",
      header: t("Order number"),
      render: (row) => (
        <span className="font-medium text-indigo-600">
          {row.order_number}
        </span>
      ),
      sortValue: (row) => row.order_number,
    },
    {
      key: "customer",
      header: t("Customer"),
      render: (row) => row.customers?.name ?? "—",
      sortValue: (row) => row.customers?.name ?? "",
    },
    {
      key: "date",
      header: t("Date"),
      render: (row) => formatDate(row.order_date),
      sortValue: (row) => row.order_date,
    },
    {
      key: "status",
      header: t("Status"),
      render: (row) => (
        <StatusBadge status={row.status} />
      ),
    },
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">
          {t("Recent sales orders")}
        </h2>

        <Link
          href="/sales"
          className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline"
        >
          {t("View")}
          <ArrowRight size={15} />
        </Link>
      </div>

      <DataTable
        data={orders}
        columns={columns}
        rowKey={(row) => row.id}
        searchValue={(row) =>
          `${row.order_number} ${row.customers?.name ?? ""} ${row.status}`
        }
        searchPlaceholder={t("Search records...")}
        pageSize={5}
      />
    </section>
  );
}