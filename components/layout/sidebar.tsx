"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BrandLogo } from "@/components/layout/brand-logo";
import { useAuth } from "@/contexts/auth-context";
import {
  NAVIGATION,
  ROLE_LABELS,
  type Role,
} from "@/lib/navigation";

export function Sidebar({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { profile } = useAuth();

  const role = profile?.role as Role;

  return (
    <aside className="flex h-full w-full flex-col bg-[#0F172A] text-white">
      <div className="border-b border-slate-800 px-5 py-6">
        <BrandLogo dark />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5">
        {NAVIGATION.map((group) => {
          const items = group.items.filter((item) =>
            item.roles.includes(role)
          );

          if (items.length === 0) return null;

          return (
            <div key={group.title} className="mb-7">
              <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                {group.title}
              </p>

              <div className="space-y-1">
                {items.map((item) => {
                  const Icon = item.icon;

                  const active =
                    pathname === item.href ||
                    pathname.startsWith(item.href + "/");

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        active
                          ? "bg-[#4F46E5] text-white"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      }`}
                    >
                      <Icon size={18} strokeWidth={1.8} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 font-semibold text-indigo-300">
            {profile?.full_name.charAt(0).toUpperCase()}
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {profile?.full_name}
            </p>

            <p className="text-xs text-slate-400">
              {ROLE_LABELS[role]}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}