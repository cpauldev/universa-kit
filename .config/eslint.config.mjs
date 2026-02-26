import js from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/*.lock",
      "**/*.tsbuildinfo",
      "**/.git/**",
      "**/.github/**",
      "**/.config/**",
      "**/*.config.js",
      "**/*.config.ts",
      "**/*.config.mjs",
      "**/.next/**",
      "**/.nuxt/**",
      "**/.svelte-kit/**",
      "**/.output/**",
    ],
  },
  {
    files: ["examples/*/src/**/*.{js,ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-expressions": "error",
      "@typescript-eslint/no-require-imports": "error",
      "@typescript-eslint/no-empty-object-type": "error",
      "@typescript-eslint/ban-ts-comment": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/prefer-as-const": "error",
      "@typescript-eslint/no-inferrable-types": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-case-declarations": "error",
      "no-shadow-restricted-names": "error",
      "prefer-const": "error",
      "no-useless-escape": "error",
      "no-var": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-throw-literal": "error",
      "no-implicit-coercion": "error",
      "no-debugger": "error",
      "no-duplicate-imports": "error",
    },
  },
];
