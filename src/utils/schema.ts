import { notionRequest } from '../lib/notion-client.js';

export type PropertyNameToIdMap = Record<string, string>;

// Fetch data source schema properties
async function fetchSchemaProperties(
  dataSourceId: string,
): Promise<
  { ok: true; properties: Record<string, Record<string, unknown>> } | { ok: false; error: string }
> {
  const result = await notionRequest<Record<string, unknown>>({
    method: 'GET',
    path: `/data_sources/${dataSourceId}`,
  });

  if (!result.ok) {
    return { ok: false, error: `Schema fetch error (${result.status}): ${result.message}` };
  }

  return {
    ok: true,
    properties: result.data.properties as Record<string, Record<string, unknown>>,
  };
}

// Build property name → ID mapping from schema
export async function getPropertyNameToIdMap(
  dataSourceId: string,
): Promise<{ ok: true; map: PropertyNameToIdMap } | { ok: false; error: string }> {
  const schema = await fetchSchemaProperties(dataSourceId);
  if (!schema.ok) return schema;

  const map: PropertyNameToIdMap = {};
  for (const [name, prop] of Object.entries(schema.properties)) {
    map[name] = prop.id as string;
  }

  return { ok: true, map };
}

// Find the unique_id property name from schema
export async function findUniqueIdPropertyName(
  dataSourceId: string,
): Promise<{ ok: true; propertyName: string } | { ok: false; error: string }> {
  const schema = await fetchSchemaProperties(dataSourceId);
  if (!schema.ok) return schema;

  for (const [name, prop] of Object.entries(schema.properties)) {
    if (prop.type === 'unique_id') {
      return { ok: true, propertyName: name };
    }
  }

  return {
    ok: false,
    error:
      'No unique_id property found in this data source. Ensure the Notion database has an ID column (unique_id type).',
  };
}

// Resolve property names to IDs. Already-valid IDs pass through unchanged.
export function resolvePropertyIds(names: string[], map: PropertyNameToIdMap): string[] {
  const idValues = new Set(Object.values(map));
  return names.map((nameOrId) => {
    if (map[nameOrId] !== undefined) {
      return map[nameOrId];
    }
    if (idValues.has(nameOrId)) {
      return nameOrId;
    }
    return nameOrId;
  });
}
