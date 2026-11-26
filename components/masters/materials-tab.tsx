"use client";

import { useState } from "react";

import {
  getMaterials,
  saveMaterial,
  type Material,
} from "@/lib/masters";

import {
  formatCurrency,
  formatNumber,
} from "@/lib/format";

import { getLocalizedName } from "@/lib/localized-name";
import { useLanguage } from "@/contexts/language-context";
import { StatusBadge } from "@/components/shared/status-badge";

import { MasterSection } from "./master-section";
import { MasterDialog } from "./master-dialog";

import {
  MasterField,
  MasterSelect,
  ActiveField,
} from "./master-form-fields";

function MaterialForm({
  record,
  onSuccess,
  onCancel,
}: {
  record: Material | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();

  const [name, setName] = useState(record?.name ?? "");
  const [nameTa, setNameTa] = useState(record?.name_ta ?? "");
  const [nameHi, setNameHi] = useState(record?.name_hi ?? "");
  const [sku, setSku] = useState(record?.sku ?? "");

  const [category, setCategory] = useState(
    record?.category ?? "raw_material"
  );

  const [unit, setUnit] = useState(record?.unit ?? "kg");

  const [reorder, setReorder] = useState(
    String(record?.reorder_level ?? 0)
  );

  const [active, setActive] = useState(
    record?.is_active ?? true
  );

  async function handleSave() {
    if (!name.trim() || !sku.trim()) {
      throw new Error("Material name and SKU are required.");
    }

    const reorderLevel = Number(reorder);

    if (!Number.isFinite(reorderLevel) || reorderLevel < 0) {
      throw new Error("Enter a valid reorder level.");
    }

    if (unit === "piece" && !Number.isInteger(reorderLevel)) {
      throw new Error(
        "Reorder level must be a whole number for pieces."
      );
    }

    await saveMaterial(
      {
        name: name.trim(),
          name_ta: nameTa.trim() || null,
          name_hi: nameHi.trim() || null,
        sku: sku.trim().toUpperCase(),
        category,
        unit,
        reorder_level: reorderLevel,
        is_active: active,
      },
      record?.id
    );
  }

  return (
    <MasterDialog
      title={record ? "Edit material" : "Add material"}
      description="Manage raw materials and packaging items."
      onSave={handleSave}
      onSuccess={onSuccess}
      onCancel={onCancel}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <MasterField
          label="Material name"
          value={name}
          onChange={setName}
          required
        />

        <MasterField label="Tamil name (optional)" value={nameTa} onChange={setNameTa} />
            <MasterField label="Hindi name (optional)" value={nameHi} onChange={setNameHi} />
            <MasterField
          label="SKU"
          value={sku}
          onChange={setSku}
          required
        />

        <MasterSelect
          label="Category"
          value={category}
          onChange={setCategory}
          required
        >
          <option value="raw_material">
            {t("Raw material")}
          </option>

          <option value="packaging">
            {t("Packaging")}
          </option>
        </MasterSelect>

        <MasterSelect
          label="Base unit"
          value={unit}
          onChange={setUnit}
          required
        >
          <option value="kg">{t("Kilogram")}</option>
          <option value="litre">{t("Litre")}</option>
          <option value="piece">{t("Piece")}</option>
        </MasterSelect>

        <MasterField
          label="Reorder level"
          value={reorder}
          onChange={setReorder}
          type="number"
          min={0}
          step={unit === "piece" ? "1" : "0.001"}
          required
        />
      </div>

      {record && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4">
          <p className="text-sm font-medium text-indigo-900">
            {t("Weighted average unit cost")}
          </p>

          <p className="mt-1 text-xl font-semibold text-indigo-700">
            {formatCurrency(record.average_unit_cost)}
            <span className="ml-1 text-sm font-normal">
              / {t(record.unit)}
            </span>
          </p>

          <p className="mt-2 text-xs text-indigo-700">
            {t("Automatically calculated from purchase transactions.")}
          </p>
        </div>
      )}

      <ActiveField value={active} onChange={setActive} />
    </MasterDialog>
  );
}

export function MaterialsTab({
  canEdit,
}: {
  canEdit: boolean;
}) {
  const { t, language } = useLanguage();

  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");

  return (
    <MasterSection<Material>
      title="Raw and packaging materials"
      description="Manage ingredients, packaging and reorder levels."
      addLabel="Add material"
      canEdit={canEdit}
      load={getMaterials}
      searchValue={(row) =>
        `${getLocalizedName(row, language)} ${row.sku} ${row.category} ${row.unit}`
      }
      filterRow={(row) =>
        (category === "all" || row.category === category) &&
        (status === "all" ||
          row.is_active === (status === "active"))
      }
      filters={
        <>
          <select
            aria-label={t("Category")}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-10 rounded-md border bg-white px-3 text-sm"
          >
            <option value="all">
              {t("All categories")}
            </option>

            <option value="raw_material">
              {t("Raw material")}
            </option>

            <option value="packaging">
              {t("Packaging")}
            </option>
          </select>

          <select
            aria-label={t("Status")}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 rounded-md border bg-white px-3 text-sm"
          >
            <option value="all">{t("All statuses")}</option>
            <option value="active">{t("active")}</option>
            <option value="inactive">{t("inactive")}</option>
          </select>
        </>
      }
      columns={[
        {
          key: "name",
          header: t("Material name"),
          render: (row) => (
            <span className="font-medium text-slate-900">
              {getLocalizedName(row, language)}
            </span>
          ),
          sortValue: (row) => getLocalizedName(row, language),
        },
        {
          key: "sku",
          header: t("SKU"),
          render: (row) => row.sku,
          sortValue: (row) => row.sku,
        },
        {
          key: "category",
          header: t("Category"),
          render: (row) =>
            t(
              row.category === "raw_material"
                ? "Raw material"
                : "Packaging"
            ),
        },
        {
          key: "unit",
          header: t("Base unit"),
          render: (row) => t(row.unit),
        },
        {
          key: "cost",
          header: t("Average unit cost"),
          render: (row) =>
            formatCurrency(row.average_unit_cost),
          sortValue: (row) => row.average_unit_cost,
        },
        {
          key: "reorder",
          header: t("Reorder level"),
          render: (row) =>
            `${formatNumber(row.reorder_level)} ${t(row.unit)}`,
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
        <MaterialForm
          record={record}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      )}
    />
  );
}