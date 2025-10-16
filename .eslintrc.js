module.exports = {
  root: true,
  env: { browser: true, es2021: true, node: true },
  extends: ['eslint:recommended', 'plugin:react/recommended'],
  parserOptions: { ecmaFeatures: { jsx: true }, ecmaVersion: 12, sourceType: 'module' },
  plugins: ['react'],
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: "Literal[value=/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/]",
        message: 'Use theme tokens instead of hardcoded hex colors.'
      },
      {
        selector: "Literal[value=/^(white|black)$/]",
        message: 'Use theme tokens instead of white/black.'
      },
    ],
  },
  overrides: [
    {
      files: ['src/theme/**'],
      rules: {
        'no-restricted-syntax': 'off',
      },
    },
  ],
};
