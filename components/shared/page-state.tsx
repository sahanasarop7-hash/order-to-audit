"use client";

import { useLanguage } from "@/contexts/language-context";

import {
  Loader2,
  Inbox,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export function LoadingState({
  message = "Loading data...",
}: {
  message?: string;
}) {
  const { t } = useLanguage();
  return (
    <div
      role="status"
      className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white p-8"
    >
      <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />

      <p className="text-sm text-slate-500">{t(message)}</p>
    </div>
  );
}

export function EmptyState({
  title = "No records found",
  description = "There are no records to display.",
}: {
  title?: string;
  description?: string;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <div className="mb-4 rounded-full bg-slate-100 p-4">
        <Inbox className="h-7 w-7 text-slate-400" />
      </div>

      <h3 className="font-semibold text-slate-900">
        {t(title)}
      </h3>

      <p className="mt-2 text-sm text-slate-500">
        {t(description)}
      </p>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const { t } = useLanguage();
  return (
    <div
      role="alert"
      className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 p-8 text-center"
    >
      <AlertCircle className="mb-3 h-7 w-7 text-red-600" />

      <h3 className="font-semibold text-red-800">
        {t("Something went wrong")}
      </h3>

      <p className="mt-2 text-sm text-red-700">
        {t(message)}
      </p>

      {onRetry && (
        <Button
          variant="outline"
          onClick={onRetry}
          className="mt-4"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {t("Try again")}
        </Button>
      )}
    </div>
  );
}