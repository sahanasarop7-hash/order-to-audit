
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const root = process.cwd();

const translationKeys = new Set();
const dynamicKeys = new Set();
const untranslatedText = new Set();

function scanFile(filePath) {
  const content = fs.readFileSync(
    filePath,
    "utf8"
  );

  const source = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx")
      ? ts.ScriptKind.TSX
      : ts.ScriptKind.TS
  );

  const relativePath = path.relative(
    root,
    filePath
  );

  function isLiteral(node) {
    return (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node)
    );
  }

  function recordText(node, value) {
    const text = value
      .replace(/\s+/g, " ")
      .trim();

    if (!text || !/[a-zA-Z]/.test(text)) {
      return;
    }

    const position =
      source.getLineAndCharacterOfPosition(
        node.getStart(source)
      );

    untranslatedText.add(
      `${relativePath}:${position.line + 1} | ${text}`
    );
  }

  function visit(node) {
    // Find existing t("Translation key") calls.

    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "t" &&
      node.arguments.length > 0
    ) {
      const argument = node.arguments[0];

      if (isLiteral(argument)) {
        translationKeys.add(argument.text);
      } else {
        dynamicKeys.add(
          `${relativePath} | ${argument.getText(source)}`
        );
      }
    }

    // Find visible JSX text.

    if (ts.isJsxText(node)) {
      recordText(node, node.getText(source));
    }

    // Find hardcoded labels and placeholders.

    if (ts.isJsxAttribute(node)) {
      const attribute = node.name.getText(source);

      const visibleAttributes = [
        "label",
        "title",
        "description",
        "placeholder",
        "searchPlaceholder",
        "addLabel",
        "message",
        "aria-label",
      ];

      if (
        visibleAttributes.includes(attribute) &&
        node.initializer
      ) {
        const initializer = node.initializer;

        if (ts.isStringLiteral(initializer)) {
          recordText(node, initializer.text);
        }

        if (
          ts.isJsxExpression(initializer) &&
          initializer.expression &&
          isLiteral(initializer.expression)
        ) {
          recordText(
            node,
            initializer.expression.text
          );
        }
      }
    }

    // Find table headers and card labels.

    if (
      ts.isPropertyAssignment(node) &&
      ["header", "label", "title", "description"]
        .includes(node.name.getText(source)
          .replace(/["']/g, ""))
    ) {
      if (isLiteral(node.initializer)) {
        recordText(node, node.initializer.text);
      }
    }

    // Find validation and notification messages.

    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText(source) === "toast" &&
      node.arguments.length > 0 &&
      isLiteral(node.arguments[0])
    ) {
      recordText(node, node.arguments[0].text);
    }

    if (
      ts.isNewExpression(node) &&
      node.expression.getText(source) === "Error" &&
      node.arguments?.length &&
      isLiteral(node.arguments[0])
    ) {
      recordText(node, node.arguments[0].text);
    }

    ts.forEachChild(node, visit);
  }

  visit(source);
}

function scanDirectory(directory) {
  if (!fs.existsSync(directory)) return;

  for (const entry of fs.readdirSync(
    directory,
    { withFileTypes: true }
  )) {
    const fullPath = path.join(
      directory,
      entry.name
    );

    if (entry.isDirectory()) {
      scanDirectory(fullPath);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      scanFile(fullPath);
    }
  }
}

for (const directory of [
  "app",
  "components",
  "contexts",
  "lib",
]) {
  scanDirectory(path.join(root, directory));
}

const languages = ["en", "ta", "hi"];

const keys = [...translationKeys].sort();

const missing = {};

for (const language of languages) {
  const dictionary = JSON.parse(
    fs.readFileSync(
      path.join(root, "locales", `${language}.json`),
      "utf8"
    )
  );

  missing[language] = keys.filter(
    (key) =>
      !Object.prototype.hasOwnProperty.call(
        dictionary,
        key
      ) ||
      typeof dictionary[key] !== "string" ||
      !dictionary[key].trim()
  );
}

const report = {
  totalTranslationKeys: keys.length,
  missingCounts: {
    en: missing.en.length,
    ta: missing.ta.length,
    hi: missing.hi.length,
  },
  existingTranslationKeys: keys,
  missingTranslations: missing,
  dynamicTranslationKeys: [...dynamicKeys].sort(),
  possibleHardcodedText: [...untranslatedText].sort(),
};

fs.writeFileSync(
  path.join(root, "translation-audit.json"),
  JSON.stringify(report, null, 2)
);

console.log("\nOrder2Audit — Translation Audit\n");

console.table({
  "Translation keys": keys.length,
  "Missing English": missing.en.length,
  "Missing Tamil": missing.ta.length,
  "Missing Hindi": missing.hi.length,
  "Dynamic translation calls": dynamicKeys.size,
  "Possible hardcoded text": untranslatedText.size,
});

console.log(
  "\nReport generated: translation-audit.json\n"
);
