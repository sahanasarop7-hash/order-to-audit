"use client";

import { useState, type ReactNode, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/language-context";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type MasterDialogProps = {
  title: string;
  description: string;
  children: ReactNode;
  onSave: () => Promise<void>;
  onSuccess: () => void;
  onCancel: () => void;
};

export function MasterDialog({
  title,
  description,
  children,
  onSave,
  onSuccess,
  onCancel,
}: MasterDialogProps) {
  const { t } = useLanguage();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (saving) return;

    setSaving(true);
    setError("");

    try {
      await onSave();
      onSuccess();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to save record."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onCancel();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t(title)}</DialogTitle>

          <DialogDescription>
            {t(description)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <fieldset disabled={saving} className="space-y-5">
            {children}
          </fieldset>

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={saving}
            >
              {t("Cancel")}
            </Button>

            <Button type="submit" disabled={saving}>
              {t(saving ? "Saving..." : "Save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}