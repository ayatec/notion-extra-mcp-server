import { z } from 'zod';
import { notionRequest } from '../lib/notion-client.js';
import type { ToolResponse } from '../types/index.js';

export const queryDatabaseSchema = z.object({
  data_source_id: z
    .string()
    .min(1)
    .describe(
      'データソースID。公式Notion MCPの notion-fetch でデータベースを取得し、レスポンスの data_sources 配列から data_source_id を取得できる。database_id とは異なるIDなので注意。',
    ),
  filter: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      'Notion APIフィルタオブジェクト。例: {"property": "Status", "select": {"equals": "Done"}}。複合フィルタ: {"and": [{"property": "Status", "select": {"equals": "Done"}}, {"property": "Priority", "number": {"greater_than": 3}}]}。まず get-data-source-schema でプロパティ名と型を確認すること。',
    ),
  sorts: z
    .array(z.record(z.string(), z.unknown()))
    .optional()
    .describe(
      'ソート条件の配列。例: [{"property": "Name", "direction": "ascending"}]、タイムスタンプソート: [{"timestamp": "created_time", "direction": "descending"}]',
    ),
  page_size: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(100)
    .describe('1ページあたりの取得件数（デフォルト: 100、最大: 100）'),
  start_cursor: z
    .string()
    .optional()
    .describe(
      '前回のレスポンスの next_cursor の値をそのまま指定して次ページを取得。初回リクエストでは省略。',
    ),
  filter_properties: z
    .array(z.string())
    .optional()
    .describe(
      '取得するプロパティIDの配列（プロパティ名ではなく、get-data-source-schema で確認できる短い内部ID）。指定すると不要なプロパティを除外でき、レスポンスサイズとトークン消費を削減できる。',
    ),
});

export async function queryDatabaseHandler(
  args: z.infer<typeof queryDatabaseSchema>,
  _extra?: unknown,
): Promise<ToolResponse> {
  const body: Record<string, unknown> = {};
  if (args.filter) body.filter = args.filter;
  if (args.sorts) body.sorts = args.sorts;
  body.page_size = args.page_size;
  if (args.start_cursor) body.start_cursor = args.start_cursor;

  // filter_properties はクエリパラメータとして付与
  const queryParams: Record<string, string[]> | undefined = args.filter_properties
    ? { filter_properties: args.filter_properties }
    : undefined;

  const result = await notionRequest<Record<string, unknown>>({
    method: 'POST',
    path: `/data_sources/${args.data_source_id}/query`,
    body,
    queryParams,
  });

  if (!result.ok) {
    return {
      content: [
        {
          type: 'text',
          text: `Notion API error (${result.status}): [${result.code}] ${result.message}`,
        },
      ],
      isError: true,
    };
  }

  return {
    content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
  };
}

export const queryDatabaseTool = {
  name: 'query-database',
  description:
    'Notionデータソースをフィルター・ソート付きでクエリ。公式Notion MCPにはデータベースのフィルタ付きクエリ機能がないため、構造化されたデータ取得にはこのツールを使用する。公式の notion-search はキーワード検索のみ。filter_propertiesで必要なプロパティのみ取得するとトークン消費を削減できる。結果にhas_more/next_cursorが含まれる場合、start_cursorに指定して次ページを取得可能。has_moreがtrueの場合は必ず次ページを取得すること。フィルタやソートを使う場合は、まず get-data-source-schema でプロパティ名・型・選択肢を確認すること。',
  paramsSchema: queryDatabaseSchema.shape,
};
