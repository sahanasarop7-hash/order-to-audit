
"use client";

import { useState } from "react";

import {
  type AuditLog,
  auditTableLabel,
  formatAuditTime,
} from "@/lib/audit";

import { useLanguage } from "@/contexts/language-context";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";

function asObject(
  value: unknown
): Record<string, unknown> {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as Record<string, unknown>;
  }

  return {};
}

function displayValue(value: unknown) {
  if (value === null || value === undefined) {
    return "—";
  }

  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

export function AuditDetailsDialog({
  log,
  onClose,
}: {
  log: AuditLog;
  onClose: () => void;
}) {
  const { t } = useLanguage();

  const [showAll, setShowAll] =
    useState(false);

  const oldData = asObject(log.old_data);
  const newData = asObject(log.new_data);

  const fields = Array.from(
    new Set([
      ...Object.keys(oldData),
      ...Object.keys(newData),
    ])
  ).sort();

  const changedFields = fields.filter(
    (field) =>
      JSON.stringify(oldData[field]) !==
      JSON.stringify(newData[field])
  );

  const visibleFields = showAll
    ? fields
    : changedFields;

  const metadata = [
    {
      label: "Audit ID",
      value: log.id,
    },
    {
      label: "Record ID",
      value: log.record_id,
    },
    {
      label: "Table",
      value: auditTableLabel(log.table_name),
    },
    {
      label: "Action",
      value: log.action,
    },
    {
      label: "Changed by",
      value:
        log.changed_by_name ??
        log.changed_by ??
        "System / migration",
    },
    {
      label: "Role",
      value: log.changed_by_role ?? "—",
    },
    {
      label: "Changed at",
      value: formatAuditTime(log.changed_at),
    },
  ];

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {t("Audit entry details")}
          </DialogTitle>

          <DialogDescription>
            {t(
              "Review the recorded changes and their origin."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 rounded-xl border bg-slate-50 p-4 sm:grid-cols-2">
          {metadata.map((item) => (
            <div key={item.label}>
              <p className="text-xs text-slate-500">
                {t(item.label)}
              </p>

              <p className="break-all text-sm font-medium">
                {item.value}
              </p>
            </div>
          ))}
        </div>

        {log.correction_reason && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-semibold text-amber-800">
              {t("Correction reason")}
            </p>

            <p className="mt-1 text-sm text-amber-900">
              {log.correction_reason}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">
            {t("Field changes")} (
            {changedFields.length})
          </h3>

          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setShowAll(!showAll)
            }
          >
            {showAll
              ? t("Show changed fields only")
              : t("Show all fields")}
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="p-3">
                  {t("Field")}
                </th>

                <th className="p-3">
                  {t("Previous value")}
                </th>

                <th className="p-3">
                  {t("New value")}
                </th>
              </tr>
            </thead>

            <tbody>
              {visibleFields.map((field) => {
                const changed =
                  changedFields.includes(field);

                return (
                  <tr
                    key={field}
                    className="border-t align-top"
                  >
                    <td className="p-3 font-medium">
                      {field.replaceAll("_", " ")}
                    </td>

                    <td
                      className={`max-w-[260px] whitespace-pre-wrap break-all p-3 ${
                        changed
                          ? "bg-red-50 text-red-800"
                          : ""
                      }`}
                    >
                      {displayValue(
                        oldData[field]
                      )}
                    </td>

                    <td
                      className={`max-w-[260px] whitespace-pre-wrap break-all p-3 ${
                        changed
                          ? "bg-emerald-50 text-emerald-800"
                          : ""
                      }`}
                    >
                      {displayValue(
                        newData[field]
                      )}
                    </td>
                  </tr>
                );
              })}

              {visibleFields.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="p-6 text-center text-slate-500"
                  >
                    {t("No field changes found.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={onClose}
          >
            {t("Close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
