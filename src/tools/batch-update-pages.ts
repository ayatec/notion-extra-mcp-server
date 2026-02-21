import { z } from 'zod';
import { notionRequest } from '../lib/notion-client.js';
import { RateLimiter } from '../utils/rate-limiter.js';
import type { ToolResponse, BatchUpdateResult, BatchUpdateSummary } from '../types/index.js';

const updateItemSchema = z.object({
  page_id: z.string().min(1).describe('更新対象のページID'),
  properties: z
    .record(z.string(), z.unknown())
    .describe(
      '更新するプロパティオブジェクト。例: {"Status": {"select": {"name": "Done"}}, "Priority": {"number": 5}}',
    ),
});

export const batchUpdatePagesSchema = z.object({
  updates: z
    .array(updateItemSchema)
    .min(1)
    .max(50)
    .describe('更新リスト（最大50件）。各要素に page_id と properties を指定'),
});

const rateLimiter = new RateLimiter(3);

export async function batchUpdatePagesHandler(
  args: z.infer<typeof batchUpdatePagesSchema>,
  _extra?: unknown,
): Promise<ToolResponse> {
  const results: BatchUpdateResult[] = [];

  for (const update of args.updates) {
    await rateLimiter.wait();

    const result = await notionRequest<Record<string, unknown>>({
      method: 'PATCH',
      path: `/pages/${update.page_id}`,
      body: { properties: update.properties },
    });

    if (result.ok) {
      results.push({ page_id: update.page_id, success: true });
    } else {
      results.push({
        page_id: update.page_id,
        success: false,
        error: `(${result.status}) [${result.code}] ${result.message}`,
      });
    }
  }

  const summary: BatchUpdateSummary = {
    total: results.length,
    succeeded: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  };

  const hasFailure = summary.failed > 0;

  return {
    content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
    ...(hasFailure && { isError: true }),
  };
}

export const batchUpdatePagesTool = {
  name: 'batch-update-pages',
  description:
    '複数ページのプロパティを一括更新。公式MCPの notion-update-page は1ページずつの更新のみ。複数ページの一括更新にはこのツールを使用する。レート制限（3req/s）を考慮して順次実行。最大50件。各ページに異なるプロパティを指定可能。1つの失敗が全体を止めない（各リクエストの結果を個別に記録）。query-databaseで対象ページを取得し、そのIDリストを使って一括更新するワークフローに最適。',
  paramsSchema: batchUpdatePagesSchema.shape,
};
