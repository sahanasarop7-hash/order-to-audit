"use client";

import { useState, type FormEvent } from "react";

import {
  getProducts,
  saveProduct,
  type Product,
} from "@/lib/masters";

import {
  formatCurrency,
  formatNumber,
} from "@/lib/format";

import { useLanguage } from "@/contexts/language-context";

import { MasterSection } from "./master-section";

import {
  MasterField,
  ActiveField,
} from "./master-form-fields";

import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

function ProductForm({
  record,
  onSuccess,
  onCancel,
}: {
  record: Product | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();

  const [name, setName] = useState(record?.name ?? "");
  const [sku, setSku] = useState(record?.sku ?? "");

  const [packetSize, setPacketSize] = useState(
    String(record?.packet_size_g ?? "")
  );

  const [price, setPrice] = useState(
    String(record?.selling_price ?? "")
  );

  const [gst, setGst] = useState(
    String(record?.gst_rate ?? 5)
  );

  const [hsn, setHsn] = useState(
    record?.hsn_code ?? ""
  );

  const [carton, setCarton] = useState(
    String(record?.packets_per_carton ?? "")
  );

  const [reorder, setReorder] = useState(
    String(record?.reorder_level ?? 0)
  );

  const [active, setActive] = useState(
    record?.is_active ?? true
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim() || !sku.trim()) {
      setError("Product name and SKU are required.");
      return;
    }

    setSaving(true);

    try {
      await saveProduct(
        {
          name: name.trim(),
          sku: sku.trim().toUpperCase(),
          packet_size_g: Number(packetSize),
          selling_price: Number(price),
          gst_rate: Number(gst),
          hsn_code: hsn.trim() || null,
          packets_per_carton: carton
            ? Number(carton)
            : null,
          reorder_level: Number(reorder),
          is_active: active,
        },
        record?.id
      );

      onSuccess();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to save product."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onCancel();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {t(record ? "Edit product" : "Add product")}
          </DialogTitle>

          <DialogDescription>
            {t("Manage product pricing and packaging details.")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <MasterField
              label="Product name"
              value={name}
              onChange={setName}
              required
            />

            <MasterField
              label="SKU"
              value={sku}
              onChange={setSku}
              required
            />

            <MasterField
              label="Packet size (g)"
              value={packetSize}
              onChange={setPacketSize}
              type="number"
              min={1}
              step="1"
              required
            />

            <MasterField
              label="Selling price (₹)"
              value={price}
              onChange={setPrice}
              type="number"
              min={0}
              step="0.01"
              required
            />

            <MasterField
              label="GST rate (%)"
              value={gst}
              onChange={setGst}
              type="number"
              min={0}
              max={100}
              step="0.01"
              required
            />

            <MasterField
              label="HSN code"
              value={hsn}
              onChange={setHsn}
            />

            <MasterField
              label="Packets per carton"
              value={carton}
              onChange={setCarton}
              type="number"
              min={1}
              step="1"
            />

            <MasterField
              label="Reorder level"
              value={reorder}
              onChange={setReorder}
              type="number"
              min={0}
              step="1"
              required
            />
          </div>

          <ActiveField
            value={active}
            onChange={setActive}
          />

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={saving}
            >
              {t("Cancel")}
            </Button>

            <Button type="submit" disabled={saving}>
              {t(saving ? "Saving..." : "Save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProductsTab({
  canEdit,
}: {
  canEdit: boolean;
}) {
  const { t } = useLanguage();
  const [status, setStatus] = useState("all");

  return (
    <MasterSection<Product>
      title="Products"
      description="Manage finished goods, pricing and GST."
      addLabel="Add product"
      canEdit={canEdit}
      load={getProducts}
      searchValue={(row) =>
        `${row.name} ${row.sku} ${row.hsn_code ?? ""}`
      }
      filterRow={(row) =>
        status === "all" ||
        row.is_active === (status === "active")
      }
      filters={
        <select
          aria-label={t("Status")}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        >
          <option value="all">{t("All statuses")}</option>
          <option value="active">{t("active")}</option>
          <option value="inactive">{t("inactive")}</option>
        </select>
      }
      columns={[
        {
          key: "name",
          header: t("Product name"),
          render: (row) => (
            <span className="font-medium text-slate-900">
              {row.name}
            </span>
          ),
          sortValue: (row) => row.name,
        },
        {
          key: "sku",
          header: t("SKU"),
          render: (row) => row.sku,
          sortValue: (row) => row.sku,
        },
        {
          key: "size",
          header: t("Packet size (g)"),
          render: (row) => `${row.packet_size_g} g`,
          sortValue: (row) => row.packet_size_g,
        },
        {
          key: "price",
          header: t("Selling price (₹)"),
          render: (row) => formatCurrency(row.selling_price),
          sortValue: (row) => row.selling_price,
        },
        {
          key: "gst",
          header: t("GST rate (%)"),
          render: (row) => `${row.gst_rate}%`,
          sortValue: (row) => row.gst_rate,
        },
        {
          key: "reorder",
          header: t("Reorder level"),
          render: (row) => formatNumber(row.reorder_level),
          sortValue: (row) => row.reorder_level,
        },
        {
          key: "status",
          header: t("Status"),
          render: (row) => (
            <StatusBadge
              status={row.is_active ? "active" : "inactive"}
            />
          ),
        },
      ]}
      renderForm={(record, onSuccess, onCancel) => (
        <ProductForm
          record={record}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      )}
    />
  );
}