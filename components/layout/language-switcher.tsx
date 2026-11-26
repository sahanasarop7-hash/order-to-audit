"use client";

import { Languages, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  useLanguage,
  LANGUAGES,
  type Language,
} from "@/contexts/language-context";

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-10 gap-2"
          aria-label={t("Language")}
        >
          <Languages size={17} />

          <span className="hidden sm:inline">
            {LANGUAGES[language].label}
          </span>

          <ChevronDown size={13} />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-40">
        {(Object.keys(LANGUAGES) as Language[]).map(
          (key) => (
            <DropdownMenuItem
              key={key}
              onClick={() => setLanguage(key)}
              className="flex justify-between"
            >
              <span>{LANGUAGES[key].label}</span>

              {language === key && (
                <Check
                  size={15}
                  className="text-indigo-600"
                />
              )}
            </DropdownMenuItem>
          )
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}