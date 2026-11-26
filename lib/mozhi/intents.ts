
export type MozhiLanguage = "en" | "ta" | "hi";

export type MozhiIntent =
  | { type: "navigate"; path: string }
  | { type: "language"; language: MozhiLanguage }
  | { type: "stock" }
  | { type: "pending_orders" }
  | { type: "sales" }
  | { type: "outstanding" }
  | { type: "production" }
  | { type: "reorder" }
  | { type: "help" }
  | { type: "unknown" };

function normalize(value: string) {
  return value
    .normalize("NFC")
    .toLowerCase()
    .replace(/[?!.,।]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matches(
  text: string,
  phrases: string[]
) {
  return phrases.some((phrase) =>
    text.includes(normalize(phrase))
  );
}

const ROUTES = [
  {
    path: "/dashboard",
    words: [
      "dashboard",
      "முகப்பு",
      "டாஷ்போர்டு",
      "डैशबोर्ड",
    ],
  },
  {
    path: "/sales",
    words: [
      "sales",
      "orders",
      "விற்பனை",
      "ஆர்டர்",
      "बिक्री",
      "ऑर्डर",
    ],
  },
  {
    path: "/production",
    words: [
      "production",
      "உற்பத்தி",
      "उत्पादन",
    ],
  },
  {
    path: "/inventory",
    words: [
      "inventory",
      "stock",
      "இருப்பு",
      "ஸ்டாக்",
      "स्टॉक",
      "भंडार",
    ],
  },
  {
    path: "/purchases",
    words: [
      "purchases",
      "கொள்முதல்",
      "खरीद",
    ],
  },
  {
    path: "/invoices",
    words: [
      "invoice",
      "billing",
      "விலைப்பட்டியல்",
      "பில்",
      "चालान",
      "बिल",
    ],
  },
  {
    path: "/payments",
    words: [
      "payments",
      "பணம்",
      "भुगतान",
    ],
  },
  {
    path: "/reports",
    words: [
      "reports",
      "அறிக்கைகள்",
      "रिपोर्ट",
    ],
  },
  {
    path: "/masters",
    words: [
      "master data",
      "முதன்மை தரவு",
      "मास्टर डेटा",
    ],
  },
  {
    path: "/audit",
    words: [
      "audit",
      "தணிக்கை",
      "ऑडिट",
    ],
  },
  {
    path: "/settings",
    words: [
      "settings",
      "அமைப்புகள்",
      "सेटिंग्स",
    ],
  },
];

export function detectIntent(
  input: string
): MozhiIntent {
  const text = normalize(input);

  if (!text) {
    return { type: "unknown" };
  }

  // Language switching.

  if (
    matches(text, [
      "switch",
      "change language",
      "speak",
      "மாற்று",
      "பேசு",
      "बदलो",
      "बोलो",
    ])
  ) {
    if (
      matches(text, [
        "tamil",
        "தமிழ்",
        "तमिल",
      ])
    ) {
      return {
        type: "language",
        language: "ta",
      };
    }

    if (
      matches(text, [
        "hindi",
        "இந்தி",
        "हिंदी",
        "हिन्दी",
      ])
    ) {
      return {
        type: "language",
        language: "hi",
      };
    }

    if (
      matches(text, [
        "english",
        "ஆங்கிலம்",
        "अंग्रेजी",
        "अंग्रेज़ी",
      ])
    ) {
      return {
        type: "language",
        language: "en",
      };
    }
  }

  // Explicit navigation commands.

  const navigation = matches(text, [
    "open",
    "go to",
    "navigate",
    "page",
    "திற",
    "பக்கத்திற்கு",
    "खोलो",
    "खोलें",
    "जाओ",
  ]);

  if (navigation) {
    const route = ROUTES.find((route) =>
      matches(text, route.words)
    );

    if (route) {
      return {
        type: "navigate",
        path: route.path,
      };
    }
  }

  // Specific queries before general queries.

  if (
    matches(text, [
      "low stock",
      "reorder",
      "shortage",
      "குறைந்த இருப்பு",
      "மறுகொள்முதல்",
      "कम स्टॉक",
      "स्टॉक की कमी",
    ])
  ) {
    return { type: "reorder" };
  }

  if (
    matches(text, [
      "pending order",
      "orders pending",
      "நிலுவை ஆர்டர்",
      "நிலுவையில் உள்ள ஆர்டர்",
      "लंबित ऑर्डर",
      "पेंडिंग ऑर्डर",
    ])
  ) {
    return { type: "pending_orders" };
  }

  if (
    matches(text, [
      "outstanding",
      "receivable",
      "unpaid",
      "நிலுவை",
      "வரவேண்டிய தொகை",
      "बकाया",
      "उधार",
    ])
  ) {
    return { type: "outstanding" };
  }

  if (
    matches(text, [
      "production",
      "yield",
      "உற்பத்தி",
      "उत्पादन",
    ])
  ) {
    return { type: "production" };
  }

  if (
    matches(text, [
      "stock",
      "inventory",
      "available packets",
      "இருப்பு",
      "ஸ்டாக்",
      "स्टॉक",
      "भंडार",
    ])
  ) {
    return { type: "stock" };
  }

  if (
    matches(text, [
      "sales",
      "revenue",
      "விற்பனை",
      "बिक्री",
    ])
  ) {
    return { type: "sales" };
  }

  if (
    matches(text, [
      "help",
      "commands",
      "what can you do",
      "உதவி",
      "என்ன செய்ய முடியும்",
      "मदद",
      "सहायता",
    ])
  ) {
    return { type: "help" };
  }

  return { type: "unknown" };
}
