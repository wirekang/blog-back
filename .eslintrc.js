module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'airbnb-base',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
  ],
  settings: {
    'import/extensions': ['.js', '.ts'],
    'import/resolver': {
      typescript: {},
    },
  },
  rules: {
    'no-console': 0,
  },
};
