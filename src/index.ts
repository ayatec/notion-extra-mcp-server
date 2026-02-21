#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { config } from './config.js';
import {
  queryDatabaseTool,
  queryDatabaseHandler,
  getDataSourceSchemaTool,
  getDataSourceSchemaHandler,
  updateDataSourceSchemaTool,
  updateDataSourceSchemaHandler,
  archivePageTool,
  archivePageHandler,
  batchUpdatePagesTool,
  batchUpdatePagesHandler,
} from './tools/index.js';

const server = new McpServer({
  name: config.server.name,
  version: config.server.version,
});

// ツール登録
server.registerTool(
  queryDatabaseTool.name,
  {
    description: queryDatabaseTool.description,
    inputSchema: queryDatabaseTool.paramsSchema,
  },
  queryDatabaseHandler,
);
server.registerTool(
  getDataSourceSchemaTool.name,
  {
    description: getDataSourceSchemaTool.description,
    inputSchema: getDataSourceSchemaTool.paramsSchema,
  },
  getDataSourceSchemaHandler,
);
server.registerTool(
  updateDataSourceSchemaTool.name,
  {
    description: updateDataSourceSchemaTool.description,
    inputSchema: updateDataSourceSchemaTool.paramsSchema,
  },
  updateDataSourceSchemaHandler,
);
server.registerTool(
  archivePageTool.name,
  {
    description: archivePageTool.description,
    inputSchema: archivePageTool.paramsSchema,
  },
  archivePageHandler,
);
server.registerTool(
  batchUpdatePagesTool.name,
  {
    description: batchUpdatePagesTool.description,
    inputSchema: batchUpdatePagesTool.paramsSchema,
  },
  batchUpdatePagesHandler,
);

async function main() {
  if (!process.env.NOTION_TOKEN) {
    console.error('Error: NOTION_TOKEN is not set. Set it in your environment or .env file.');
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${config.server.name} running on stdio`);
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
