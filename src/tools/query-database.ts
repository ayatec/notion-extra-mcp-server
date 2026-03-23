import { z } from 'zod';
import { notionRequest } from '../lib/notion-client.js';
import { compactQueryResult } from '../utils/compact.js';
import { getPropertyNameToIdMap, resolvePropertyIds } from '../utils/schema.js';
import { formatNotionError } from '../utils/error-guidance.js';
import { RateLimiter } from '../utils/rate-limiter.js';
import type { ToolResponse } from '../types/index.js';

const countRateLimiter = new RateLimiter(3);
const COUNT_MAX_ITERATIONS = 100; // 100 pages × 100 items = max 10,000

export const queryDatabaseSchema = z.object({
  data_source_id: z
    .string()
    .min(1)
    .describe(
      'Data source ID. Get it from notion-fetch response: data_sources[].data_source_id. Note: this is NOT the database_id.',
    ),
  filter: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      'Notion API filter object. Example: {"property": "Status", "select": {"equals": "Done"}}. Compound: {"and": [{...}, {...}]}. Property names must match exactly (case-sensitive). Use get-data-source-schema first to check property names and types.',
    ),
  sorts: z
    .array(z.record(z.string(), z.unknown()))
    .optional()
    .describe(
      'Sort conditions array. Example: [{"property": "Name", "direction": "ascending"}]. Timestamp sort: [{"timestamp": "created_time", "direction": "descending"}]',
    ),
  page_size: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(100)
    .describe('Results per page (default: 100, max: 100)'),
  start_cursor: z
    .string()
    .optional()
    .describe('Pass next_cursor from previous response to get next page. Omit for first request.'),
  filter_properties: z
    .array(z.string())
    .optional()
    .describe(
      'Properties to include in response. Accepts property names (e.g. "Task Name", "Status") or property IDs (e.g. "KmcG"). Names are auto-resolved to IDs. Reduces response size and token usage.',
    ),
  compact: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'If true, compress response: strip page metadata, flatten property values (title→string, select→name, relation→ID array, formula→computed value). Each page returns only id, url, properties. Default: false',
    ),
  output_mode: z
    .enum(['results', 'count'])
    .optional()
    .default('results')
    .describe(
      '"results" (default): return page list. "count": return only the count of matching pages (paginates internally). Ideal for progress checks.',
    ),
});

// count mode: paginate through all results and return count only
async function countPages(
  dataSourceId: string,
  filter?: Record<string, unknown>,
): Promise<ToolResponse> {
  let count = 0;
  let startCursor: string | undefined;
  let iterations = 0;

  while (true) {
    iterations++;
    if (iterations > COUNT_MAX_ITERATIONS) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              count,
              truncated: true,
              message: `Count exceeded ${COUNT_MAX_ITERATIONS * 100} pages. Actual count is at least ${count}.`,
            }),
          },
        ],
      };
    }

    await countRateLimiter.wait();

    const body: Record<string, unknown> = { page_size: 100 };
    if (filter) body.filter = filter;
    if (startCursor) body.start_cursor = startCursor;

    const result = await notionRequest<Record<string, unknown>>({
      method: 'POST',
      path: `/data_sources/${dataSourceId}/query`,
      body,
      // "title" is a built-in property ID that always exists in every data source
      queryParams: { filter_properties: ['title'] },
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

    const results = result.data.results as unknown[];
    count += results?.length ?? 0;

    if (!result.data.has_more) break;
    startCursor = result.data.next_cursor as string;
  }

  return {
    content: [{ type: 'text', text: JSON.stringify({ count }) }],
  };
}

export async function queryDatabaseHandler(
  args: z.infer<typeof queryDatabaseSchema>,
  _extra?: unknown,
): Promise<ToolResponse> {
  if (args.output_mode === 'count') {
    return countPages(args.data_source_id, args.filter);
  }

  const body: Record<string, unknown> = {};
  if (args.filter) body.filter = args.filter;
  if (args.sorts) body.sorts = args.sorts;
  body.page_size = args.page_size;
  if (args.start_cursor) body.start_cursor = args.start_cursor;

  let resolvedFilterProperties = args.filter_properties;
  if (resolvedFilterProperties && resolvedFilterProperties.length > 0) {
    const mapResult = await getPropertyNameToIdMap(args.data_source_id);
    if (mapResult.ok) {
      resolvedFilterProperties = resolvePropertyIds(resolvedFilterProperties, mapResult.map);
    }
  }

  const queryParams: Record<string, string[]> | undefined = resolvedFilterProperties
    ? { filter_properties: resolvedFilterProperties }
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
          text: formatNotionError(result.status, result.code, result.message),
        },
      ],
      isError: true,
    };
  }

  const output = args.compact ? compactQueryResult(result.data) : result.data;
  const indent = args.compact ? undefined : 2;

  return {
    content: [{ type: 'text', text: JSON.stringify(output, null, indent) }],
  };
}

export const queryDatabaseTool = {
  name: 'query-database',
  description:
    'Query a Notion database with filters, sorts, and pagination. When to use: filtered/sorted page retrieval→this tool / keyword search→official notion-search / lookup by unique_id (e.g. "TASK-255")→find-by-unique-id. Recommended: use get-data-source-schema first to check property names/types. Token saving: use filter_properties (accepts names or IDs) and compact:true (~1/10 size). Pagination: if has_more is true, pass next_cursor to start_cursor. output_mode:"count" returns count only.',
  paramsSchema: queryDatabaseSchema.shape,
};
