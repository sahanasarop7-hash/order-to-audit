"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import en from "@/locales/en.json";
import ta from "@/locales/ta.json";
import hi from "@/locales/hi.json";

export type Language = "en" | "ta" | "hi";

const dictionaries: Record<
  Language,
  Record<string, string>
> = {
  en,
  ta,
  hi,
};

export const LANGUAGES = {
  en: {
    label: "English",
    speechLocale: "en-IN",
  },
  ta: {
    label: "தமிழ்",
    speechLocale: "ta-IN",
  },
  hi: {
    label: "हिन्दी",
    speechLocale: "hi-IN",
  },
};

type LanguageContextType = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
  speechLocale: string;
};

const LanguageContext =
  createContext<LanguageContextType | undefined>(
    undefined
  );

export function LanguageProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [language, updateLanguage] =
    useState<Language>("en");

  useEffect(() => {
    const saved = localStorage.getItem("o2a-language");

    if (
      saved === "en" ||
      saved === "ta" ||
      saved === "hi"
    ) {
      updateLanguage(saved);
      document.documentElement.lang = saved;
    }
  }, []);

  function setLanguage(next: Language) {
    updateLanguage(next);

    localStorage.setItem("o2a-language", next);

    document.documentElement.lang = next;
  }

  function t(key: string) {
    return (
      dictionaries[language][key] ??
      dictionaries.en[key] ??
      key
    );
  }

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        speechLocale: LANGUAGES[language].speechLocale,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error(
      "useLanguage must be used within LanguageProvider"
    );
  }

  return context;
}