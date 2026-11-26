
import type { Language } from "@/contexts/language-context";

export type LocalizedName = {
  name: string;
  name_ta?: string | null;
  name_hi?: string | null;
};

export function getLocalizedName(
  record: LocalizedName,
  language: Language
): string {
  if (language === "ta") {
    return record.name_ta?.trim() || record.name;
  }

  if (language === "hi") {
    return record.name_hi?.trim() || record.name;
  }

  return record.name;
}
