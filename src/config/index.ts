/**
 * NOTE: This file previously exported an INCOMPLETE config that was missing
 * `whatsapp.internalApiKey`, `whatsapp.botBaseUrl`, and `bcryptRounds`.
 *
 * ROOT CAUSE: TypeScript resolves `import from './config'` to src/config.ts
 * (file beats directory). So at compile time every import got the CORRECT
 * src/config.ts. But tsc cannot output BOTH dist/config.js (from src/config.ts)
 * AND dist/config/index.js (from src/config/index.ts) — the directory wins in
 * the filesystem, so dist/config.js was silently dropped. At runtime,
 * require('./config') in dist/app.js resolved to dist/config/index.js
 * (this file, compiled) — the INCOMPLETE one.
 *
 * FIX: This file now re-exports everything from src/config.ts so that
 * both the TypeScript compiler and the Node.js runtime get the same config.
 * src/config.ts remains the single source of truth.
 */
export { config } from '../config';
