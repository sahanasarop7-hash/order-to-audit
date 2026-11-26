"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";


export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const { profile, loading } = useAuth();

  useEffect(() => {
    if (!loading && !profile?.is_active) {
      router.replace("/login");
    }
  }, [loading, profile, router]);

  if (loading || !profile?.is_active) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
          Loading workspace...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#F8FAFC]">
      <div className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">
        <Sidebar />
      </div>

      <div className="min-w-0 lg:pl-64">
        <Header />

        <main className="min-w-0 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}