"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

import { useLanguage } from "@/contexts/language-context";
import { formatNumber } from "@/lib/format";

export function ProductionChart({
  planned,
  actual,
}: {
  planned: number;
  actual: number;
}) {
  const { t } = useLanguage();

  const data = [
    {
      name: t("Planned"),
      quantity: planned,
      color: "#4F46E5",
    },
    {
      name: t("Actual"),
      quantity: actual,
      color: "#10B981",
    },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">
        {t("Production performance")}
      </h2>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-slate-500">
            {t("Planned")}
          </p>

          <p className="mt-1 text-xl font-semibold text-indigo-600">
            {formatNumber(planned)}
          </p>
        </div>

        <div>
          <p className="text-sm text-slate-500">
            {t("Actual")}
          </p>

          <p className="mt-1 text-xl font-semibold text-emerald-600">
            {formatNumber(actual)}
          </p>
        </div>
      </div>

      <div className="mt-6 h-64 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 10, right: 10, left: -15, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#E2E8F0"
            />

            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: "#64748B" }}
              axisLine={false}
              tickLine={false}
            />

            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 12, fill: "#64748B" }}
              axisLine={false}
              tickLine={false}
            />

            <Tooltip
              cursor={{ fill: "#F8FAFC" }}
              contentStyle={{
                borderRadius: "10px",
                border: "1px solid #E2E8F0",
              }}
            />

            <Bar
              dataKey="quantity"
              name={t("Production")}
              radius={[6, 6, 0, 0]}
              maxBarSize={70}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={entry.color}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}