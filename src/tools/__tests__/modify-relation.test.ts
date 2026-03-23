import { describe, it, expect, vi, beforeEach } from 'vitest';
import { modifyRelationHandler } from '../modify-relation.js';

vi.mock('../../lib/notion-client.js', () => ({
  notionRequest: vi.fn(),
}));

import { notionRequest } from '../../lib/notion-client.js';

const mockNotionRequest = vi.mocked(notionRequest);

beforeEach(() => {
  vi.clearAllMocks();
});

// ページ取得レスポンス（リレーションあり）
const pageWithRelation = {
  ok: true as const,
  data: {
    properties: {
      関連: {
        id: 'rel1',
        type: 'relation',
        relation: [{ id: 'existing-1' }, { id: 'existing-2' }],
      },
    },
  },
};

// ページ取得レスポンス（リレーション空）
const pageWithEmptyRelation = {
  ok: true as const,
  data: {
    properties: {
      関連: {
        id: 'rel1',
        type: 'relation',
        relation: [],
      },
    },
  },
};

describe('modify-relation', () => {
  describe('add_ids で追加', () => {
    it('既存リレーションに新しいIDを追加する', async () => {
      mockNotionRequest
        .mockResolvedValueOnce(pageWithRelation)
        .mockResolvedValueOnce({ ok: true, data: {} });

      const result = await modifyRelationHandler({
        page_id: 'page-1',
        property: '関連',
        add_ids: ['new-1'],
      });

      expect(mockNotionRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PATCH',
          body: {
            properties: {
              関連: {
                relation: [{ id: 'existing-1' }, { id: 'existing-2' }, { id: 'new-1' }],
              },
            },
          },
        }),
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.relation_ids).toEqual(['existing-1', 'existing-2', 'new-1']);
    });

    it('重複IDは追加しない', async () => {
      mockNotionRequest
        .mockResolvedValueOnce(pageWithRelation)
        .mockResolvedValueOnce({ ok: true, data: {} });

      const result = await modifyRelationHandler({
        page_id: 'page-1',
        property: '関連',
        add_ids: ['existing-1', 'new-1'],
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.relation_ids).toEqual(['existing-1', 'existing-2', 'new-1']);
    });

    it('空のリレーションにIDを追加できる', async () => {
      mockNotionRequest
        .mockResolvedValueOnce(pageWithEmptyRelation)
        .mockResolvedValueOnce({ ok: true, data: {} });

      const result = await modifyRelationHandler({
        page_id: 'page-1',
        property: '関連',
        add_ids: ['new-1', 'new-2'],
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.relation_ids).toEqual(['new-1', 'new-2']);
    });
  });

  describe('remove_ids で削除', () => {
    it('指定IDをリレーションから削除する', async () => {
      mockNotionRequest
        .mockResolvedValueOnce(pageWithRelation)
        .mockResolvedValueOnce({ ok: true, data: {} });

      const result = await modifyRelationHandler({
        page_id: 'page-1',
        property: '関連',
        remove_ids: ['existing-1'],
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.relation_ids).toEqual(['existing-2']);
    });

    it('存在しないIDを指定してもエラーにならない', async () => {
      mockNotionRequest
        .mockResolvedValueOnce(pageWithRelation)
        .mockResolvedValueOnce({ ok: true, data: {} });

      const result = await modifyRelationHandler({
        page_id: 'page-1',
        property: '関連',
        remove_ids: ['non-existent'],
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.relation_ids).toEqual(['existing-1', 'existing-2']);
    });
  });

  describe('add_ids + remove_ids の同時指定', () => {
    it('削除→追加の順で処理される', async () => {
      mockNotionRequest
        .mockResolvedValueOnce(pageWithRelation)
        .mockResolvedValueOnce({ ok: true, data: {} });

      const result = await modifyRelationHandler({
        page_id: 'page-1',
        property: '関連',
        remove_ids: ['existing-1'],
        add_ids: ['new-1'],
      });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.relation_ids).toEqual(['existing-2', 'new-1']);
    });
  });

  describe('バリデーション', () => {
    it('add_ids と remove_ids が両方未指定でエラーを返す', async () => {
      const result = await modifyRelationHandler({
        page_id: 'page-1',
        property: '関連',
      });

      expect(result.content[0].text).toContain('At least one of add_ids or remove_ids');
      expect(result).toHaveProperty('isError', true);
    });
  });

  describe('エラーケース', () => {
    it('存在しないプロパティ名で利用可能なプロパティ一覧を返す', async () => {
      mockNotionRequest.mockResolvedValueOnce({
        ok: true,
        data: {
          properties: {
            名前: { id: 'title', type: 'title' },
            関連: { id: 'rel1', type: 'relation' },
          },
        },
      });

      const result = await modifyRelationHandler({
        page_id: 'page-1',
        property: '存在しない',
        add_ids: ['new-1'],
      });

      expect(result.content[0].text).toContain('not found');
      expect(result.content[0].text).toContain('名前');
      expect(result.content[0].text).toContain('関連');
      expect(result).toHaveProperty('isError', true);
    });

    it('relation型でないプロパティで実際の型を表示する', async () => {
      mockNotionRequest.mockResolvedValueOnce({
        ok: true,
        data: {
          properties: { 名前: { id: 'title', type: 'title', title: [] } },
        },
      });

      const result = await modifyRelationHandler({
        page_id: 'page-1',
        property: '名前',
        add_ids: ['new-1'],
      });

      expect(result.content[0].text).toContain('is not a relation type');
      expect(result.content[0].text).toContain('title');
      expect(result).toHaveProperty('isError', true);
    });
  });
});
