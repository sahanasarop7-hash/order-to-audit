"use client";

import {
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

import { Plus, RefreshCw, Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import {
  DataTable,
  type Column,
} from "@/components/shared/data-table";

import { useLanguage } from "@/contexts/language-context";

type MasterSectionProps<T extends { id: number }> = {
  title: string;
  description: string;
  addLabel: string;
  canEdit: boolean;
  load: () => Promise<T[]>;
  columns: Column<T>[];
  searchValue: (row: T) => string;
  filters?: ReactNode;
  filterRow?: (row: T) => boolean;
  renderForm: (
    record: T | null,
    onSuccess: () => void,
    onCancel: () => void
  ) => ReactNode;
};

export function MasterSection<T extends { id: number }>({
  title,
  description,
  addLabel,
  canEdit,
  load,
  columns,
  searchValue,
  filters,
  filterRow,
  renderForm,
}: MasterSectionProps<T>) {
  const { t } = useLanguage();

  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<T | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      setRows(await load());
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load records."
      );
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function openCreate() {
    setSelected(null);
    setFormOpen(true);
  }

  function openEdit(row: T) {
    setSelected(row);
    setFormOpen(true);
  }

  function handleSuccess() {
    setFormOpen(false);
    setSelected(null);
    toast.success(t("Record saved successfully."));
    void refresh();
  }

  const tableColumns: Column<T>[] = canEdit
    ? [
        ...columns,
        {
          key: "actions",
          header: t("Actions"),
          render: (row) => (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openEdit(row)}
            >
              <Pencil className="mr-1.5 h-4 w-4" />
              {t("Edit")}
            </Button>
          ),
        },
      ]
    : columns;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            {t(title)}
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {t(description)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${
                loading ? "animate-spin" : ""
              }`}
            />
            {t("Refresh")}
          </Button>

          {canEdit && (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              {t(addLabel)}
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border bg-white p-12 text-center text-sm text-slate-500">
          {t("Loading data...")}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm text-red-700">
            {error}
          </p>

          <Button
            className="mt-3"
            variant="outline"
            onClick={refresh}
          >
            {t("Refresh")}
          </Button>
        </div>
      ) : (
        <DataTable
          data={filterRow ? rows.filter(filterRow) : rows}
          columns={tableColumns}
          rowKey={(row) => row.id}
          searchValue={searchValue}
          searchPlaceholder={t("Search records...")}
          filters={filters}
          pageSize={10}
        />
      )}

      {formOpen &&
        canEdit &&
        renderForm(
          selected,
          handleSuccess,
          () => setFormOpen(false)
        )}
    </section>
  );
}