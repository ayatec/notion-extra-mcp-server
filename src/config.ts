import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

export const config = {
  server: {
    name: 'notion-extra-mcp-server',
    version: pkg.version,
  },
  notion: {
    baseUrl: 'https://api.notion.com/v1',
    apiVersion: '2025-09-03',
  },
} as const;
