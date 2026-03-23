// Notion APIレスポンスのプロパティ値をフラット化するユーティリティ

// rich_text / title の配列からプレーンテキストを結合
function extractPlainText(richTextArray: unknown): string {
  if (!Array.isArray(richTextArray)) return '';
  return richTextArray.map((item: Record<string, unknown>) => item.plain_text ?? '').join('');
}

// formula プロパティの値を展開
function extractFormulaValue(formula: Record<string, unknown>): unknown {
  const type = formula.type as string;
  return formula[type] ?? null;
}

// rollup プロパティの値を展開
function extractRollupValue(rollup: Record<string, unknown>): unknown {
  const type = rollup.type as string;
  if (type === 'array') {
    const results = rollup.results as unknown[];
    if (!Array.isArray(results)) return [];
    return results.map((item) => flattenPropertyValue(item as Record<string, unknown>));
  }
  return rollup[type] ?? null;
}

// 単一プロパティの値をフラット化
function flattenPropertyValue(prop: Record<string, unknown>): unknown {
  const type = prop.type as string;

  switch (type) {
    case 'title':
      return extractPlainText(prop.title);

    case 'rich_text':
      return extractPlainText(prop.rich_text);

    case 'number':
      return prop.number ?? null;

    case 'select': {
      const select = prop.select as Record<string, unknown> | null;
      return select?.name ?? null;
    }

    case 'multi_select': {
      const multiSelect = prop.multi_select as Array<Record<string, unknown>>;
      if (!Array.isArray(multiSelect)) return [];
      return multiSelect.map((item) => item.name as string);
    }

    case 'status': {
      const status = prop.status as Record<string, unknown> | null;
      return status?.name ?? null;
    }

    case 'checkbox':
      return prop.checkbox ?? false;

    case 'date': {
      const date = prop.date as Record<string, unknown> | null;
      if (!date) return null;
      if (date.end) {
        return { start: date.start, end: date.end };
      }
      return date.start ?? null;
    }

    case 'people': {
      const people = prop.people as Array<Record<string, unknown>>;
      if (!Array.isArray(people)) return [];
      return people.map((person) => person.id as string);
    }

    case 'relation': {
      const relation = prop.relation as Array<Record<string, unknown>>;
      if (!Array.isArray(relation)) return [];
      return relation.map((item) => item.id as string);
    }

    case 'url':
      return prop.url ?? null;

    case 'email':
      return prop.email ?? null;

    case 'phone_number':
      return prop.phone_number ?? null;

    case 'unique_id': {
      const uniqueId = prop.unique_id as Record<string, unknown> | null;
      if (!uniqueId) return null;
      const prefix = uniqueId.prefix as string | undefined;
      const number = uniqueId.number as number;
      return prefix ? `${prefix}-${number}` : String(number);
    }

    case 'formula':
      return extractFormulaValue(prop.formula as Record<string, unknown>);

    case 'rollup':
      return extractRollupValue(prop.rollup as Record<string, unknown>);

    case 'created_time':
      return prop.created_time ?? null;

    case 'last_edited_time':
      return prop.last_edited_time ?? null;

    case 'created_by': {
      const createdBy = prop.created_by as Record<string, unknown> | null;
      return createdBy?.id ?? null;
    }

    case 'last_edited_by': {
      const lastEditedBy = prop.last_edited_by as Record<string, unknown> | null;
      return lastEditedBy?.id ?? null;
    }

    case 'files': {
      const files = prop.files as Array<Record<string, unknown>>;
      if (!Array.isArray(files)) return [];
      return files.map((file) => {
        const fileType = file.type as string;
        const fileData = file[fileType] as Record<string, unknown> | undefined;
        return fileData?.url ?? null;
      });
    }

    default:
      // 未知の型はそのまま返す
      return prop[type] ?? null;
  }
}

// ページオブジェクトをcompact形式に変換
export function compactPage(page: Record<string, unknown>): Record<string, unknown> {
  const properties = page.properties as Record<string, Record<string, unknown>> | undefined;
  const compactProperties: Record<string, unknown> = {};

  if (properties) {
    for (const [name, prop] of Object.entries(properties)) {
      compactProperties[name] = flattenPropertyValue(prop);
    }
  }

  return {
    id: page.id,
    url: page.url,
    properties: compactProperties,
  };
}

// クエリ結果全体をcompact形式に変換
export function compactQueryResult(data: Record<string, unknown>): Record<string, unknown> {
  const results = data.results as Array<Record<string, unknown>>;

  return {
    results: Array.isArray(results) ? results.map(compactPage) : [],
    has_more: data.has_more,
    next_cursor: data.next_cursor,
  };
}
