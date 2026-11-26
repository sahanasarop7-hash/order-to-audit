"use client";

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
  return (
    <div
      role="status"
      className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white p-8"
    >
      <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />

      <p className="text-sm text-slate-500">{message}</p>
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
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <div className="mb-4 rounded-full bg-slate-100 p-4">
        <Inbox className="h-7 w-7 text-slate-400" />
      </div>

      <h3 className="font-semibold text-slate-900">
        {title}
      </h3>

      <p className="mt-2 text-sm text-slate-500">
        {description}
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
  return (
    <div
      role="alert"
      className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 p-8 text-center"
    >
      <AlertCircle className="mb-3 h-7 w-7 text-red-600" />

      <h3 className="font-semibold text-red-800">
        Something went wrong
      </h3>

      <p className="mt-2 text-sm text-red-700">
        {message}
      </p>

      {onRetry && (
        <Button
          variant="outline"
          onClick={onRetry}
          className="mt-4"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
      )}
    </div>
  );
}