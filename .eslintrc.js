module.exports = {
  root: true,
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
  ],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "import"],
  env: {
    node: true,
  },
  settings: {
    "import/resolver": {
      typescript: {},
    },
  },
  rules: {
    "import/no-unresolved": "error",
    // 🔴 Prohibir 'any' explícito (Fuerza a tipar todo correctamente)
    "@typescript-eslint/no-explicit-any": "error",
    // 🔴 Obliga a usar 'import type' para interfaces (mejora rendimiento del bundle)
    "@typescript-eslint/consistent-type-imports": "error",
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    // 🔴 Ordena los imports alfabéticamente para evitar caos en archivos grandes
    "import/order": [
      "error",
      {
        alphabetize: { order: "asc" },
      },
    ],
    // 🔴 Prohíbe console.log() sueltos. Solo permite warn y error.
    "no-console": ["warn", { allow: ["warn", "error"] }],
  },
  ignorePatterns: ["node_modules/", ".expo/", "babel.config.js"],
};
