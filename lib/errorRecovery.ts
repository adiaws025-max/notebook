export interface RecoveryResult {
  fixed: boolean;
  fixedCode: string;
  explanation: string;
}

interface Rule {
  detect: (code: string, error: string) => boolean;
  fix: (code: string, error: string) => { code: string; explanation: string };
}

const rules: Rule[] = [
  // Missing import
  {
    detect: (code, error) =>
      error.includes("NameError") &&
      /NameError: name '(\w+)' is not defined/.test(error),
    fix: (code, error) => {
      const match = error.match(/NameError: name '(\w+)' is not defined/);
      const name = match?.[1] ?? "";
      const importMap: Record<string, string> = {
        pd: "import pandas as pd",
        np: "import numpy as np",
        plt: "import matplotlib.pyplot as plt",
        sns: "import seaborn as sns",
        scipy: "import scipy",
      };
      if (importMap[name]) {
        return {
          code: importMap[name] + "\n" + code,
          explanation: `Added missing import: \`${importMap[name]}\``,
        };
      }
      return { code, explanation: "Could not determine the missing import." };
    },
  },

  // Wrong column reference
  {
    detect: (_code, error) => error.includes("KeyError"),
    fix: (code, error) => {
      const match = error.match(/KeyError: '(.+?)'/);
      const badCol = match?.[1];
      if (badCol) {
        return {
          code,
          explanation: `Column "${badCol}" does not exist. Check the column name in your CSV headers.`,
        };
      }
      return { code, explanation: "A column was referenced that does not exist." };
    },
  },

  // Type mismatch — tried numeric op on string
  {
    detect: (_code, error) =>
      error.includes("TypeError") &&
      (error.includes("unsupported operand") || error.includes("could not convert")),
    fix: (code, error) => {
      const colMatch = error.match(/'(.+?)'/);
      const col = colMatch?.[1] ?? "the column";
      const fixedCode = code.replace(
        /df\[['"](.+?)['"]\]/g,
        `pd.to_numeric(df['$1'], errors='coerce')`
      );
      return {
        code: fixedCode,
        explanation: `Type mismatch on "${col}". Wrapped numeric columns with \`pd.to_numeric(..., errors='coerce')\`.`,
      };
    },
  },

  // Indentation error
  {
    detect: (_code, error) => error.includes("IndentationError"),
    fix: (code, _error) => {
      const fixed = code
        .split("\n")
        .map((line) => line.replace(/^\t/, "    "))
        .join("\n");
      return {
        code: fixed,
        explanation: "Fixed indentation: replaced tabs with 4 spaces.",
      };
    },
  },
];

export function attemptRecovery(
  code: string,
  errorMessage: string
): RecoveryResult {
  for (const rule of rules) {
    if (rule.detect(code, errorMessage)) {
      const { code: fixedCode, explanation } = rule.fix(code, errorMessage);
      return { fixed: fixedCode !== code, fixedCode, explanation };
    }
  }
  return {
    fixed: false,
    fixedCode: code,
    explanation: "No automatic fix available for this error.",
  };
}
