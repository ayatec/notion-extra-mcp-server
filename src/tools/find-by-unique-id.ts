import { z } from 'zod';
import { notionRequest } from '../lib/notion-client.js';
import { compactPage } from '../utils/compact.js';
import { formatNotionError } from '../utils/error-guidance.js';
import { findUniqueIdPropertyName } from '../utils/schema.js';
import type { ToolResponse } from '../types/index.js';

export const findByUniqueIdSchema = z.object({
  data_source_id: z
    .string()
    .min(1)
    .describe(
      'Data source ID. Get it from notion-fetch response: data_sources[].data_source_id. Note: this is NOT the database_id.',
    ),
  unique_id: z
    .string()
    .min(1)
    .describe(
      'Unique ID value. Prefixed format like "TASK-255" or "SPEC-12", or plain number like "42".',
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
    .describe('If true, include page body as Markdown. Default: false'),
});

// Parse unique_id string to extract number part (unique_id numbers are always positive)
function parseUniqueId(value: string): number {
  const dashIndex = value.lastIndexOf('-');
  if (dashIndex >= 0) {
    const numPart = value.slice(dashIndex + 1);
    const num = Number(numPart);
    if (!Number.isNaN(num) && num > 0) return num;
  }
  const num = Number(value);
  if (!Number.isNaN(num) && num > 0) return num;
  throw new Error(`Cannot parse number from unique_id: "${value}"`);
}

export async function findByUniqueIdHandler(
  args: z.infer<typeof findByUniqueIdSchema>,
  _extra?: unknown,
): Promise<ToolResponse> {
  const propResult = await findUniqueIdPropertyName(args.data_source_id);
  if (!propResult.ok) {
    return {
      content: [{ type: 'text', text: propResult.error }],
      isError: true,
    };
  }

  let idNumber: number;
  try {
    idNumber = parseUniqueId(args.unique_id);
  } catch (e) {
    return {
      content: [{ type: 'text', text: (e as Error).message }],
      isError: true,
    };
  }

  const queryResult = await notionRequest<Record<string, unknown>>({
    method: 'POST',
    path: `/data_sources/${args.data_source_id}/query`,
    body: {
      filter: {
        property: propResult.propertyName,
        unique_id: { equals: idNumber },
      },
      page_size: 1,
    },
  });

  if (!queryResult.ok) {
    return {
      content: [
        {
          type: 'text',
          text: formatNotionError(queryResult.status, queryResult.code, queryResult.message),
        },
      ],
      isError: true,
    };
  }

  const results = queryResult.data.results as Array<Record<string, unknown>>;
  if (!results || results.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: `No page found matching unique_id "${args.unique_id}". Verify the prefix and number are correct (e.g. "TASK-255").`,
        },
      ],
      isError: true,
    };
  }

  const page = results[0];
  let output: Record<string, unknown> = args.compact ? compactPage(page) : page;

  if (args.include_content) {
    const contentResult = await notionRequest<Record<string, unknown>>({
      method: 'GET',
      path: `/pages/${page.id}/markdown`,
    });

    if (contentResult.ok) {
      output = { ...output, content: contentResult.data.markdown ?? '' };
    } else {
      output = {
        ...output,
        content_error: `Failed to fetch page content (${contentResult.status}): ${contentResult.message}`,
      };
    }
  }

  const indent = args.compact ? undefined : 2;

  return {
    content: [{ type: 'text', text: JSON.stringify(output, null, indent) }],
  };
}

export const findByUniqueIdTool = {
  name: 'find-by-unique-id',
  description:
    'Find a single page by unique_id (auto-increment ID like "TASK-255" or "SPEC-12"). Exact match, 100% accurate. When to use: pinpoint lookup by unique_id→this tool / filtered multi-page query→query-database / keyword search→official notion-search. Auto-detects unique_id property name. compact:true flattens properties, include_content:true adds page body as Markdown.',
  paramsSchema: findByUniqueIdSchema.shape,
};
