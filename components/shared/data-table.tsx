"use client";

import { useLanguage } from "@/contexts/language-context";

import {
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  className?: string;
};

type DataTableProps<T> = {
  data: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string | number;
  searchValue?: (row: T) => string;
  searchPlaceholder?: string;
  filters?: ReactNode;
  pageSize?: number;
};

export function DataTable<T>({
  data,
  columns,
  rowKey,
  searchValue,
  searchPlaceholder = "Search records...",
  filters,
  pageSize = 10,
}: DataTableProps<T>) {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [sort, setSort] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);

  const filteredData = useMemo(() => {
    const query = search.trim().toLowerCase();

    const rows = data.filter((row) => {
      if (!query || !searchValue) return true;

      return searchValue(row)
        .toLowerCase()
        .includes(query);
    });

    if (!sort) return rows;

    const column = columns.find(
      (column) => column.key === sort.key
    );

    if (!column?.sortValue) return rows;

    const getValue = column.sortValue;

    return [...rows].sort((a, b) => {
      const first = getValue(a);
      const second = getValue(b);

      const result =
        typeof first === "number" &&
        typeof second === "number"
          ? first - second
          : String(first).localeCompare(String(second), undefined, {
              numeric: true,
            });

      return sort.direction === "asc" ? result : -result;
    });
  }, [data, search, searchValue, sort, columns]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredData.length / pageSize)
  );

  const currentPage = Math.min(page, totalPages);

  const start = (currentPage - 1) * pageSize;

  const visibleRows = filteredData.slice(
    start,
    start + pageSize
  );

  function handleSort(key: string) {
    setSort((previous) => ({
      key,
      direction:
        previous?.key === key &&
        previous.direction === "asc"
          ? "desc"
          : "asc",
    }));

    setPage(1);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:flex-wrap sm:items-center">
        {searchValue && (
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <Input
              aria-label={t("Search records")}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={t(searchPlaceholder)}
              className="h-10 pl-9 pr-9"
            />

            {search && (
              <button
                type="button"
                aria-label={t("Clear search")}
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}

        {filters}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={`whitespace-nowrap px-4 py-3 text-xs font-semibold text-slate-600 ${column.className ?? ""}`}
                  aria-sort={
                    column.sortValue
                      ? sort?.key === column.key
                        ? sort.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                      : undefined
                  }
                >
                  {column.sortValue ? (
                    <button
                      type="button"
                      onClick={() => handleSort(column.key)}
                      className="inline-flex items-center gap-2 hover:text-indigo-600"
                    >
                      {t(column.header)}
                      <ArrowUpDown size={13} />
                    </button>
                  ) : (
                    t(column.header)
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {visibleRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-sm text-slate-500"
                >
                  {t("No matching records found.")}
                </TableCell>
              </TableRow>
            ) : (
              visibleRows.map((row) => (
                <TableRow
                  key={rowKey(row)}
                  className="hover:bg-slate-50"
                >
                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={`px-4 py-3.5 text-sm text-slate-700 ${column.className ?? ""}`}
                    >
                      {column.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
        <p className="text-xs text-slate-500">
          {t("Showing")}{" "}
          {filteredData.length === 0 ? 0 : start + 1}
          –
          {Math.min(start + pageSize, filteredData.length)}
          {" "}{t("of")} {filteredData.length} {t("records")}
        </p>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label={t("Previous page")}
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
          >
            <ChevronLeft size={16} />
          </Button>

          <span className="px-2 text-xs text-slate-600">
            {currentPage} / {totalPages}
          </span>

          <Button
            variant="outline"
            size="icon"
            aria-label={t("Next page")}
            disabled={currentPage === totalPages}
            onClick={() => setPage(currentPage + 1)}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}