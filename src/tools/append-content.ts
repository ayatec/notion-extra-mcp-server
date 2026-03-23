import { z } from 'zod';
import { notionRequest } from '../lib/notion-client.js';
import { formatNotionError } from '../utils/error-guidance.js';
import type { ToolResponse } from '../types/index.js';

export const appendContentSchema = z.object({
  page_id: z
    .string()
    .min(1)
    .describe(
      'Page ID to append to. Get from query-database or find-by-unique-id results (id field), or official Notion MCP.',
    ),
  content: z
    .string()
    .min(1)
    .describe(
      'Markdown content to append at page end. Supports: headings (# ## ###), lists (- *), numbered lists (1.), quotes (>), code blocks (```), bold (**text**), links ([text](url)), checklists (- [ ]), dividers (---).',
    ),
});

export async function appendContentHandler(
  args: z.infer<typeof appendContentSchema>,
  _extra?: unknown,
): Promise<ToolResponse> {
  const result = await notionRequest<Record<string, unknown>>({
    method: 'PATCH',
    path: `/pages/${args.page_id}/markdown`,
    body: {
      type: 'insert_content',
      insert_content: {
        content: args.content,
      },
    },
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
    content: [
      {
        type: 'text',
        text: JSON.stringify({ page_id: args.page_id, success: true }, null, 2),
      },
    ],
  };
}

export const appendContentTool = {
  name: 'append-content',
  description:
    'Append Markdown content to the end of a page. Does NOT touch existing content. When to use: append to end→this tool / edit specific part→official notion-update-page (update_content with old_str/new_str) / replace entire page→official notion-update-page (replace_content). Unlike update_content which requires exact old_str match (error-prone), this tool has no matching issues. No need to read existing content first.',
  paramsSchema: appendContentSchema.shape,
};
