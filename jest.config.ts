import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Add more setup options before each test is run
  moduleNameMapper: {
    // Handle module aliases (this will be automatically configured for you soon)
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/**/*.(test|spec).[jt]s?(x)'],
  // Claude Code のサブエージェント用 worktree（別のチェックアウト）は対象にしない
  modulePathIgnorePatterns: ['<rootDir>/.claude/worktrees/'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/.claude/worktrees/'],
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(config);
