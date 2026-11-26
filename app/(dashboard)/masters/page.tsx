"use client";

import {
  Package,
  Users,
  Truck,
  Boxes,
  ClipboardList,
} from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
import { useLanguage } from "@/contexts/language-context";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import { ProductsTab } from "@/components/masters/products-tab";
import { CustomersTab } from "@/components/masters/customers-tab";
import { SuppliersTab } from "@/components/masters/suppliers-tab";
import { MaterialsTab } from "@/components/masters/materials-tab";
import { BOMsTab } from "@/components/masters/boms-tab";

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

  const isAdmin = role === "admin";

  const canViewCustomers =
    isAdmin ||
    role === "accountant" ||
    role === "owner";

  const canEditSuppliers =
    isAdmin || role === "accountant";

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

      <Tabs defaultValue="products" className="space-y-6">
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-auto min-w-max gap-1 rounded-xl border bg-white p-1.5">
            <TabsTrigger
              value="products"
              className="gap-2 px-4 py-2.5"
            >
              <Package size={16} />
              {t("Products")}
            </TabsTrigger>

            {canViewCustomers && (
              <TabsTrigger
                value="customers"
                className="gap-2 px-4 py-2.5"
              >
                <Users size={16} />
                {t("Customers")}
              </TabsTrigger>
            )}

            <TabsTrigger
              value="suppliers"
              className="gap-2 px-4 py-2.5"
            >
              <Truck size={16} />
              {t("Suppliers")}
            </TabsTrigger>

            <TabsTrigger
              value="materials"
              className="gap-2 px-4 py-2.5"
            >
              <Boxes size={16} />
              {t("Materials")}
            </TabsTrigger>
            <TabsTrigger
                value="boms"
                className="gap-2 px-4 py-2.5"
            >
              <ClipboardList size={16} />
              {t("Bill of materials")}
            </TabsTrigger>
            </TabsList>
        </div>

        <TabsContent value="products">
          <ProductsTab canEdit={isAdmin} />
        </TabsContent>

        {canViewCustomers && (
          <TabsContent value="customers">
            <CustomersTab canEdit={isAdmin} />
          </TabsContent>
        )}

        <TabsContent value="suppliers">
          <SuppliersTab canEdit={canEditSuppliers} />
        </TabsContent>

        <TabsContent value="materials">
          <MaterialsTab canEdit={isAdmin} />
        </TabsContent>

        <TabsContent value="boms">
          <BOMsTab canEdit={isAdmin || role === "production"}/>
        </TabsContent>
      </Tabs>
    </div>
  );
}