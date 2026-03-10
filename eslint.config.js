import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["out", "media", "vendor", "*.vsix"]),
  // Extension host code (Node.js)
  {
    files: ["src/**/*.ts"],
    ignores: ["src/webview/**"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  // Webview code (Browser + React)
  {
    files: ["src/webview/**/*.{ts,tsx}"],
    extends: [js.configs.recommended, tseslint.configs.recommended, reactHooks.configs.flat.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Build scripts
  {
    files: ["*.mjs", "scripts/**/*.mjs"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
  },
]);
