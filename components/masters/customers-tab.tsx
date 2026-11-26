"use client";

import { useState } from "react";

import {
  getCustomers,
  saveCustomer,
  type Customer,
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

function CustomerForm({
  record,
  onSuccess,
  onCancel,
}: {
  record: Customer | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();

  const [name, setName] = useState(record?.name ?? "");

  const [type, setType] = useState(
    record?.customer_type ?? "retailer"
  );

  const [phone, setPhone] = useState(record?.phone ?? "");

  const [address, setAddress] = useState(
    record?.address ?? ""
  );

  const [stateCode, setStateCode] = useState(
    record?.state_code ?? "33"
  );

  const [gstin, setGstin] = useState(record?.gstin ?? "");

  const [active, setActive] = useState(
    record?.is_active ?? true
  );

  async function handleSave() {
    if (!name.trim()) {
      throw new Error("Customer name is required.");
    }

    await saveCustomer(
      {
        name: name.trim(),
        customer_type: type,
        phone: phone.trim() || null,
        address: address.trim() || null,
        state: getStateName(stateCode),
        state_code: stateCode,
        gstin: validateGSTIN(gstin, stateCode),
        is_active: active,
      },
      record?.id
    );
  }

  return (
    <MasterDialog
      title={record ? "Edit customer" : "Add customer"}
      description="Manage customer contact and GST details."
      onSave={handleSave}
      onSuccess={onSuccess}
      onCancel={onCancel}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <MasterField
          label="Customer name"
          value={name}
          onChange={setName}
          required
        />

        <MasterSelect
          label="Customer type"
          value={type}
          onChange={setType}
          required
        >
          <option value="retailer">{t("Retailer")}</option>
          <option value="distributor">
            {t("Distributor")}
          </option>
        </MasterSelect>

        <MasterField
          label="Phone"
          value={phone}
          onChange={setPhone}
          type="tel"
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
          placeholder="Optional"
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

export function CustomersTab({
  canEdit,
}: {
  canEdit: boolean;
}) {
  const { t } = useLanguage();

  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");

  return (
    <MasterSection<Customer>
      title="Customers"
      description="Manage retailers and distributors."
      addLabel="Add customer"
      canEdit={canEdit}
      load={getCustomers}
      searchValue={(row) =>
        `${row.name} ${row.phone ?? ""} ${row.gstin ?? ""} ${row.state}`
      }
      filterRow={(row) =>
        (status === "all" ||
          row.is_active === (status === "active")) &&
        (type === "all" || row.customer_type === type)
      }
      filters={
        <>
          <select
            aria-label={t("Customer type")}
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-10 rounded-md border bg-white px-3 text-sm"
          >
            <option value="all">{t("All types")}</option>
            <option value="retailer">{t("Retailer")}</option>
            <option value="distributor">
              {t("Distributor")}
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
          header: t("Customer name"),
          render: (row) => (
            <span className="font-medium text-slate-900">
              {row.name}
            </span>
          ),
          sortValue: (row) => row.name,
        },
        {
          key: "type",
          header: t("Customer type"),
          render: (row) =>
            t(
              row.customer_type === "retailer"
                ? "Retailer"
                : "Distributor"
            ),
          sortValue: (row) => row.customer_type,
        },
        {
          key: "phone",
          header: t("Phone"),
          render: (row) => row.phone || "—",
        },
        {
          key: "state",
          header: t("State"),
          render: (row) =>
            `${t(row.state)} (${row.state_code})`,
          sortValue: (row) => row.state,
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
        <CustomerForm
          record={record}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      )}
    />
  );
}