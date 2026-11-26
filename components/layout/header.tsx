"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, LogOut, ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import { Sidebar } from "@/components/layout/sidebar";
import { LanguageSwitcher } from "@/components/layout/language-switcher";

import { useAuth } from "@/contexts/auth-context";
import { useLanguage } from "@/contexts/language-context";

import {
  NAVIGATION,
  ROLE_LABELS,
  type Role,
} from "@/lib/navigation";

export function Header() {
  const router = useRouter();
  const pathname = usePathname();

  const { profile, user, signOut } = useAuth();
  const { t } = useLanguage();

  const [mobileOpen, setMobileOpen] = useState(false);

  const currentPage = NAVIGATION
    .flatMap((group) => group.items)
    .find(
      (item) =>
        pathname === item.href ||
        pathname.startsWith(item.href + "/")
    );

  async function handleLogout() {
    try {
      await signOut();
      router.replace("/login");
    } catch {
      toast.error("Unable to sign out. Please try again.");
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Sheet
          open={mobileOpen}
          onOpenChange={setMobileOpen}
        >
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open navigation"
            >
              <Menu size={22} />
            </Button>
          </SheetTrigger>

          <SheetContent
            side="left"
            className="w-72 border-none bg-[#0F172A] p-0 text-white"
          >
            <SheetTitle className="sr-only">
              Navigation
            </SheetTitle>

            <Sidebar
              onNavigate={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="hidden text-slate-500 sm:inline">
            {t("Workspace")}
          </span>

          <span className="hidden text-slate-300 sm:inline">
            /
          </span>

          <span className="truncate font-medium text-slate-900">
            {t(currentPage?.label ?? "Dashboard")}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <LanguageSwitcher />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex h-11 items-center gap-2 px-2"
              aria-label="Account menu"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                {profile?.full_name.charAt(0).toUpperCase()}
              </div>

              <div className="hidden text-left sm:block">
                <p className="text-sm font-medium text-slate-900">
                  {profile?.full_name}
                </p>

                <p className="text-xs text-slate-500">
                  {t(ROLE_LABELS[profile?.role as Role])}
                </p>
              </div>

              <ChevronDown size={15} />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            className="w-56"
          >
            <DropdownMenuLabel>
              <p>{profile?.full_name}</p>

              <p className="truncate text-xs font-normal text-slate-500">
                {user?.email}
              </p>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={handleLogout}
              className="text-red-600"
            >
              <LogOut className="mr-2 h-4 w-4" />
              {t("Sign out")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}