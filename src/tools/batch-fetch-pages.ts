import { z } from 'zod';
import { notionRequest } from '../lib/notion-client.js';
import { RateLimiter } from '../utils/rate-limiter.js';
import { compactPage } from '../utils/compact.js';
import { formatNotionError } from '../utils/error-guidance.js';
import type { ToolResponse } from '../types/index.js';

export const batchFetchPagesSchema = z.object({
  page_ids: z
    .array(z.string().min(1))
    .min(1)
    .max(50)
    .describe(
      'Page IDs to fetch (max 50). Get from query-database results (id field) or other tools.',
    ),
  compact: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'If true, compress response: strip page metadata, flatten property values (title→string, select→name, relation→ID array, formula→computed value). Each page returns only id, url, properties. Default: false',
    ),
  include_content: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'If true, include page body as Markdown. Note: adds extra API call per page, ~2x total time. Default: false',
    ),
});

const rateLimiter = new RateLimiter(3);

export async function batchFetchPagesHandler(
  args: z.infer<typeof batchFetchPagesSchema>,
  _extra?: unknown,
): Promise<ToolResponse> {
  const results: Array<Record<string, unknown>> = [];
  const errors: Array<{ page_id: string; error: string }> = [];

  for (const pageId of args.page_ids) {
    await rateLimiter.wait();

    const result = await notionRequest<Record<string, unknown>>({
      method: 'GET',
      path: `/pages/${pageId}`,
    });

    if (!result.ok) {
      errors.push({
        page_id: pageId,
        error: formatNotionError(result.status, result.code, result.message),
      });
      continue;
    }

    let page: Record<string, unknown> = args.compact ? compactPage(result.data) : result.data;

    if (args.include_content) {
      await rateLimiter.wait();
      const contentResult = await notionRequest<Record<string, unknown>>({
        method: 'GET',
        path: `/pages/${pageId}/markdown`,
      });

      if (contentResult.ok) {
        page = { ...page, content: contentResult.data.markdown ?? '' };
      } else {
        page = {
          ...page,
          content_error: `Failed to fetch content (${contentResult.status}): ${contentResult.message}`,
        };
      }
    }

    results.push(page);
  }

  const output: Record<string, unknown> = { results };
  if (errors.length > 0) {
    output.errors = errors;
    output.guidance =
      'Some pages failed to fetch. Verify page_ids are correct and pages are not archived/deleted.';
  }

  const indent = args.compact ? undefined : 2;

  return {
    content: [{ type: 'text', text: JSON.stringify(output, null, indent) }],
    // isError only when ALL pages failed (partial success is not an error)
    ...(results.length === 0 && errors.length > 0 && { isError: true }),
  };
}

export const batchFetchPagesTool = {
  name: 'batch-fetch-pages',
  description:
    'Fetch multiple pages in one call (max 50). Auto rate-limited (3req/s). When to use: bulk page fetch→this tool / single page→official notion-fetch / filtered query from database→query-database. Typical workflow: query-database (compact:true) for lightweight ID list→batch-fetch-pages for details. Note: include_content:true adds extra API calls (~2x time).',
  paramsSchema: batchFetchPagesSchema.shape,
};
