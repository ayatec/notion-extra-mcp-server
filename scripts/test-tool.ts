#!/usr/bin/env tsx
// ESM import より先に環境変数を読み込む
import 'dotenv/config';
import { argv } from 'process';
import type { ZodObject, ZodRawShape } from 'zod';
import {
  queryDatabaseHandler,
  queryDatabaseSchema,
  getDataSourceSchemaHandler,
  getDataSourceSchemaSchema,
  updateDataSourceSchemaHandler,
  updateDataSourceSchemaSchema,
  archivePageHandler,
  archivePageSchema,
  batchUpdatePagesHandler,
  batchUpdatePagesSchema,
} from '../src/tools/index.js';

type ToolParams = Record<string, unknown>;
type ToolResult = {
  content?: Array<{ type: string; text: string }>;
  [key: string]: unknown;
};
type ToolHandler = (params: ToolParams) => Promise<ToolResult>;

if (!process.env.NOTION_TOKEN) {
  console.error('Error: NOTION_TOKEN is not set in .env file');
  process.exit(1);
}

// ツールハンドラー・スキーマ一覧
const tools: Record<string, { handler: ToolHandler; schema: ZodObject<ZodRawShape> }> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query_database: { handler: queryDatabaseHandler as any, schema: queryDatabaseSchema as any },
  get_data_source_schema: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: getDataSourceSchemaHandler as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema: getDataSourceSchemaSchema as any,
  },
  update_data_source_schema: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: updateDataSourceSchemaHandler as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema: updateDataSourceSchemaSchema as any,
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  archive_page: { handler: archivePageHandler as any, schema: archivePageSchema as any },
  batch_update_pages: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler: batchUpdatePagesHandler as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema: batchUpdatePagesSchema as any,
  },
};

// CLI引数パース
function parseArgs(): { toolName: string; params: ToolParams } | null {
  const args = argv.slice(2);
  if (args.length === 0) return null;

  const toolName = args[0];
  const params: ToolParams = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = args[i + 1];
      if (value && !value.startsWith('--')) {
        // JSON配列/オブジェクトの場合はパース
        if (value.startsWith('[') || value.startsWith('{')) {
          try {
            params[key] = JSON.parse(value);
          } catch {
            params[key] = value;
          }
        } else if (value === 'true') {
          params[key] = true;
        } else if (value === 'false') {
          params[key] = false;
        } else if (/^\d+$/.test(value)) {
          params[key] = Number(value);
        } else {
          params[key] = value;
        }
        i++;
      } else {
        params[key] = true;
      }
    }
  }

  return { toolName, params };
}

function showHelp() {
  console.log(`
Tool Tester - MCPツールを個別にテスト

Usage:
  pnpm dev:tool <tool_name> [--param value ...]

Examples:
  pnpm dev:tool get_data_source_schema --data_source_id "ds-xxx"
  pnpm dev:tool query_database --data_source_id "ds-xxx" --page_size 10
  pnpm dev:tool query_database --data_source_id "ds-xxx" --filter '{"property": "Status", "select": {"equals": "Done"}}'
  pnpm dev:tool update_data_source_schema --data_source_id "ds-xxx" --properties '{"NewProp": {"rich_text": {}}}'
  pnpm dev:tool archive_page --page_id "page-xxx"
  pnpm dev:tool batch_update_pages --updates '[{"page_id": "p1", "properties": {"Name": {"title": [{"text": {"content": "New"}}]}}}]'

Available tools:
  ${Object.keys(tools).join(', ')}
`);
}

async function main() {
  if (argv.includes('--help') || argv.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  const cliArgs = parseArgs();
  if (!cliArgs) {
    showHelp();
    process.exit(1);
  }

  const { toolName, params } = cliArgs;

  if (!tools[toolName]) {
    console.error(`Unknown tool: ${toolName}`);
    console.log('Available tools:', Object.keys(tools).join(', '));
    process.exit(1);
  }

  // Zodスキーマでパースしてデフォルト値を適用
  const { handler, schema } = tools[toolName];
  const parsed = schema.parse(params);

  console.log(`\nTesting tool: ${toolName}`);
  console.log('Parameters:', JSON.stringify(parsed, null, 2));

  try {
    const result = await handler(parsed);
    console.log('\nResult:');
    if (result.content && result.content[0]) {
      console.log(result.content[0].text);
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error('\nError:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
