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
  findByUniqueIdTool,
  findByUniqueIdHandler,
  modifyRelationTool,
  modifyRelationHandler,
  appendContentTool,
  appendContentHandler,
  batchFetchPagesTool,
  batchFetchPagesHandler,
} from './tools/index.js';

const server = new McpServer({
  name: config.server.name,
  version: config.server.version,
});

// ツール登録
const tools = [
  { tool: queryDatabaseTool, handler: queryDatabaseHandler },
  { tool: getDataSourceSchemaTool, handler: getDataSourceSchemaHandler },
  { tool: updateDataSourceSchemaTool, handler: updateDataSourceSchemaHandler },
  { tool: archivePageTool, handler: archivePageHandler },
  { tool: batchUpdatePagesTool, handler: batchUpdatePagesHandler },
  { tool: findByUniqueIdTool, handler: findByUniqueIdHandler },
  { tool: modifyRelationTool, handler: modifyRelationHandler },
  { tool: appendContentTool, handler: appendContentHandler },
  { tool: batchFetchPagesTool, handler: batchFetchPagesHandler },
];

for (const { tool, handler } of tools) {
  server.registerTool(
    tool.name,
    { description: tool.description, inputSchema: tool.paramsSchema },
    handler,
  );
}

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
