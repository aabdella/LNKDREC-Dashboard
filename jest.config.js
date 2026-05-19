/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        paths: { '@/*': ['./*'] },
      },
    }],
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
};

module.exports = config;
