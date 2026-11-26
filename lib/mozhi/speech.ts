
import type { MozhiLanguage } from "./intents";

export const SPEECH_LOCALES: Record<
  MozhiLanguage,
  string
> = {
  en: "en-IN",
  ta: "ta-IN",
  hi: "hi-IN",
};

type RecognitionResultEvent = {
  results: ArrayLike<
    ArrayLike<{
      transcript: string;
    }>
  >;
};

type RecognitionErrorEvent = {
  error: string;
};

export interface BrowserRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;

  onstart: (() => void) | null;
  onend: (() => void) | null;

  onresult:
    | ((event: RecognitionResultEvent) => void)
    | null;

  onerror:
    | ((event: RecognitionErrorEvent) => void)
    | null;

  start(): void;
  stop(): void;
  abort(): void;
}

type RecognitionConstructor =
  new () => BrowserRecognition;

type SpeechWindow = Window & {
  SpeechRecognition?: RecognitionConstructor;
  webkitSpeechRecognition?: RecognitionConstructor;
};

export function getRecognitionConstructor() {
  if (typeof window === "undefined") {
    return null;
  }

  const browser = window as SpeechWindow;

  return (
    browser.SpeechRecognition ??
    browser.webkitSpeechRecognition ??
    null
  );
}

export function speakMessage(
  message: string,
  language: MozhiLanguage
): boolean {
  if (
    typeof window === "undefined" ||
    !("speechSynthesis" in window)
  ) {
    return false;
  }

  const synthesis = window.speechSynthesis;

  synthesis.cancel();

  const utterance =
    new SpeechSynthesisUtterance(message);

  utterance.lang = SPEECH_LOCALES[language];
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.volume = 1;

  const voices = synthesis.getVoices();

  const matchingVoice =
    voices.find(
      (voice) =>
        voice.lang.toLowerCase() ===
        utterance.lang.toLowerCase()
    ) ??
    voices.find((voice) =>
      voice.lang
        .toLowerCase()
        .startsWith(language)
    );

  if (matchingVoice) {
    utterance.voice = matchingVoice;
  } else if (voices.length > 0) {
    return false;
  }

  synthesis.speak(utterance);

  return true;
}

export function stopSpeaking() {
  if (
    typeof window !== "undefined" &&
    "speechSynthesis" in window
  ) {
    window.speechSynthesis.cancel();
  }
}
