import { z } from 'zod';
import { notionRequest } from '../lib/notion-client.js';
import type { ToolResponse } from '../types/index.js';

export const getDataSourceSchemaSchema = z.object({
  data_source_id: z
    .string()
    .min(1)
    .describe(
      'データソースID。公式Notion MCPの notion-fetch でデータベースを取得し、レスポンスの data_sources 配列から data_source_id を取得できる。database_id とは異なるIDなので注意。',
    ),
});

export async function getDataSourceSchemaHandler(
  args: z.infer<typeof getDataSourceSchemaSchema>,
  _extra?: unknown,
): Promise<ToolResponse> {
  const result = await notionRequest<Record<string, unknown>>({
    method: 'GET',
    path: `/data_sources/${args.data_source_id}`,
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

export const getDataSourceSchemaTool = {
  name: 'get-data-source-schema',
  description:
    'データソースのスキーマ（プロパティ一覧と型情報）を取得。公式Notion MCPにはスキーマ取得ツールがないため、プロパティの型・選択肢・IDを確認するにはこのツールを使用する。query-databaseでフィルタやソートを使う場合は、まずこのツールでプロパティ名・型・選択肢を確認すること。select/multi_selectのオプション一覧、プロパティID、relation先データベース等の情報を含む。',
  paramsSchema: getDataSourceSchemaSchema.shape,
};
