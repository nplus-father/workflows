import js from "@eslint/js";
import tseslint from "typescript-eslint";
import astro from "eslint-plugin-astro";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    ignores: ["dist/", ".astro/", "node_modules/"],
  },
  {
    rules: {
      // Allow unused vars prefixed with _
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      // Astro uses var in frontmatter for conditional rendering
      "no-var": "off",
      // Astro var re-declarations in conditional blocks
      "no-redeclare": "off",
      // Inline analytics / 3rd-party snippets sometimes use arguments
      "prefer-rest-params": "off",
    },
  },
];
