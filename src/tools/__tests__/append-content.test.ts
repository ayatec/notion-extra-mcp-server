import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appendContentHandler, appendContentSchema } from '../append-content.js';

vi.mock('../../lib/notion-client.js', () => ({
  notionRequest: vi.fn(),
}));

import { notionRequest } from '../../lib/notion-client.js';

const mockNotionRequest = vi.mocked(notionRequest);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('append-content', () => {
  describe('appendContentSchema', () => {
    it('必須パラメータのみで有効', () => {
      const result = appendContentSchema.parse({
        page_id: 'page-1',
        content: '## 追記',
      });
      expect(result.page_id).toBe('page-1');
      expect(result.content).toBe('## 追記');
    });

    it('content が空文字でエラー', () => {
      expect(() => appendContentSchema.parse({ page_id: 'page-1', content: '' })).toThrow();
    });
  });

  describe('appendContentHandler', () => {
    it('Markdown API の insert_content で追記する', async () => {
      mockNotionRequest.mockResolvedValue({ ok: true, data: {} });

      const result = await appendContentHandler({
        page_id: 'page-1',
        content: '## 調査メモ\n\n結論です。',
      });

      expect(mockNotionRequest).toHaveBeenCalledWith({
        method: 'PATCH',
        path: '/pages/page-1/markdown',
        body: {
          type: 'insert_content',
          insert_content: {
            content: '## 調査メモ\n\n結論です。',
          },
        },
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
      expect(parsed.page_id).toBe('page-1');
    });

    it('APIエラー時に isError: true を返す', async () => {
      mockNotionRequest.mockResolvedValue({
        ok: false,
        status: 404,
        code: 'object_not_found',
        message: 'Could not find page',
      });

      const result = await appendContentHandler({
        page_id: 'invalid-page',
        content: 'テスト',
      });

      expect(result.content[0].text).toContain('object_not_found');
      expect(result).toHaveProperty('isError', true);
    });
  });
});
