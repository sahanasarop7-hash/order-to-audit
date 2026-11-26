"use client";
import { useLanguage } from "@/contexts/language-context";
import { LanguageSwitcher } from "@/components/layout/language-switcher";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Check,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/layout/brand-logo";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/lib/supabase";
import { BRAND } from "@/lib/brand";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { profile, loading, error: authError, signOut } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && profile?.is_active) {
      router.replace("/dashboard");
    }
  }, [profile, loading, router]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setError(
          error.message === "Invalid login credentials"
            ? "Incorrect email or password. Please try again."
            : error.message
        );
      }
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const features = [
    "Connected sales and production",
    "Traceable inventory and transactions",
    "Accurate financial reporting",
  ];

  return (
    <main className="grid min-h-dvh bg-white lg:grid-cols-2">
      {/* Branding section */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-[#0F172A] p-12 text-white lg:flex xl:p-16">
        <BrandLogo dark />

        <div className="relative z-10 max-w-lg">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">
            {t("Your connected workspace")}
          </p>

          <h1 className="text-5xl font-bold leading-tight tracking-tight xl:text-6xl">
            {t("Every operation.")}
            <span className="block text-indigo-400">
              {t("One system.")}
            </span>
          </h1>

          <p className="mt-6 text-lg leading-relaxed text-slate-400">
            {t("Simplify manufacturing, manage sales and stay ready for every audit.")}
          </p>

          <div className="mt-10 space-y-5">
            {features.map((feature) => (
              <div
                key={t(feature)}
                className="flex items-center gap-3"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500/20">
                  <Check size={16} className="text-indigo-300" />
                </div>

                <span className="text-sm text-slate-300">
                  {t(feature)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs uppercase tracking-widest text-slate-500">
          {BRAND.name} · {t("Business Management")}
        </p>

        {/* Decorative background */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full border border-indigo-500/10 bg-indigo-500/5"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -right-20 h-80 w-80 rounded-full border border-indigo-500/10"
        />
      </section>

      {/* Login form */}
      <section className="flex flex-col items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-md">
          <div className="mb-4 flex justify-end"><LanguageSwitcher /></div>
          <div className="mb-10 lg:hidden">
            <BrandLogo />
          </div>

          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            {t("Welcome back")}
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            {t("Sign in to your workspace.")}
          </p>

          <form
            onSubmit={handleLogin}
            className="mt-8 space-y-6"
          >
            <div className="space-y-2">
              <Label htmlFor="email">{t("Email address")}</Label>

              <Input
                id="email"
                type="email"
                placeholder={t("Enter your email address")}
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting || loading}
                required
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("Password")}</Label>

              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t("Enter your password")}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting || loading}
                  required
                  className="h-12 pr-12"
                />

                <button
                  type="button"
                  aria-label={t(
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  )}
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
                  className="absolute inset-y-0 right-0 flex items-center px-4 text-slate-500 hover:text-slate-900"
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            {(error || authError) && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                <AlertCircle
                  size={18}
                  className="mt-0.5 shrink-0"
                />
                <div>
                  <p>{t(error || authError || "")}</p>
                  {authError && (
                    <button
                      type="button"
                      className="mt-2 underline"
                      onClick={async () => {
                        try {
                          await signOut();
                        } catch {
                          setError("Unable to sign out. Try again.");
                        }
                      }}
                    >
                      {t("Clear session")}
                    </button>
                  )}
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting || loading || Boolean(profile)}
              className="h-12 w-full bg-[#4F46E5] text-white hover:bg-indigo-700"
            >
              {submitting || loading || profile ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t(submitting ? "Signing in..." : "Please wait...")}
                </>
              ) : (
                <>
                  {t("Sign in")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            {t("Need access? Contact your administrator.")}
          </p>

          <div className="mt-12 flex items-center justify-center gap-2 text-xs text-slate-400">
            <ShieldCheck size={15} />
            {t("Secure, role-based workspace")}
          </div>
        </div>
      </section>
    </main>
  );
}