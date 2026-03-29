/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ["eslint:recommended"],
  env: { es2022: true, node: true },
  rules: {
    "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  },
};
