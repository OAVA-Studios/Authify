import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateKeyPairSync } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Generate test RSA keys for JWT
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

process.env.NODE_ENV = 'test';
process.env.API_PORT = '4000';
process.env.API_URL = 'http://localhost:4000';
process.env.DASHBOARD_URL = 'http://localhost:3001';
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379/1';
process.env.JWT_PRIVATE_KEY = privateKey;
process.env.JWT_PUBLIC_KEY = publicKey;
process.env.ENCRYPTION_KEY = 'a'.repeat(64);
process.env.API_KEY_SALT = 'test-salt';
process.env.MINIO_ENDPOINT = 'localhost';
process.env.MINIO_PORT = '9000';
process.env.MINIO_ACCESS_KEY = 'test';
process.env.MINIO_SECRET_KEY = 'test';
process.env.MINIO_BUCKET_PREFIX = 'test';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'src/tests/', '**/*.d.ts'],
    },
  },
  resolve: {
    alias: [
      {
        find: /^@authify\/db$/,
        replacement: path.resolve(__dirname, '../../packages/db/src/index.ts'),
      },
      {
        find: /^@authify\/db\/schema$/,
        replacement: path.resolve(__dirname, '../../packages/db/src/schema/index.ts'),
      },
      {
        find: /^@authify\/shared$/,
        replacement: path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      },
    ],
  },
  server: {
    fs: {
      allow: ['..', '../../packages'],
    },
  },
});
