import js from "@eslint/js";
import tseslint from "typescript-eslint";
import astro from "eslint-plugin-astro";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    // scripts/ 是 Node 端建置工具（migrate / enrich / audit），不走 app 的 TS lint
    ignores: ["dist/", ".astro/", "node_modules/", "scripts/", "pagefind/"],
  },
  {
    rules: {
      // Allow unused vars prefixed with _
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      // Astro frontmatter map/filter callbacks over content collections often use any; warn, don't block
      "@typescript-eslint/no-explicit-any": "warn",
      // Astro uses var in frontmatter for conditional rendering
      "no-var": "off",
      // Astro var re-declarations in conditional blocks
      "no-redeclare": "off",
      // Inline analytics / 3rd-party snippets sometimes use arguments
      "prefer-rest-params": "off",
    },
  },
];
