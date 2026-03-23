import { z } from 'zod';
import { notionRequest } from '../lib/notion-client.js';
import { RateLimiter } from '../utils/rate-limiter.js';
import { formatNotionError } from '../utils/error-guidance.js';
import type { ToolResponse, BatchUpdateResult, BatchUpdateSummary } from '../types/index.js';

const updateItemSchema = z.object({
  page_id: z
    .string()
    .min(1)
    .describe(
      'Page ID to update. Get from query-database or find-by-unique-id results (id field), or official Notion MCP.',
    ),
  properties: z
    .record(z.string(), z.unknown())
    .describe(
      'Properties to update. Examples: {"Status": {"select": {"name": "Done"}}, "Priority": {"number": 5}, "Tags": {"multi_select": [{"name": "Important"}]}}',
    ),
});

export const batchUpdatePagesSchema = z.object({
  updates: z
    .array(updateItemSchema)
    .min(1)
    .max(50)
    .describe('Update list (max 50). Each item has page_id and properties.'),
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
        error: formatNotionError(result.status, result.code, result.message),
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
  if (hasFailure) {
    summary.guidance =
      'Check error details for failed pages. Verify page_id and property values, then retry failed items.';
  }

  return {
    content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
    // isError only when ALL updates failed (partial success is not an error)
    ...(summary.succeeded === 0 && hasFailure && { isError: true }),
  };
}

export const batchUpdatePagesTool = {
  name: 'batch-update-pages',
  description:
    'Bulk update properties of multiple pages (max 50). Auto rate-limited (3req/s), sequential execution. Individual failures do not stop the batch; each result is recorded separately. When to use: bulk property update→this tool / add/remove relation (preserving existing)→modify-relation / archive pages→archive-page. Typical workflow: query-database to get page IDs→batch-update-pages.',
  paramsSchema: batchUpdatePagesSchema.shape,
};
