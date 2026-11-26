"use client";

import { useState } from "react";

import {
  getSuppliers,
  saveSupplier,
  type Supplier,
} from "@/lib/masters";

import {
  INDIAN_STATES,
  getStateName,
  validateGSTIN,
} from "@/lib/states";

import { useLanguage } from "@/contexts/language-context";
import { StatusBadge } from "@/components/shared/status-badge";

import { MasterSection } from "./master-section";
import { MasterDialog } from "./master-dialog";

import {
  MasterField,
  MasterSelect,
  ActiveField,
} from "./master-form-fields";

function SupplierForm({
  record,
  onSuccess,
  onCancel,
}: {
  record: Supplier | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();

  const [code, setCode] = useState(
    record?.supplier_code ?? ""
  );

  const [name, setName] = useState(record?.name ?? "");

  const [contact, setContact] = useState(
    record?.contact_person ?? ""
  );

  const [phone, setPhone] = useState(record?.phone ?? "");
  const [email, setEmail] = useState(record?.email ?? "");
  const [gstin, setGstin] = useState(record?.gstin ?? "");

  const [address, setAddress] = useState(
    record?.address ?? ""
  );

  const [stateCode, setStateCode] = useState(
    record?.state_code ?? "33"
  );

  const [active, setActive] = useState(
    record?.is_active ?? true
  );

  async function handleSave() {
    if (!name.trim() || !code.trim()) {
      throw new Error(
        "Supplier name and supplier code are required."
      );
    }

    await saveSupplier(
      {
        supplier_code: code.trim().toUpperCase(),
        name: name.trim(),
        contact_person: contact.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        gstin: validateGSTIN(gstin, stateCode),
        address: address.trim() || null,
        state: getStateName(stateCode),
        state_code: stateCode,
        is_active: active,
      },
      record?.id
    );
  }

  return (
    <MasterDialog
      title={record ? "Edit supplier" : "Add supplier"}
      description="Manage supplier contact and tax details."
      onSave={handleSave}
      onSuccess={onSuccess}
      onCancel={onCancel}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <MasterField
          label="Supplier code"
          value={code}
          onChange={setCode}
          required
        />

        <MasterField
          label="Supplier name"
          value={name}
          onChange={setName}
          required
        />

        <MasterField
          label="Contact person"
          value={contact}
          onChange={setContact}
        />

        <MasterField
          label="Phone"
          value={phone}
          onChange={setPhone}
          type="tel"
        />

        <MasterField
          label="Email"
          value={email}
          onChange={setEmail}
          type="email"
        />

        <MasterSelect
          label="State"
          value={stateCode}
          onChange={setStateCode}
          required
        >
          {INDIAN_STATES.map((state) => (
            <option key={state.code} value={state.code}>
              {t(state.name)} ({state.code})
            </option>
          ))}
        </MasterSelect>

        <MasterField
          label="GSTIN"
          value={gstin}
          onChange={(value) => setGstin(value.toUpperCase())}
        />

        <MasterField
          label="Address"
          value={address}
          onChange={setAddress}
        />
      </div>

      <ActiveField value={active} onChange={setActive} />
    </MasterDialog>
  );
}

export function SuppliersTab({
  canEdit,
}: {
  canEdit: boolean;
}) {
  const { t } = useLanguage();
  const [status, setStatus] = useState("all");

  return (
    <MasterSection<Supplier>
      title="Suppliers"
      description="Manage material and packaging suppliers."
      addLabel="Add supplier"
      canEdit={canEdit}
      load={getSuppliers}
      searchValue={(row) =>
        `${row.name} ${row.supplier_code} ${row.phone ?? ""} ${row.gstin ?? ""} ${row.contact_person ?? ""}`
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
          className="h-10 rounded-md border bg-white px-3 text-sm"
        >
          <option value="all">{t("All statuses")}</option>
          <option value="active">{t("active")}</option>
          <option value="inactive">{t("inactive")}</option>
        </select>
      }
      columns={[
        {
          key: "code",
          header: t("Supplier code"),
          render: (row) => row.supplier_code,
          sortValue: (row) => row.supplier_code,
        },
        {
          key: "name",
          header: t("Supplier name"),
          render: (row) => (
            <span className="font-medium text-slate-900">
              {row.name}
            </span>
          ),
          sortValue: (row) => row.name,
        },
        {
          key: "contact",
          header: t("Contact person"),
          render: (row) => row.contact_person || "—",
        },
        {
          key: "phone",
          header: t("Phone"),
          render: (row) => row.phone || "—",
        },
        {
          key: "state",
          header: t("State"),
          render: (row) => row.state ? t(row.state) : "—",
        },
        {
          key: "gstin",
          header: t("GSTIN"),
          render: (row) => row.gstin || "—",
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
        <SupplierForm
          record={record}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      )}
    />
  );
}