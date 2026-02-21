import { describe, it, expect, vi, beforeEach } from 'vitest';
import { archivePageHandler, archivePageSchema } from '../archive-page.js';

vi.mock('../../lib/notion-client.js', () => ({
  notionRequest: vi.fn(),
}));

import { notionRequest } from '../../lib/notion-client.js';

const mockNotionRequest = vi.mocked(notionRequest);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('archive-page', () => {
  describe('archivePageSchema', () => {
    it('page_id を正しくパースする', () => {
      const result = archivePageSchema.parse({ page_id: 'page-123' });
      expect(result.page_id).toBe('page-123');
    });

    it('page_id が空文字でエラー', () => {
      expect(() => archivePageSchema.parse({ page_id: '' })).toThrow();
    });
  });

  describe('archivePageHandler', () => {
    it('archived: true でリクエストを送信する', async () => {
      const archived = { object: 'page', id: 'page-123', archived: true };
      mockNotionRequest.mockResolvedValue({ ok: true, data: archived });

      const result = await archivePageHandler({ page_id: 'page-123' });

      expect(JSON.parse(result.content[0].text)).toEqual(archived);
      expect(result).not.toHaveProperty('isError');
      expect(mockNotionRequest).toHaveBeenCalledWith({
        method: 'PATCH',
        path: '/pages/page-123',
        body: { archived: true },
      });
    });

    it('APIエラー時に isError: true を返す', async () => {
      mockNotionRequest.mockResolvedValue({
        ok: false,
        status: 404,
        code: 'object_not_found',
        message: 'Page not found',
      });

      const result = await archivePageHandler({ page_id: 'page-xxx' });

      expect(result.content[0].text).toContain('object_not_found');
      expect(result).toHaveProperty('isError', true);
    });
  });
});
