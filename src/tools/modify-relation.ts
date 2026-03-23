import { z } from 'zod';
import { notionRequest } from '../lib/notion-client.js';
import { formatNotionError } from '../utils/error-guidance.js';
import type { ToolResponse } from '../types/index.js';

export const modifyRelationSchema = z.object({
  page_id: z
    .string()
    .min(1)
    .describe(
      'Page ID to modify. Get from query-database or find-by-unique-id results (id field), or official Notion MCP.',
    ),
  property: z
    .string()
    .min(1)
    .describe(
      'Relation property name (case-sensitive exact match). Use get-data-source-schema to find relation-type property names.',
    ),
  add_ids: z
    .array(z.string().min(1))
    .optional()
    .describe('Page IDs to add. Existing values are preserved; duplicate IDs are auto-skipped.'),
  remove_ids: z
    .array(z.string().min(1))
    .optional()
    .describe('Page IDs to remove. Non-existent IDs are silently ignored (no error).'),
});
// Note: add_ids/remove_ids validation is done in the handler because .refine() is lost by MCP SDK's .shape access

// Get current relation IDs for a page
async function getCurrentRelationIds(
  pageId: string,
  propertyName: string,
): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
  const result = await notionRequest<Record<string, unknown>>({
    method: 'GET',
    path: `/pages/${pageId}`,
  });

  if (!result.ok) {
    return {
      ok: false,
      error: `Failed to fetch page (${result.status}): ${result.message}. Verify page_id is correct.`,
    };
  }

  const properties = result.data.properties as Record<string, Record<string, unknown>>;
  const prop = properties[propertyName];
  if (!prop) {
    const availableProps = Object.keys(properties).join(', ');
    return {
      ok: false,
      error: `Property "${propertyName}" not found. Available properties: ${availableProps}`,
    };
  }

  if (prop.type !== 'relation') {
    return {
      ok: false,
      error: `Property "${propertyName}" is not a relation type (actual type: ${prop.type}). Specify a relation-type property name.`,
    };
  }

  const relations = prop.relation as Array<Record<string, unknown>>;
  const ids = Array.isArray(relations) ? relations.map((r) => r.id as string) : [];
  return { ok: true, ids };
}

export async function modifyRelationHandler(
  args: z.infer<typeof modifyRelationSchema>,
  _extra?: unknown,
): Promise<ToolResponse> {
  // .refine() は MCP SDK のスキーマ登録時に失われるため、ハンドラー内でチェック
  const hasAdd = args.add_ids && args.add_ids.length > 0;
  const hasRemove = args.remove_ids && args.remove_ids.length > 0;
  if (!hasAdd && !hasRemove) {
    return {
      content: [
        {
          type: 'text',
          text: 'At least one of add_ids or remove_ids must be provided with non-empty values.',
        },
      ],
      isError: true,
    };
  }

  const current = await getCurrentRelationIds(args.page_id, args.property);
  if (!current.ok) {
    return { content: [{ type: 'text', text: current.error }], isError: true };
  }

  let newIds = current.ids;

  if (args.remove_ids && args.remove_ids.length > 0) {
    const removeSet = new Set(args.remove_ids);
    newIds = newIds.filter((id) => !removeSet.has(id));
  }

  if (args.add_ids && args.add_ids.length > 0) {
    const existingSet = new Set(newIds);
    newIds = [...newIds, ...args.add_ids.filter((id) => !existingSet.has(id))];
  }

  const result = await notionRequest<Record<string, unknown>>({
    method: 'PATCH',
    path: `/pages/${args.page_id}`,
    body: {
      properties: {
        [args.property]: {
          relation: newIds.map((id) => ({ id })),
        },
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
        text: JSON.stringify(
          {
            page_id: args.page_id,
            property: args.property,
            relation_ids: newIds,
          },
          null,
          2,
        ),
      },
    ],
  };
}

export const modifyRelationTool = {
  name: 'modify-relation',
  description:
    'Add/remove pages from a relation property. Auto-fetches existing values and applies diff update, so existing relations are never accidentally overwritten. Both add_ids and remove_ids can be specified together. When to use: add/remove relations (preserve existing)→this tool / fully replace relation values→batch-update-pages with relation property. Order: remove_ids first→then add_ids (duplicates auto-skipped). Limitation: reads up to 25 existing relations per Notion API constraint; for properties with 25+ relations, use batch-update-pages with full relation array instead.',
  paramsSchema: modifyRelationSchema.shape,
};
