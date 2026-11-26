
"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  Building2,
  Landmark,
  Receipt,
  Save,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import { toast } from "sonner";

import { useAuth } from "@/contexts/auth-context";
import { useLanguage } from "@/contexts/language-context";

import {
  getCompanySettings,
  saveCompanySettings,
  type CompanySettings,
} from "@/lib/company-settings";

import {
  validateGSTIN,
} from "@/lib/states";

import { Button } from "@/components/ui/button";

import {
  MasterField,
} from "@/components/masters/master-form-fields";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

type SettingsForm = {
  companyName: string;
  gstin: string;
  address: string;
  city: string;
  pincode: string;
  phone: string;
  email: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  paymentTerms: string;
};

function toForm(
  settings: CompanySettings
): SettingsForm {
  return {
    companyName:
      settings.company_name ?? "",
    gstin:
      settings.gstin ?? "",
    address:
      settings.address ?? "",
    city:
      settings.city ?? "",
    pincode:
      settings.pincode ?? "",
    phone:
      settings.phone ?? "",
    email:
      settings.email ?? "",
    bankName:
      settings.bank_name ?? "",
    accountNumber:
      settings.bank_account_number ?? "",
    ifsc:
      settings.bank_ifsc ?? "",
    paymentTerms: String(
      settings.payment_terms_days ?? 30
    ),
  };
}

export default function SettingsPage() {
  const { profile } = useAuth();
  const { t } = useLanguage();

  const allowed =
    profile?.role === "admin";

  const [original, setOriginal] =
    useState<CompanySettings | null>(null);

  const [form, setForm] =
    useState<SettingsForm | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [confirmOpen, setConfirmOpen] =
    useState(false);

  const [error, setError] =
    useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data =
        await getCompanySettings();

      setOriginal(data);
      setForm(toForm(data));
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load company settings."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (allowed) void refresh();
  }, [allowed, refresh]);

  function updateField(
    key: keyof SettingsForm,
    value: string
  ) {
    setForm((current) =>
      current
        ? {
            ...current,
            [key]: value,
          }
        : current
    );

    setError("");
  }

  const hasChanges =
    original !== null &&
    form !== null &&
    JSON.stringify(toForm(original)) !==
      JSON.stringify(form);

  function validate() {
    if (!form) {
      throw new Error(
        "Company settings are unavailable."
      );
    }

    if (!form.companyName.trim()) {
      throw new Error(
        "Company name is required."
      );
    }

    const gstin = validateGSTIN(
      form.gstin,
      "33"
    );

    if (
      form.pincode.trim() &&
      !/^[1-9]\d{5}$/.test(
        form.pincode.trim()
      )
    ) {
      throw new Error(
        "Enter a valid six-digit PIN code."
      );
    }

    if (
      form.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        form.email.trim()
      )
    ) {
      throw new Error(
        "Enter a valid email address."
      );
    }

    const ifsc =
      form.ifsc.trim().toUpperCase();

    if (
      ifsc &&
      !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)
    ) {
      throw new Error(
        "Enter a valid IFSC code."
      );
    }

    const terms = Number(
      form.paymentTerms
    );

    if (
      !form.paymentTerms.trim() ||
      !Number.isInteger(terms) ||
      terms < 0 ||
      terms > 365
    ) {
      throw new Error(
        "Payment terms must be a whole number between 0 and 365 days."
      );
    }

    return {
      company_name:
        form.companyName.trim(),

      gstin,

      address:
        form.address.trim() || null,

      city:
        form.city.trim() || null,

      pincode:
        form.pincode.trim() || null,

      phone:
        form.phone.trim() || null,

      email:
        form.email.trim() || null,

      bank_name:
        form.bankName.trim() || null,

      bank_account_number:
        form.accountNumber.trim() || null,

      bank_ifsc:
        ifsc || null,

      payment_terms_days:
        terms,
    };
  }

  function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    try {
      validate();
      setError("");
      setConfirmOpen(true);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Invalid settings."
      );
    }
  }

  async function handleSave() {
    setConfirmOpen(false);
    setSaving(true);
    setError("");

    try {
      const values = validate();

      await saveCompanySettings(values);

      toast.success(
        t("Company settings saved.")
      );

      await refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to save settings."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!allowed) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center">
        {t("Access denied.")}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border bg-white p-10 text-center text-sm text-slate-500">
        {t("Loading data...")}
      </div>
    );
  }

  if (!form || !original) {
    return (
      <div className="space-y-3 rounded-xl border bg-white p-5">
        <p className="text-sm text-red-600">
          {error ||
            t("Company settings unavailable.")}
        </p>

        <Button
          variant="outline"
          onClick={() => void refresh()}
        >
          {t("Retry")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("Settings")}
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            {t(
              "Manage company information and invoice preferences."
            )}
          </p>
        </div>

        <Button
          variant="outline"
          disabled={saving || hasChanges}
          onClick={() => void refresh()}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {t("Refresh")}
        </Button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        <fieldset
          disabled={saving}
          className="space-y-5"
        >
          {/* Company information */}

          <section className="space-y-5 rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
                <Building2 className="h-5 w-5" />
              </div>

              <div>
                <h2 className="font-semibold">
                  {t("Company information")}
                </h2>

                <p className="text-xs text-slate-500">
                  {t(
                    "Business identity used on future invoices."
                  )}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <MasterField
                label="Company name"
                value={form.companyName}
                onChange={(value) =>
                  updateField(
                    "companyName",
                    value
                  )
                }
                required
              />

              <MasterField
                label="GSTIN"
                value={form.gstin}
                onChange={(value) =>
                  updateField(
                    "gstin",
                    value.toUpperCase()
                  )
                }
                placeholder="33XXXXXXXXXXXXX"
              />

              <div className="sm:col-span-2">
                <MasterField
                  label="Address"
                  value={form.address}
                  onChange={(value) =>
                    updateField(
                      "address",
                      value
                    )
                  }
                />
              </div>

              <MasterField
                label="City"
                value={form.city}
                onChange={(value) =>
                  updateField("city", value)
                }
              />

              <MasterField
                label="PIN code"
                value={form.pincode}
                onChange={(value) =>
                  updateField("pincode", value)
                }
              />

              <MasterField
                label="Phone"
                value={form.phone}
                onChange={(value) =>
                  updateField("phone", value)
                }
              />

              <MasterField
                label="Email"
                type="email"
                value={form.email}
                onChange={(value) =>
                  updateField("email", value)
                }
              />

              <MasterField
                label="Registered state"
                value={original.state ?? "Tamil Nadu"}
                onChange={() => {}}
                disabled
              />

              <MasterField
                label="State code"
                value={original.state_code ?? "33"}
                onChange={() => {}}
                disabled
              />
            </div>

            {!form.gstin.trim() && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                {t(
                  "Company GSTIN is not configured. Demo invoices should not be used as statutory tax invoices."
                )}
              </p>
            )}
          </section>

          {/* Bank details */}

          <section className="space-y-5 rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
                <Landmark className="h-5 w-5" />
              </div>

              <div>
                <h2 className="font-semibold">
                  {t("Bank details")}
                </h2>

                <p className="text-xs text-slate-500">
                  {t(
                    "Optional payment information for invoices."
                  )}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <MasterField
                label="Bank name"
                value={form.bankName}
                onChange={(value) =>
                  updateField("bankName", value)
                }
              />

              <MasterField
                label="Bank account number"
                value={form.accountNumber}
                onChange={(value) =>
                  updateField(
                    "accountNumber",
                    value
                  )
                }
              />

              <MasterField
                label="IFSC code"
                value={form.ifsc}
                onChange={(value) =>
                  updateField(
                    "ifsc",
                    value.toUpperCase()
                  )
                }
              />
            </div>
          </section>

          {/* Invoice preferences */}

          <section className="space-y-5 rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
                <Receipt className="h-5 w-5" />
              </div>

              <div>
                <h2 className="font-semibold">
                  {t("Invoice preferences")}
                </h2>

                <p className="text-xs text-slate-500">
                  {t(
                    "Configure default customer payment terms."
                  )}
                </p>
              </div>
            </div>

            <div className="max-w-xs">
              <MasterField
                label="Payment terms (days)"
                type="number"
                min={0}
                max={365}
                step="1"
                value={form.paymentTerms}
                onChange={(value) =>
                  updateField(
                    "paymentTerms",
                    value
                  )
                }
                required
              />
            </div>

            <p className="text-xs text-slate-500">
              {t(
                "Payment terms determine the due date of newly generated invoices. Zero means payment is due on the invoice date."
              )}
            </p>
          </section>
        </fieldset>

        <div className="flex items-start gap-3 rounded-xl border bg-slate-50 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />

          <div>
            <p className="text-sm font-semibold">
              {t("Historical invoice protection")}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              {t(
                "Changes apply to future invoices. Existing invoices retain their original company information and payment due dates."
              )}
            </p>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {t(error)}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4">
          <p className="text-xs text-slate-500">
            {hasChanges
              ? t("You have unsaved changes.")
              : t("All changes saved.")}
          </p>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving || !hasChanges}
              onClick={() => {
                setForm(toForm(original));
                setError("");
              }}
            >
              {t("Discard changes")}
            </Button>

            <Button
              type="submit"
              disabled={saving || !hasChanges}
            >
              <Save className="mr-2 h-4 w-4" />

              {saving
                ? t("Saving...")
                : t("Save settings")}
            </Button>
          </div>
        </div>
      </form>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("Confirm settings update")}
            </AlertDialogTitle>

            <AlertDialogDescription>
              {t(
                "These settings will apply to future invoices. Existing invoice snapshots will remain unchanged."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("Cancel")}
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={() => void handleSave()}
            >
              {t("Confirm and save")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
