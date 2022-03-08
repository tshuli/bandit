module.exports = {
  env: {
    browser: true,
    es2021: true,
    jest: true
  },
  extends: [
    'plugin:react/recommended',
    'standard'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true
    },
    ecmaVersion: 12,
    sourceType: 'module'
  },
  plugins: [
    'react',
    '@typescript-eslint'
  ],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/self-closing-comp': ['warn', {
      component: true,
      html: true
    }],
    'no-use-before-define': 'off',
    '@typescript-eslint/no-use-before-define': 'off',
    'no-unused-vars': ['warn'],
    'react/display-name': ['warn'],
    indent: ['error', 2],
    'comma-dangle': ['error', 'never'],
    'array-bracket-spacing': ['error', 'never'],
    'object-curly-spacing': ['error', 'always'],
    'semi-spacing': ['error', {
      before: false,
      after: true
    }],
    'key-spacing': ['error', {
      beforeColon: false,
      afterColon: true
    }]
  },
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      rules: {
        'no-undef': 'off'
      }
    }
  ]
}
