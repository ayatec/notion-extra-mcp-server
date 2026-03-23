import { z } from 'zod';
import { notionRequest } from '../lib/notion-client.js';
import { formatNotionError } from '../utils/error-guidance.js';
import type { ToolResponse } from '../types/index.js';

export const archivePageSchema = z.object({
  page_id: z
    .string()
    .min(1)
    .describe(
      'Page ID to archive. Get from query-database or find-by-unique-id results (id field), or official Notion MCP.',
    ),
});

export async function archivePageHandler(
  args: z.infer<typeof archivePageSchema>,
  _extra?: unknown,
): Promise<ToolResponse> {
  const result = await notionRequest<Record<string, unknown>>({
    method: 'PATCH',
    path: `/pages/${args.page_id}`,
    body: { archived: true },
  });

  if (!result.ok) {
    return {
      content: [
        {
          type: 'text',
          text: formatNotionError(result.status, result.code, result.message),
        },
      ],
      isError: true,
    };
  }

  return {
    content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
  };
}

export const archivePageTool = {
  name: 'archive-page',
  description:
    'Archive a page (move to trash). Database rows are pages, so this works for deleting rows too. When to use: archive 1 page→this tool / bulk property update→batch-update-pages (cannot archive via batch-update-pages). Restore via Notion UI. Permanent deletion not available via API.',
  paramsSchema: archivePageSchema.shape,
};
