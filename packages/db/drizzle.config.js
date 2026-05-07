import { defineConfig } from 'drizzle-kit';
export default defineConfig({
    schema: './src/schema/index.ts',
    out: './src/migrations',
    dialect: 'postgresql',
    dbCredentials: {
        url: process.env.DATABASE_URL ?? 'postgresql://authify:password@localhost:5432/authify',
    },
    verbose: true,
    strict: true,
});
//# sourceMappingURL=drizzle.config.js.map