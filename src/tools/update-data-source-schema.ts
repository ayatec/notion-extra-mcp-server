import { z } from 'zod';
import { notionRequest } from '../lib/notion-client.js';
import type { ToolResponse } from '../types/index.js';

export const updateDataSourceSchemaSchema = z.object({
  data_source_id: z
    .string()
    .min(1)
    .describe(
      'データソースID。公式Notion MCPの notion-fetch でデータベースを取得し、レスポンスの data_sources 配列から data_source_id を取得できる。database_id とは異なるIDなので注意。',
    ),
  properties: z
    .record(z.string(), z.unknown())
    .describe(
      'プロパティ定義オブジェクト。例: オプション追加 {"Status": {"select": {"options": [{"name": "Todo"}, {"name": "In Progress"}, {"name": "Done"}]}}}、プロパティ名変更 {"旧名前": {"name": "新名前"}}、プロパティ削除 {"削除対象": null}。select/multi_selectのoptionsは全オプションを指定する必要がある（省略されたオプションは削除される）。',
    ),
});

export async function updateDataSourceSchemaHandler(
  args: z.infer<typeof updateDataSourceSchemaSchema>,
  _extra?: unknown,
): Promise<ToolResponse> {
  // Data Sources API（/v1/data_sources/{id}）を使用
  const result = await notionRequest<Record<string, unknown>>({
    method: 'PATCH',
    path: `/data_sources/${args.data_source_id}`,
    body: { properties: args.properties },
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

export const updateDataSourceSchemaTool = {
  name: 'update-data-source-schema',
  description:
    'データソースのスキーマ（プロパティ定義）を更新。公式Notion MCPではselect/multi_selectオプション追加等の細かいスキーマ操作ができないため、このツールを使用する。select/multi_selectにオプションを追加、プロパティ名の変更、新しいプロパティの追加、プロパティの削除が可能。重要: select/multi_selectのoptionsは全オプションを指定する必要がある（省略されたオプションは削除される）。statusプロパティのname/options変更は不可。まず get-data-source-schema で現在のスキーマを確認してから更新すること。',
  paramsSchema: updateDataSourceSchemaSchema.shape,
};
