import { z } from 'zod';
import { notionRequest } from '../lib/notion-client.js';
import type { ToolResponse } from '../types/index.js';

export const archivePageSchema = z.object({
  page_id: z.string().min(1).describe('アーカイブするページのID'),
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
          text: `Notion API error (${result.status}): [${result.code}] ${result.message}`,
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
    'ページをアーカイブ（ゴミ箱に移動）。archive専用の簡便なツール。公式MCPの notion-update-page で archived: true を設定するのと同等だが、単一パラメータで明示的にアーカイブ操作を行える。データベース行の削除にも使用可能（Notionのデータベース行はページ）。復元はNotion UIから可能。永久削除はAPIでは不可。',
  paramsSchema: archivePageSchema.shape,
};
