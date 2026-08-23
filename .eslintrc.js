module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'import'],
  env: {
    node: true,
  },
  settings: {
    'import/resolver': {
      typescript: {}, // Esto le dice a ESLint que respete las rutas de tsconfig.json
    },
  },
  rules: {
    'import/no-unresolved': 'error', // 🔴 Romperá el linter si la ruta no existe
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
  ignorePatterns: ['node_modules/', '.expo/', 'babel.config.js'],
};

