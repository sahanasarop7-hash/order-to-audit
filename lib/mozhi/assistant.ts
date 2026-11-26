
import { supabase } from "@/lib/supabase";

import {
  detectIntent,
  type MozhiLanguage,
} from "./intents";

type AssistantResponse = {
  message: string;
  path?: string;
  language?: MozhiLanguage;
};

type LocalizedText = [
  string,
  string,
  string
];

type DataRow = Record<string, unknown>;

function localize(
  language: MozhiLanguage,
  messages: LocalizedText
) {
  const index = {
    en: 0,
    ta: 1,
    hi: 2,
  }[language];

  return messages[index];
}

function money(value: unknown) {
  return Number(value ?? 0).toLocaleString(
    "en-IN",
    {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }
  );
}

function number(value: unknown) {
  return Number(value ?? 0).toLocaleString(
    "en-IN",
    {
      maximumFractionDigits: 2,
    }
  );
}

function getDates() {
  const today = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(new Date());

  return {
    p_start_date:
      `${today.slice(0, 7)}-01`,
    p_end_date: today,
  };
}

const FINANCE = [
  "admin",
  "accountant",
  "owner",
];

const OPERATIONS = [
  "admin",
  "production",
  "accountant",
  "owner",
];

const SALES = [
  "admin",
  "salesman",
  "accountant",
  "owner",
];

const ROUTE_ROLES: Record<string, string[]> = {
  "/dashboard": [
    "admin",
    "salesman",
    "production",
    "accountant",
    "owner",
  ],
  "/sales": SALES,
  "/production": OPERATIONS,
  "/inventory": OPERATIONS,
  "/purchases": OPERATIONS,
  "/invoices": SALES,
  "/payments": FINANCE,
  "/reports": OPERATIONS,
  "/masters": OPERATIONS,
  "/audit": FINANCE,
  "/settings": ["admin"],
};

function denied(
  language: MozhiLanguage
): AssistantResponse {
  return {
    message: localize(language, [
      "Your role does not have permission to access this information.",
      "இந்த தகவலை அணுக உங்கள் பயனர் பாத்திரத்திற்கு அனுமதி இல்லை.",
      "आपकी भूमिका को यह जानकारी देखने की अनुमति नहीं है।",
    ]),
  };
}

async function getDashboard() {
  const { data, error } = await supabase.rpc(
    "secure_dashboard",
    getDates()
  );

  if (error) {
    throw new Error(error.message);
  }

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    throw new Error(
      "Dashboard data is unavailable."
    );
  }

  return data as DataRow;
}

export async function askMozhi(
  input: string,
  language: MozhiLanguage,
  role: string
): Promise<AssistantResponse> {
  const intent = detectIntent(input);

  const reply = (
    messages: LocalizedText
  ): AssistantResponse => ({
    message: localize(language, messages),
  });

  switch (intent.type) {
    case "navigate": {
      const allowed =
        ROUTE_ROLES[intent.path] ?? [];

      if (!allowed.includes(role)) {
        return denied(language);
      }

      return {
        ...reply([
          "Opening the requested page.",
          "கோரிய பக்கத்தைத் திறக்கிறேன்.",
          "अनुरोधित पृष्ठ खोल रही हूँ।",
        ]),
        path: intent.path,
      };
    }

    case "language":
      return {
        language: intent.language,
        message: localize(
          intent.language,
          [
            "Language changed to English.",
            "மொழி தமிழுக்கு மாற்றப்பட்டது.",
            "भाषा हिंदी में बदल दी गई है।",
          ]
        ),
      };

    case "stock": {
      if (
        !SALES.includes(role) &&
        !OPERATIONS.includes(role)
      ) {
        return denied(language);
      }

      const { data, error } =
        await supabase.rpc(
          "secure_product_stock"
        );

      if (error) {
        throw new Error(error.message);
      }

      const products = data ?? [];

      if (products.length === 0) {
        return reply([
          "No finished products were found.",
          "தயாரிக்கப்பட்ட பொருட்கள் எதுவும் இல்லை.",
          "कोई तैयार उत्पाद नहीं मिला।",
        ]);
      }

      const details = products
        .slice(0, 10)
        .map(
          (product) =>
            `${product.name}: ${number(
              product.available_stock
            )}`
        )
        .join("\n");

      const suffix =
        products.length > 10
          ? localize(language, [
              "\nShowing the first 10 products.",
              "\nமுதல் 10 பொருட்கள் காட்டப்படுகின்றன.",
              "\nपहले 10 उत्पाद दिखाए गए हैं।",
            ])
          : "";

      return reply([
        `Available finished goods stock in packets:\n${details}${suffix}`,
        `விற்பனைக்குக் கிடைக்கும் பாக்கெட்டுகள்:\n${details}${suffix}`,
        `बिक्री के लिए उपलब्ध पैकेट:\n${details}${suffix}`,
      ]);
    }

    case "pending_orders": {
      if (!SALES.includes(role)) {
        return denied(language);
      }

      const { count, error } =
        await supabase
          .from("sales_orders")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("status", "pending");

      if (error) {
        throw new Error(error.message);
      }

      const pending = count ?? 0;

      return reply([
        `There are ${pending} pending orders visible to your account.`,
        `உங்கள் கணக்கில் ${pending} நிலுவை ஆர்டர்கள் உள்ளன.`,
        `आपके खाते में ${pending} लंबित ऑर्डर हैं।`,
      ]);
    }

    case "sales": {
      if (!FINANCE.includes(role)) {
        return denied(language);
      }

      const data = await getDashboard();

      const amount = money(data.net_sales);

      return reply([
        `Net sales this month are ${amount}, excluding GST.`,
        `இந்த மாத நிகர விற்பனை GST தவிர்த்து ${amount}.`,
        `इस महीने GST के बिना शुद्ध बिक्री ${amount} है।`,
      ]);
    }

    case "outstanding": {
      if (!FINANCE.includes(role)) {
        return denied(language);
      }

      const { data, error } =
        await supabase.rpc(
          "secure_financial_report",
          {
            p_report:
              "customer_outstanding_report",
          }
        );

      if (error) {
        throw new Error(error.message);
      }

      if (!Array.isArray(data)) {
        throw new Error(
          "Outstanding data is unavailable."
        );
      }

      const rows = data as DataRow[];

      const total = rows.reduce(
        (sum, row) =>
          sum +
          Math.round(
            Number(
              row.total_outstanding ?? 0
            ) * 100
          ),
        0
      ) / 100;

      const amount = money(total);

      return reply([
        `The current total outstanding amount is ${amount}.`,
        `தற்போதைய மொத்த நிலுவைத் தொகை ${amount}.`,
        `वर्तमान कुल बकाया राशि ${amount} है।`,
      ]);
    }

    case "production": {
      if (!OPERATIONS.includes(role)) {
        return denied(language);
      }

      const dates = getDates();

      const { data, error } =
        await supabase
          .from("production_summary_report")
          .select(
            "planned_output, actual_output"
          )
          .gte(
            "production_date",
            dates.p_start_date
          )
          .lte(
            "production_date",
            dates.p_end_date
          );

      if (error) {
        throw new Error(error.message);
      }

      const rows = data ?? [];

      if (rows.length >= 1000) {
        throw new Error(
          "Too many batches. Please use the production report."
        );
      }

      const planned = rows.reduce(
        (sum, row) =>
          sum + Number(
            row.planned_output ?? 0
          ),
        0
      );

      const actual = rows.reduce(
        (sum, row) =>
          sum + Number(
            row.actual_output ?? 0
          ),
        0
      );

      if (planned === 0) {
        return reply([
          "No posted production was found this month.",
          "இந்த மாதம் பதிவுசெய்யப்பட்ட உற்பத்தி இல்லை.",
          "इस महीने कोई दर्ज उत्पादन नहीं मिला।",
        ]);
      }

      const yieldRate =
        ((actual / planned) * 100)
          .toFixed(2);

      return reply([
        `This month, ${actual} good packets were produced against ${planned} planned packets. Production yield is ${yieldRate}%.`,
        `இந்த மாதம் திட்டமிட்ட ${planned} பாக்கெட்டுகளில் ${actual} நல்ல பாக்கெட்டுகள் தயாரிக்கப்பட்டுள்ளன. உற்பத்தி திறன் ${yieldRate}%.`,
        `इस महीने ${planned} नियोजित पैकेटों के मुकाबले ${actual} अच्छे पैकेट बने हैं। उत्पादन प्राप्ति ${yieldRate}% है।`,
      ]);
    }

    case "reorder": {
      if (!OPERATIONS.includes(role)) {
        return denied(language);
      }

      const { data, error } =
        await supabase.rpc(
          "secure_reorder_alerts"
        );

      if (error) {
        throw new Error(error.message);
      }

      if (!Array.isArray(data)) {
        throw new Error(
          "Reorder data is unavailable."
        );
      }

      const rows = data as DataRow[];

      if (rows.length === 0) {
        return reply([
          "There are no current reorder alerts.",
          "தற்போது மறுகொள்முதல் எச்சரிக்கைகள் இல்லை.",
          "वर्तमान में कोई पुनः खरीद चेतावनी नहीं है।",
        ]);
      }

      const details = rows
        .slice(0, 10)
        .map(
          (row) =>
            `${row.item_name}: ${number(
              row.available_stock
            )} ${row.unit ?? ""}`
        )
        .join("\n");

      return reply([
        `${rows.length} items require stock attention. Showing up to 10 items:\n${details}`,
        `${rows.length} பொருட்களின் இருப்பைக் கவனிக்க வேண்டும். அதிகபட்சம் 10 பொருட்கள்:\n${details}`,
        `${rows.length} वस्तुओं के स्टॉक पर ध्यान देना आवश्यक है। अधिकतम 10 वस्तुएँ:\n${details}`,
      ]);
    }

    case "help":
      return reply([
        "Ask me about available stock, pending orders, monthly sales, outstanding payments, production yield or reorder alerts. You can also ask me to open a page or change the language. Access depends on your role.",
        "இருப்பு, நிலுவை ஆர்டர்கள், மாத விற்பனை, நிலுவைத் தொகை, உற்பத்தி திறன் அல்லது மறுகொள்முதல் பற்றி கேளுங்கள். பக்கங்களைத் திறக்கவும் மொழியை மாற்றவும் கேட்கலாம்.",
        "स्टॉक, लंबित ऑर्डर, मासिक बिक्री, बकाया भुगतान, उत्पादन या पुनः खरीद के बारे में पूछें। आप पृष्ठ खोलने और भाषा बदलने के लिए भी कह सकते हैं।",
      ]);

    default:
      return reply([
        "I could not recognize that command. Ask for help to see supported commands.",
        "இந்த கட்டளையைப் புரிந்துகொள்ள முடியவில்லை. ஆதரிக்கப்படும் கட்டளைகளுக்கு உதவி கேளுங்கள்.",
        "मैं यह आदेश नहीं समझ सकी। समर्थित आदेशों के लिए मदद माँगें।",
      ]);
  }
}
