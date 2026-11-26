
"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { useRouter } from "next/navigation";

import {
  AudioLines,
  Mic,
  MicOff,
  Send,
  X,
  Volume2,
  VolumeX,
  Trash2,
  Loader2,
  MessageCircle,
} from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
import { useLanguage } from "@/contexts/language-context";

import { askMozhi } from "@/lib/mozhi/assistant";

import type {
  MozhiLanguage,
} from "@/lib/mozhi/intents";

import {
  getRecognitionConstructor,
  speakMessage,
  stopSpeaking,
  SPEECH_LOCALES,
  type BrowserRecognition,
} from "@/lib/mozhi/speech";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Message = {
  id: number;
  role: "user" | "assistant";
  text: string;
  language: MozhiLanguage;
};

type LocalizedText = [
  string,
  string,
  string
];

function localize(
  language: MozhiLanguage,
  values: LocalizedText
) {
  const index = {
    en: 0,
    ta: 1,
    hi: 2,
  }[language];

  return values[index];
}

const SUGGESTIONS: {
  roles: string[];
  text: LocalizedText;
}[] = [
  {
    roles: [
      "admin",
      "salesman",
      "production",
      "accountant",
      "owner",
    ],
    text: [
      "Available stock",
      "கிடைக்கும் இருப்பு",
      "उपलब्ध स्टॉक",
    ],
  },
  {
    roles: [
      "admin",
      "salesman",
      "accountant",
      "owner",
    ],
    text: [
      "Pending orders",
      "நிலுவை ஆர்டர்கள்",
      "लंबित ऑर्डर",
    ],
  },
  {
    roles: [
      "admin",
      "accountant",
      "owner",
    ],
    text: [
      "Monthly sales",
      "மாத விற்பனை",
      "मासिक बिक्री",
    ],
  },
  {
    roles: [
      "admin",
      "accountant",
      "owner",
    ],
    text: [
      "Outstanding amount",
      "நிலுவைத் தொகை",
      "बकाया राशि",
    ],
  },
  {
    roles: [
      "admin",
      "production",
      "accountant",
      "owner",
    ],
    text: [
      "Production yield",
      "உற்பத்தி திறன்",
      "उत्पादन की प्राप्ति",
    ],
  },
  {
    roles: [
      "admin",
      "production",
      "accountant",
      "owner",
    ],
    text: [
      "Reorder alerts",
      "மறுகொள்முதல் எச்சரிக்கைகள்",
      "कम स्टॉक",
    ],
  },
];

export function MozhiAssistant() {
  const router = useRouter();

  const { profile } = useAuth();

  const {
    language,
    setLanguage,
  } = useLanguage();

  const role = profile?.role ?? "";

  const [open, setOpen] =
    useState(false);

  const [messages, setMessages] =
    useState<Message[]>([]);

  const [input, setInput] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const [listening, setListening] =
    useState(false);

  const [voiceEnabled, setVoiceEnabled] =
    useState(true);

  const [speechSupported, setSpeechSupported] =
    useState(false);

  const [error, setError] =
    useState("");

  const recognitionRef =
    useRef<BrowserRecognition | null>(null);

  const scrollRef =
    useRef<HTMLDivElement | null>(null);

  const inputRef =
    useRef<HTMLInputElement | null>(null);

  const messageId =
    useRef(0);

  const busyRef =
    useRef(false);

  const sessionRef =
    useRef(0);

  function tr(values: LocalizedText) {
    return localize(language, values);
  }

  useEffect(() => {
    setSpeechSupported(
      !!getRecognitionConstructor()
    );

    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;

      stopSpeaking();
      sessionRef.current += 1;
    };
  }, []);

  // Clear private conversation data when
  // the authenticated account changes.

  useEffect(() => {
    sessionRef.current += 1;

    recognitionRef.current?.abort();
    recognitionRef.current = null;

    stopSpeaking();

    busyRef.current = false;

    setBusy(false);
    setListening(false);
    setMessages([]);
    setInput("");
    setError("");
    setOpen(false);
  }, [profile?.id, profile?.role]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop =
        scrollRef.current.scrollHeight;
    }
  }, [messages, busy, open]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  function addMessage(
    messageRole: Message["role"],
    text: string,
    messageLanguage: MozhiLanguage
  ) {
    messageId.current += 1;

    const message: Message = {
      id: messageId.current,
      role: messageRole,
      text,
      language: messageLanguage,
    };

    setMessages((previous) =>
      [...previous, message].slice(-100)
    );
  }

  function playMessage(
    text: string,
    messageLanguage: MozhiLanguage
  ) {
    const started = speakMessage(
      text,
      messageLanguage
    );

    if (!started) {
      setError(
        tr([
          "A matching speech voice is unavailable. You can read the response instead.",
          "இந்த மொழிக்கான குரல் கிடைக்கவில்லை. பதிலைப் படிக்கலாம்.",
          "इस भाषा की आवाज़ उपलब्ध नहीं है। आप उत्तर पढ़ सकते हैं।",
        ])
      );
    }
  }

  async function sendMessage(
    rawText: string
  ) {
    const text = rawText.trim();

    if (
      !text ||
      busyRef.current ||
      !profile?.is_active
    ) {
      return;
    }

    const currentSession =
      sessionRef.current;

    const requestLanguage = language;

    busyRef.current = true;

    setBusy(true);
    setError("");
    setInput("");

    stopSpeaking();

    addMessage(
      "user",
      text,
      requestLanguage
    );

    try {
      const response = await askMozhi(
        text,
        requestLanguage,
        role
      );

      // Ignore responses from a previous
      // authenticated session.

      if (
        currentSession !==
        sessionRef.current
      ) {
        return;
      }

      const responseLanguage =
        response.language ??
        requestLanguage;

      if (response.language) {
        setLanguage(response.language);
      }

      addMessage(
        "assistant",
        response.message,
        responseLanguage
      );

      if (voiceEnabled) {
        playMessage(
          response.message,
          responseLanguage
        );
      }

      if (response.path) {
        router.push(response.path);
      }
    } catch (error) {
      if (
        currentSession !==
        sessionRef.current
      ) {
        return;
      }

      const message = localize(
        requestLanguage,
        [
          "Unable to retrieve the requested information. Please try again.",
          "கோரிய தகவலைப் பெற முடியவில்லை. மீண்டும் முயற்சிக்கவும்.",
          "अनुरोधित जानकारी प्राप्त नहीं हो सकी। फिर से प्रयास करें।",
        ]
      );

      addMessage(
        "assistant",
        message,
        requestLanguage
      );

      console.error(
        "Mozhi request failed:",
        error
      );
    } finally {
      if (
        currentSession ===
        sessionRef.current
      ) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }

  function startListening() {
    if (
      busyRef.current ||
      recognitionRef.current
    ) {
      return;
    }

    const Recognition =
      getRecognitionConstructor();

    if (!Recognition) {
      setError(
        tr([
          "Voice recognition is unavailable in this browser. Please type your command.",
          "இந்த உலாவியில் குரல் அறிதல் இல்லை. கட்டளையைத் தட்டச்சு செய்யவும்.",
          "इस ब्राउज़र में आवाज़ पहचान उपलब्ध नहीं है। अपना आदेश टाइप करें।",
        ])
      );

      return;
    }

    stopSpeaking();
    setError("");

    const recognition = new Recognition();

    const currentSession =
      sessionRef.current;

    recognition.lang =
      SPEECH_LOCALES[language];

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
    };

    recognition.onend = () => {
      if (
        recognitionRef.current ===
        recognition
      ) {
        recognitionRef.current = null;
        setListening(false);
      }
    };

    recognition.onresult = (event) => {
      if (
        currentSession !==
        sessionRef.current ||
        recognitionRef.current !==
        recognition
      ) {
        return;
      }

      const transcript =
        event.results[0]?.[0]?.transcript ??
        "";

      if (transcript.trim()) {
        // Show the recognized text first.
        // The user can correct it before sending.

        setInput(transcript);
      }
    };

    recognition.onerror = (event) => {
      if (
        recognitionRef.current !==
        recognition
      ) {
        return;
      }

      setListening(false);

      if (event.error === "aborted") {
        return;
      }

      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        setError(
          tr([
            "Microphone access was denied. Allow microphone access or type your command.",
            "மைக்ரோஃபோன் அனுமதி மறுக்கப்பட்டது. அனுமதி வழங்கவும் அல்லது தட்டச்சு செய்யவும்.",
            "माइक्रोफ़ोन की अनुमति नहीं मिली। अनुमति दें या आदेश टाइप करें।",
          ])
        );

        return;
      }

      if (event.error === "no-speech") {
        setError(
          tr([
            "No speech detected. Please try again.",
            "குரல் கண்டறியப்படவில்லை. மீண்டும் முயற்சிக்கவும்.",
            "कोई आवाज़ नहीं मिली। फिर से प्रयास करें।",
          ])
        );

        return;
      }

      setError(
        tr([
          "Speech recognition failed. Please try again or type your command.",
          "குரல் அறிதல் தோல்வியடைந்தது. மீண்டும் முயற்சிக்கவும் அல்லது தட்டச்சு செய்யவும்.",
          "आवाज़ पहचान विफल रही। फिर से प्रयास करें या टाइप करें।",
        ])
      );
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);

      setError(
        tr([
          "Unable to start the microphone.",
          "மைக்ரோஃபோனைத் தொடங்க முடியவில்லை.",
          "माइक्रोफ़ोन शुरू नहीं हो सका।",
        ])
      );
    }
  }

  function stopListening() {
    recognitionRef.current?.stop();
  }

  function closeAssistant() {
    const recognition =
      recognitionRef.current;

    recognitionRef.current = null;

    recognition?.abort();

    stopSpeaking();

    setListening(false);
    setOpen(false);
  }

  function clearConversation() {
    stopSpeaking();
    setMessages([]);
    setInput("");
    setError("");
  }

  function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!listening) {
      void sendMessage(input);
    }
  }

  const suggestions = SUGGESTIONS.filter(
    (suggestion) =>
      suggestion.roles.includes(role)
  );

  if (!profile?.is_active) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 sm:bottom-6 sm:right-6">

      {/* Floating assistant panel */}

      {open && (
        <section
          aria-label="Mozhi"
          className="mb-3 flex h-[600px] max-h-[calc(100dvh-100px)] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:w-[390px]"
        >

          {/* Header */}

          <header className="flex shrink-0 items-center gap-3 bg-slate-900 p-4 text-white">
            <div className="rounded-xl bg-indigo-600 p-2.5">
              <AudioLines className="h-6 w-6" />
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">
                Mozhi
              </h2>

              <p className="text-xs text-slate-300">
                {tr([
                  "Business voice assistant",
                  "வணிக குரல் உதவியாளர்",
                  "व्यावसायिक वॉइस सहायक",
                ])}
              </p>
            </div>

            <button
              type="button"
              aria-label={
                voiceEnabled
                  ? tr([
                      "Mute voice",
                      "குரலை நிறுத்து",
                      "आवाज़ बंद करें",
                    ])
                  : tr([
                      "Enable voice",
                      "குரலை இயக்கு",
                      "आवाज़ चालू करें",
                    ])
              }
              onClick={() => {
                if (voiceEnabled) {
                  stopSpeaking();
                }

                setVoiceEnabled(
                  !voiceEnabled
                );
              }}
              className="rounded-lg p-2 hover:bg-slate-700"
            >
              {voiceEnabled ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
            </button>

            <button
              type="button"
              aria-label={tr([
                "Close assistant",
                "உதவியாளரை மூடு",
                "सहायक बंद करें",
              ])}
              onClick={closeAssistant}
              className="rounded-lg p-2 hover:bg-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          {/* Language selection */}

          <div className="flex shrink-0 items-center justify-between gap-2 border-b bg-slate-50 px-4 py-3">
            <select
              aria-label={tr([
                "Assistant language",
                "உதவியாளர் மொழி",
                "सहायक की भाषा",
              ])}
              value={language}
              disabled={busy || listening}
              onChange={(event) => {
                stopSpeaking();
                setError("");

                setLanguage(
                  event.target.value as MozhiLanguage
                );
              }}
              className="h-9 rounded-md border bg-white px-3 text-sm"
            >
              <option value="en">
                English
              </option>

              <option value="ta">
                தமிழ்
              </option>

              <option value="hi">
                हिन्दी
              </option>
            </select>

            <Button
              size="sm"
              variant="ghost"
              disabled={
                busy ||
                listening ||
                messages.length === 0
              }
              onClick={clearConversation}
            >
              <Trash2 className="mr-1 h-4 w-4" />

              {tr([
                "Clear",
                "அழி",
                "साफ़ करें",
              ])}
            </Button>
          </div>

          {/* Conversation */}

          <div
            ref={scrollRef}
            role="log"
            aria-live="polite"
            className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4"
          >
            <div className="flex items-start gap-2">
              <div className="shrink-0 rounded-lg bg-indigo-50 p-2 text-indigo-600">
                <AudioLines className="h-4 w-4" />
              </div>

              <div className="rounded-xl rounded-tl-sm bg-slate-100 p-3 text-sm leading-relaxed text-slate-800">
                {tr([
                  "Hello! I'm Mozhi. Ask me about your business or tell me which page to open.",
                  "வணக்கம்! நான் மொழி. உங்கள் வணிகத்தைப் பற்றி கேளுங்கள் அல்லது எந்தப் பக்கத்தைத் திறக்க வேண்டும் என்று சொல்லுங்கள்.",
                  "नमस्ते! मैं मोझी हूँ। अपने व्यवसाय के बारे में पूछें या कोई पृष्ठ खोलने के लिए कहें।",
                ])}
              </div>
            </div>

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start gap-2 ${
                  message.role === "user"
                    ? "justify-end"
                    : "justify-start"
                }`}
              >
                {message.role ===
                  "assistant" && (
                  <div className="shrink-0 rounded-lg bg-indigo-50 p-2 text-indigo-600">
                    <AudioLines className="h-4 w-4" />
                  </div>
                )}

                <div
                  className={`max-w-[88%] whitespace-pre-wrap break-words rounded-xl p-3 text-sm leading-relaxed ${
                    message.role === "user"
                      ? "rounded-tr-sm bg-indigo-600 text-white"
                      : "rounded-tl-sm bg-slate-100 text-slate-800"
                  }`}
                >
                  {message.text}

                  {message.role ===
                    "assistant" && (
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        aria-label={tr([
                          "Read response aloud",
                          "பதிலை வாசி",
                          "उत्तर बोलकर सुनाएँ",
                        ])}
                        disabled={listening}
                        onClick={() =>
                          playMessage(
                            message.text,
                            message.language
                          )
                        }
                        className="rounded p-1 text-slate-500 hover:bg-slate-200"
                      >
                        <Volume2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {busy && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />

                {tr([
                  "Retrieving information...",
                  "தகவலைப் பெறுகிறது...",
                  "जानकारी प्राप्त हो रही है...",
                ])}
              </div>
            )}
          </div>

          {/* Suggested commands */}

          {messages.length === 0 && (
            <div className="shrink-0 border-t px-4 py-3">
              <p className="mb-2 text-xs font-medium text-slate-500">
                {tr([
                  "Suggested commands",
                  "பரிந்துரைக்கப்பட்ட கட்டளைகள்",
                  "सुझाए गए आदेश",
                ])}
              </p>

              <div className="flex flex-wrap gap-1.5">
                {suggestions.map(
                  (suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      disabled={
                        busy || listening
                      }
                      onClick={() =>
                        void sendMessage(
                          localize(
                            language,
                            suggestion.text
                          )
                        )
                      }
                      className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1.5 text-xs text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                    >
                      {localize(
                        language,
                        suggestion.text
                      )}
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          {/* Microphone status and errors */}

          {listening && (
            <div className="flex shrink-0 items-center gap-2 bg-red-50 px-4 py-2 text-xs font-medium text-red-700">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />

              {tr([
                "Listening... Speak now.",
                "கேட்கிறது... இப்போது பேசுங்கள்.",
                "सुन रही हूँ... अब बोलें।",
              ])}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="shrink-0 bg-amber-50 px-4 py-2 text-xs text-amber-800"
            >
              {error}
            </div>
          )}

          {/* Input area */}

          <footer className="shrink-0 border-t bg-white p-3">
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2"
            >
              <Input
                ref={inputRef}
                value={input}
                maxLength={500}
                disabled={busy || listening}
                onChange={(event) =>
                  setInput(event.target.value)
                }
                placeholder={tr([
                  "Ask Mozhi...",
                  "மொழியிடம் கேளுங்கள்...",
                  "मोझी से पूछें...",
                ])}
                aria-label={tr([
                  "Your command",
                  "உங்கள் கட்டளை",
                  "आपका आदेश",
                ])}
                className="min-w-0 flex-1"
              />

              <Button
                type="button"
                size="icon"
                variant="outline"
                disabled={
                  busy || !speechSupported
                }
                aria-label={
                  listening
                    ? tr([
                        "Stop listening",
                        "கேட்பதை நிறுத்து",
                        "सुनना बंद करें",
                      ])
                    : tr([
                        "Start microphone",
                        "மைக்ரோஃபோனை இயக்கு",
                        "माइक्रोफ़ोन शुरू करें",
                      ])
                }
                onClick={() => {
                  if (listening) {
                    stopListening();
                  } else {
                    startListening();
                  }
                }}
                className={
                  listening
                    ? "border-red-300 bg-red-50 text-red-600"
                    : "text-indigo-600"
                }
              >
                {listening ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>

              <Button
                type="submit"
                size="icon"
                disabled={
                  busy ||
                  listening ||
                  !input.trim()
                }
                aria-label={tr([
                  "Send command",
                  "கட்டளையை அனுப்பு",
                  "आदेश भेजें",
                ])}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>

            <p className="mt-2 text-center text-[10px] text-slate-400">
              {speechSupported
                ? "English · தமிழ் · हिन्दी"
                : tr([
                    "Voice unavailable · Typed commands supported",
                    "குரல் வசதி இல்லை · தட்டச்சு செய்யலாம்",
                    "आवाज़ उपलब्ध नहीं · टाइप कर सकते हैं",
                  ])}
            </p>
          </footer>
        </section>
      )}

      {/* Floating launcher */}

      <div className="flex justify-end">
        <button
          type="button"
          aria-expanded={open}
          aria-label={
            open
              ? "Close Mozhi"
              : "Open Mozhi"
          }
          onClick={() => {
            if (open) {
              closeAssistant();
            } else {
              setOpen(true);
            }
          }}
          className="flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          {open ? (
            <X className="h-5 w-5" />
          ) : (
            <MessageCircle className="h-5 w-5" />
          )}

          Mozhi
        </button>
      </div>
    </div>
  );
}
