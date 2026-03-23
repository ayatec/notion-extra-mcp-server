import { z } from 'zod';
import { notionRequest } from '../lib/notion-client.js';
import { formatNotionError } from '../utils/error-guidance.js';
import type { ToolResponse } from '../types/index.js';

export const getDataSourceSchemaSchema = z.object({
  data_source_id: z
    .string()
    .min(1)
    .describe(
      'Data source ID. Get it from notion-fetch response: data_sources[].data_source_id. Note: this is NOT the database_id.',
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

export const getDataSourceSchemaTool = {
  name: 'get-data-source-schema',
  description:
    'Get data source schema (property list, types, select/multi_select options). When to use: check property names/types/options→this tool / modify schema→update-data-source-schema. Use this before building filters/sorts for query-database. Response includes property IDs, relation target database IDs, formula/rollup config.',
  paramsSchema: getDataSourceSchemaSchema.shape,
};
