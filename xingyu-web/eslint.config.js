import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

/*
 * ESLint flat config.  ESLint 9 (not 10) on purpose: eslint-plugin-jsx-a11y@6
 * peer-requires `eslint ^3…^9`, and a11y linting is worth more here than the
 * newer major.
 *
 * Scope decision (P1-2, 2026-09-29): only the two classic react-hooks rules are
 * enabled.  eslint-plugin-react-hooks v7 ships the React Compiler rule set
 * (set-state-in-effect / immutability / refs / purity …) inside `recommended`,
 * and this codebase fetches data in `useEffect` + `setState` throughout — turning
 * those on as errors would demand a data-fetching rewrite, which is its own
 * project.  The 8 `react-hooks/exhaustive-deps` warnings that DO fire are left
 * as warnings on purpose: they are real (6 unstable useMemo deps, 2 missing
 * deps), but changing dependency arrays is behaviour-sensitive and this machine
 * has no browser acceptance path.
 */
export default [
  {
    ignores: ["dist/**", "coverage/**", "node_modules/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    ...jsxA11y.flatConfigs.recommended,
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      // The app wraps its text input in a local `<Input>` component, so the rule
      // cannot see the control a `<label>` wraps unless we name it here.
      "jsx-a11y/label-has-associated-control": [
        "error",
        { controlComponents: ["Input", "Textarea", "Select"], assert: "either" },
      ],

      // The codebase uses a leading underscore to mark intentionally unused
      // bindings (`_file`, `_text`, `_message`, catch params).
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
];
