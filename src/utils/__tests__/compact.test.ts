import { describe, it, expect } from 'vitest';
import { compactPage, compactQueryResult } from '../compact.js';

describe('compact', () => {
  describe('compactPage', () => {
    it('title をプレーンテキストに変換する', () => {
      const page = {
        id: 'p1',
        url: 'https://notion.so/p1',
        properties: {
          名前: {
            id: 'title',
            type: 'title',
            title: [{ plain_text: 'Hello ' }, { plain_text: 'World' }],
          },
        },
      };
      const result = compactPage(page);
      expect(result.properties).toEqual({ 名前: 'Hello World' });
    });

    it('rich_text をプレーンテキストに変換する', () => {
      const page = {
        id: 'p1',
        url: 'https://notion.so/p1',
        properties: {
          説明: {
            id: 'rt1',
            type: 'rich_text',
            rich_text: [{ plain_text: 'テスト説明' }],
          },
        },
      };
      const result = compactPage(page);
      expect((result.properties as Record<string, unknown>)['説明']).toBe('テスト説明');
    });

    it('number をそのまま返す', () => {
      const page = {
        id: 'p1',
        url: 'https://notion.so/p1',
        properties: {
          数値: { id: 'n1', type: 'number', number: 42 },
        },
      };
      const result = compactPage(page);
      expect((result.properties as Record<string, unknown>)['数値']).toBe(42);
    });

    it('null number を null で返す', () => {
      const page = {
        id: 'p1',
        url: 'https://notion.so/p1',
        properties: {
          数値: { id: 'n1', type: 'number', number: null },
        },
      };
      const result = compactPage(page);
      expect((result.properties as Record<string, unknown>)['数値']).toBeNull();
    });

    it('select を選択肢名に変換する', () => {
      const page = {
        id: 'p1',
        url: 'https://notion.so/p1',
        properties: {
          カテゴリ: {
            id: 's1',
            type: 'select',
            select: { id: 'opt1', name: 'カテゴリA', color: 'blue' },
          },
        },
      };
      const result = compactPage(page);
      expect((result.properties as Record<string, unknown>)['カテゴリ']).toBe('カテゴリA');
    });

    it('null select を null で返す', () => {
      const page = {
        id: 'p1',
        url: 'https://notion.so/p1',
        properties: {
          カテゴリ: { id: 's1', type: 'select', select: null },
        },
      };
      const result = compactPage(page);
      expect((result.properties as Record<string, unknown>)['カテゴリ']).toBeNull();
    });

    it('multi_select を選択肢名の配列に変換する', () => {
      const page = {
        id: 'p1',
        url: 'https://notion.so/p1',
        properties: {
          タグ: {
            id: 'ms1',
            type: 'multi_select',
            multi_select: [
              { id: 'o1', name: '重要', color: 'red' },
              { id: 'o2', name: '緊急', color: 'orange' },
            ],
          },
        },
      };
      const result = compactPage(page);
      expect((result.properties as Record<string, unknown>)['タグ']).toEqual(['重要', '緊急']);
    });

    it('status をステータス名に変換する', () => {
      const page = {
        id: 'p1',
        url: 'https://notion.so/p1',
        properties: {
          ステータス: {
            id: 'st1',
            type: 'status',
            status: { id: 'st-opt1', name: '進行中', color: 'blue' },
          },
        },
      };
      const result = compactPage(page);
      expect((result.properties as Record<string, unknown>)['ステータス']).toBe('進行中');
    });

    it('checkbox を boolean で返す', () => {
      const page = {
        id: 'p1',
        url: 'https://notion.so/p1',
        properties: {
          完了: { id: 'cb1', type: 'checkbox', checkbox: true },
        },
      };
      const result = compactPage(page);
      expect((result.properties as Record<string, unknown>)['完了']).toBe(true);
    });

    it('date（end なし）を開始日の文字列で返す', () => {
      const page = {
        id: 'p1',
        url: 'https://notion.so/p1',
        properties: {
          期日: {
            id: 'd1',
            type: 'date',
            date: { start: '2026-04-01', end: null, time_zone: null },
          },
        },
      };
      const result = compactPage(page);
      expect((result.properties as Record<string, unknown>)['期日']).toBe('2026-04-01');
    });

    it('date（end あり）を start/end オブジェクトで返す', () => {
      const page = {
        id: 'p1',
        url: 'https://notion.so/p1',
        properties: {
          期日: {
            id: 'd1',
            type: 'date',
            date: { start: '2026-03-15', end: '2026-03-20', time_zone: null },
          },
        },
      };
      const result = compactPage(page);
      expect((result.properties as Record<string, unknown>)['期日']).toEqual({
        start: '2026-03-15',
        end: '2026-03-20',
      });
    });

    it('null date を null で返す', () => {
      const page = {
        id: 'p1',
        url: 'https://notion.so/p1',
        properties: {
          期日: { id: 'd1', type: 'date', date: null },
        },
      };
      const result = compactPage(page);
      expect((result.properties as Record<string, unknown>)['期日']).toBeNull();
    });

    it('people をユーザーIDの配列に変換する', () => {
      const page = {
        id: 'p1',
        url: 'https://notion.so/p1',
        properties: {
          担当者: {
            id: 'ppl1',
            type: 'people',
            people: [
              { object: 'user', id: 'user-1' },
              { object: 'user', id: 'user-2' },
            ],
          },
        },
      };
      const result = compactPage(page);
      expect((result.properties as Record<string, unknown>)['担当者']).toEqual([
        'user-1',
        'user-2',
      ]);
    });

    it('relation をページIDの配列に変換する', () => {
      const page = {
        id: 'p1',
        url: 'https://notion.so/p1',
        properties: {
          関連: {
            id: 'rel1',
            type: 'relation',
            relation: [{ id: 'page-a' }, { id: 'page-b' }],
          },
        },
      };
      const result = compactPage(page);
      expect((result.properties as Record<string, unknown>)['関連']).toEqual(['page-a', 'page-b']);
    });

    it('url をそのまま返す', () => {
      const page = {
        id: 'p1',
        url: 'https://notion.so/p1',
        properties: {
          URL: { id: 'u1', type: 'url', url: 'https://example.com' },
        },
      };
      const result = compactPage(page);
      expect((result.properties as Record<string, unknown>)['URL']).toBe('https://example.com');
    });

    it('email をそのまま返す', () => {
      const page = {
        id: 'p1',
        url: 'https://notion.so/p1',
        properties: {
          メール: { id: 'e1', type: 'email', email: 'test@example.com' },
        },
      };
      const result = compactPage(page);
      expect((result.properties as Record<string, unknown>)['メール']).toBe('test@example.com');
    });

    it('phone_number をそのまま返す', () => {
      const page = {
        id: 'p1',
        url: 'https://notion.so/p1',
        properties: {
          電話: { id: 'ph1', type: 'phone_number', phone_number: '090-1234-5678' },
        },
      };
      const result = compactPage(page);
      expect((result.properties as Record<string, unknown>)['電話']).toBe('090-1234-5678');
    });

    it('unique_id をフォーマット済み文字列に変換する', () => {
      const page = {
        id: 'p1',
        url: 'https://notion.so/p1',
        properties: {
          ID: {
            id: 'uid1',
            type: 'unique_id',
            unique_id: { prefix: 'TASK', number: 255 },
          },
        },
      };
      const result = compactPage(page);
      expect((result.properties as Record<string, unknown>)['ID']).toBe('TASK-255');
    });

    it('prefix なしの unique_id を数値文字列に変換する', () => {
      const page = {
        id: 'p1',
        url: 'https://notion.so/p1',
        properties: {
          ID: {
            id: 'uid1',
            type: 'unique_id',
            unique_id: { prefix: null, number: 42 },
          },
        },
      };
      const result = compactPage(page);
      expect((result.properties as Record<string, unknown>)['ID']).toBe('42');
    });

    it('formula（string型）の計算結果を返す', () => {
      const page = {
        id: 'p1',
        url: 'https://notion.so/p1',
        properties: {
          計算: {
            id: 'f1',
            type: 'formula',
            formula: { type: 'string', string: '着手可能' },
          },
        },
      };
      const result = compactPage(page);
      expect((result.properties as Record<string, unknown>)['計算']).toBe('着手可能');
    });

    it('formula（number型）の計算結果を返す', () => {
      const page = {
        id: 'p1',
        url: 'https://notion.so/p1',
        properties: {
          計算: {
            id: 'f1',
            type: 'formula',
            formula: { type: 'number', number: 42 },
          },
        },
      };
      const result = compactPage(page);
      expect((result.properties as Record<string, unknown>)['計算']).toBe(42);
    });

    it('formula（boolean型）の計算結果を返す', () => {
      const page = {
        id: 'p1',
        url: 'https://notion.so/p1',
        properties: {
          計算: {
            id: 'f1',
            type: 'formula',
            formula: { type: 'boolean', boolean: true },
          },
        },
      };
      const result = compactPage(page);
      expect((result.properties as Record<string, unknown>)['計算']).toBe(true);
    });

    it('rollup（number型）の集計結果を返す', () => {
      const page = {
        id: 'p1',
        url: 'https://notion.so/p1',
        properties: {
          合計: {
            id: 'r1',
            type: 'rollup',
            rollup: { type: 'number', number: 1234, function: 'sum' },
          },
        },
      };
      const result = compactPage(page);
      expect((result.properties as Record<string, unknown>)['合計']).toBe(1234);
    });

    it('rollup（array型）の結果を再帰的にフラット化する', () => {
      const page = {
        id: 'p1',
        url: 'https://notion.so/p1',
        properties: {
          一覧: {
            id: 'r1',
            type: 'rollup',
            rollup: {
              type: 'array',
              results: [
                { type: 'number', number: 10 },
                { type: 'number', number: 20 },
              ],
              function: 'show_original',
            },
          },
        },
      };
      const result = compactPage(page);
      expect((result.properties as Record<string, unknown>)['一覧']).toEqual([10, 20]);
    });

    it('created_time をそのまま返す', () => {
      const page = {
        id: 'p1',
        url: 'https://notion.so/p1',
        properties: {
          作成日: {
            id: 'ct1',
            type: 'created_time',
            created_time: '2026-01-01T00:00:00.000Z',
          },
        },
      };
      const result = compactPage(page);
      expect((result.properties as Record<string, unknown>)['作成日']).toBe(
        '2026-01-01T00:00:00.000Z',
      );
    });

    it('created_by をユーザーIDに変換する', () => {
      const page = {
        id: 'p1',
        url: 'https://notion.so/p1',
        properties: {
          作成者: {
            id: 'cb1',
            type: 'created_by',
            created_by: { object: 'user', id: 'user-1' },
          },
        },
      };
      const result = compactPage(page);
      expect((result.properties as Record<string, unknown>)['作成者']).toBe('user-1');
    });

    it('files をURLの配列に変換する', () => {
      const page = {
        id: 'p1',
        url: 'https://notion.so/p1',
        properties: {
          ファイル: {
            id: 'fi1',
            type: 'files',
            files: [
              { type: 'external', external: { url: 'https://example.com/a.png' } },
              { type: 'file', file: { url: 'https://s3.notion.so/b.pdf' } },
            ],
          },
        },
      };
      const result = compactPage(page);
      expect((result.properties as Record<string, unknown>)['ファイル']).toEqual([
        'https://example.com/a.png',
        'https://s3.notion.so/b.pdf',
      ]);
    });

    it('メタデータを除外して id と url のみ保持する', () => {
      const page = {
        id: 'p1',
        created_time: '2026-01-01T00:00:00.000Z',
        last_edited_time: '2026-01-01T00:00:00.000Z',
        created_by: { object: 'user', id: 'user-1' },
        last_edited_by: { object: 'user', id: 'user-1' },
        cover: null,
        icon: null,
        parent: { type: 'data_source_id', data_source_id: 'ds-123' },
        in_trash: false,
        is_archived: false,
        is_locked: false,
        url: 'https://www.notion.so/p1',
        public_url: null,
        archived: false,
        properties: {},
      };
      const result = compactPage(page);
      expect(Object.keys(result)).toEqual(['id', 'url', 'properties']);
      expect(result.id).toBe('p1');
      expect(result.url).toBe('https://www.notion.so/p1');
    });
  });

  describe('compactQueryResult', () => {
    it('クエリ結果全体をcompact形式に変換する', () => {
      const data = {
        object: 'list',
        results: [
          {
            id: 'p1',
            url: 'https://notion.so/p1',
            properties: {
              名前: { id: 'title', type: 'title', title: [{ plain_text: 'テスト' }] },
            },
          },
        ],
        has_more: true,
        next_cursor: 'cursor-abc',
        type: 'page_or_data_source',
      };
      const result = compactQueryResult(data);
      expect(result).toEqual({
        results: [
          {
            id: 'p1',
            url: 'https://notion.so/p1',
            properties: { 名前: 'テスト' },
          },
        ],
        has_more: true,
        next_cursor: 'cursor-abc',
      });
    });
  });
});
