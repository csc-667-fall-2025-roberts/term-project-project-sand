import eslintJs from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

const globals = {
  console: "readonly",
  process: "readonly",
  __dirname: "readonly",
  __filename: "readonly",
  Buffer: "readonly",
  module: "readonly",
  require: "readonly",
  exports: "readonly",
  window: "readonly",
  document: "readonly",
};

const jsRules = {
  "no-console": "error",
};

const tsRules = Object.assign({}, jsRules, {
  "@typescript-eslint/explicit-function-return-type": "off",
  "@typescript-eslint/no-unused-vars": [
    "warn",
    {
      args: "all",
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
    },
  ],
});

export default defineConfig([
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "package-lock.json",
      "src/public/**/*",
    ],
  },
  eslintJs.configs.recommended,
  ...tseslint.configs.recommended,
  eslintPluginPrettier,
  // eslint for typescript files
  {
    files: ["**/*.ts"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json",
      },
      globals,
    },
    rules: tsRules,
  },
  // eslint for javascript files
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals,
    },
    rules: jsRules,
  },
]);
