"use client";

import { useAuth } from "@/contexts/auth-context";
import { ROLE_LABELS, type Role } from "@/lib/navigation";

export default function DashboardPage() {
  const { profile } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Business overview
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Welcome back, {profile?.full_name}.
          Manage your business from one workspace.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">
          Current workspace
        </p>

        <h2 className="mt-2 text-xl font-semibold text-slate-900">
          {ROLE_LABELS[profile?.role as Role]}
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Your account is authenticated and active.
        </p>
      </div>
    </div>
  );
}