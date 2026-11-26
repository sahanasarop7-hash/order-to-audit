"use client";

import { useAuth } from "@/contexts/auth-context";
import { useLanguage } from "@/contexts/language-context";

import { ProductsTab } from "@/components/masters/products-tab";

export default function MastersPage() {
  const { profile } = useAuth();
  const { t } = useLanguage();

  const role = profile?.role;

  const allowed =
    role === "admin" ||
    role === "production" ||
    role === "accountant" ||
    role === "owner";

  if (!allowed) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center">
        {t("Access denied.")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {t("Master Data")}
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          {t("Manage your business master records.")}
        </p>
      </div>

      <ProductsTab canEdit={role === "admin"} />
    </div>
  );
}