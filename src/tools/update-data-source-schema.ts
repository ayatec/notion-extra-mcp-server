import { z } from 'zod';
import { notionRequest } from '../lib/notion-client.js';
import { formatNotionError } from '../utils/error-guidance.js';
import type { ToolResponse } from '../types/index.js';

export const updateDataSourceSchemaSchema = z.object({
  data_source_id: z
    .string()
    .min(1)
    .describe(
      'Data source ID. Get it from notion-fetch response: data_sources[].data_source_id. Note: this is NOT the database_id.',
    ),
  properties: z
    .record(z.string(), z.unknown())
    .describe(
      'Property definition object. Examples: add options {"Status": {"select": {"options": [{"name": "Todo"}, {"name": "Done"}]}}}, rename {"OldName": {"name": "NewName"}}, delete {"Target": null}. IMPORTANT: select/multi_select options must include ALL options (omitted ones are deleted).',
    ),
});

export async function updateDataSourceSchemaHandler(
  args: z.infer<typeof updateDataSourceSchemaSchema>,
  _extra?: unknown,
): Promise<ToolResponse> {
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

export const updateDataSourceSchemaTool = {
  name: 'update-data-source-schema',
  description:
    'Update data source schema (property definitions). Supports: add properties, rename, modify select/multi_select options, delete properties. When to use: schema changes→this tool / update property values→batch-update-pages or official notion-update-page. IMPORTANT: select/multi_select options must list ALL options (omitted ones are deleted). Status property name/options cannot be changed. Always use get-data-source-schema first to check current schema.',
  paramsSchema: updateDataSourceSchemaSchema.shape,
};
