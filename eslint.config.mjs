import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  { ignores: [".next/", "node_modules/", "next-env.d.ts", "out/", "var/", "pipeline/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: { "react-hooks": reactHooks, "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // lucide-react namespace imports measure ~181 KB gz (ADR-0006) — named
      // icon imports tree-shake to ~0.6 KB each. Ban only the namespace form.
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportDeclaration[source.value='lucide-react'] > ImportNamespaceSpecifier",
          message:
            "Never `import * as … from 'lucide-react'` — it ships ~181 KB gz. Import the named icons you use (~0.6 KB gz each). See docs/adr/0006-motion-and-icon-stack.md.",
        },
      ],
    },
  },
);
