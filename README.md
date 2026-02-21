# Notion Extra MCP Server

[![npm version](https://img.shields.io/npm/v/@ayatec/notion-extra-mcp-server)](https://www.npmjs.com/package/@ayatec/notion-extra-mcp-server)
[![CI](https://github.com/ayatec/notion-extra-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/ayatec/notion-extra-mcp-server/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

公式 Notion MCP サーバーを補完する MCP サーバー。
データベースクエリ、スキーマ管理、一括操作など、公式サーバーにない 5 つのツールを提供します。

## 提供ツール

### `query-database` -- データソースクエリ

データソースをフィルター・ソート付きでクエリします。

| パラメータ          | 型       | 必須 | デフォルト | 説明                                          |
| ------------------- | -------- | ---- | ---------- | --------------------------------------------- |
| `data_source_id`    | string   | Yes  | -          | データソース ID                               |
| `filter`            | object   | No   | -          | Notion API フィルタオブジェクト               |
| `sorts`             | object[] | No   | -          | ソート条件の配列                              |
| `page_size`         | number   | No   | `100`      | 1 ページあたりの取得件数（最大 100）          |
| `start_cursor`      | string   | No   | -          | ページネーションカーソル                      |
| `filter_properties` | string[] | No   | -          | 取得するプロパティ ID（トークン効率が上がる） |

### `get-data-source-schema` -- スキーマ取得

データソースのスキーマ（プロパティ一覧と型情報）を取得します。

| パラメータ       | 型     | 必須 | 説明            |
| ---------------- | ------ | ---- | --------------- |
| `data_source_id` | string | Yes  | データソース ID |

### `update-data-source-schema` -- スキーマ更新

データソースのスキーマ（プロパティ定義）を更新します。

| パラメータ       | 型     | 必須 | 説明                       |
| ---------------- | ------ | ---- | -------------------------- |
| `data_source_id` | string | Yes  | データソース ID            |
| `properties`     | object | Yes  | プロパティ定義オブジェクト |

> **注意**: select/multi_select の options は全オプションを指定する必要があります（省略されたオプションは削除されます）。status プロパティの name/options 変更は不可。

### `archive-page` -- ページアーカイブ

ページをアーカイブ（ゴミ箱に移動）します。データベース行の削除にも使用可能。

| パラメータ | 型     | 必須 | 説明      |
| ---------- | ------ | ---- | --------- |
| `page_id`  | string | Yes  | ページ ID |

### `batch-update-pages` -- 一括更新

複数ページのプロパティを一括更新します。レート制限（3req/s）を考慮して順次実行。

| パラメータ | 型       | 必須 | 説明                                                     |
| ---------- | -------- | ---- | -------------------------------------------------------- |
| `updates`  | object[] | Yes  | 更新リスト（最大 50 件）。各要素に page_id と properties |

## セットアップ

### 1. Notion Internal Integration の作成

1. [Notion Integrations](https://www.notion.so/profile/integrations/internal) にアクセス
2. 「新しいインテグレーション」をクリック
3. 名前を入力し、対象ワークスペースを選択
4. 必要な権限を設定:
   - **コンテンツを読み取る**: query-database, get-data-source-schema に必要
   - **コンテンツを更新する**: update-data-source-schema, archive-page, batch-update-pages に必要
5. 「保存」をクリックし、表示されるトークン（`ntn_` で始まる）をコピー

### 2. データベースへのアクセス許可

操作したいデータベースのページで:

1. 右上の「...」メニューをクリック
2. 「コネクション」 > 作成したインテグレーション名を選択
3. 「確認」をクリック

### 3. MCP 設定

#### npx で使う場合（推奨）

##### Claude Code

```bash
claude mcp add notion-extra npx @ayatec/notion-extra-mcp-server -e NOTION_TOKEN=ntn_your-token
```

##### Claude Desktop / その他の MCP クライアント

```json
{
  "mcpServers": {
    "notion-extra": {
      "command": "npx",
      "args": ["@ayatec/notion-extra-mcp-server"],
      "env": {
        "NOTION_TOKEN": "ntn_your-token"
      }
    }
  }
}
```

#### ローカルビルドで使う場合

```bash
git clone https://github.com/ayatec/notion-extra-mcp-server.git
cd notion-extra-mcp-server
cp .env.example .env
# .env を編集して NOTION_TOKEN を設定
pnpm install
pnpm build
```

##### Claude Code

```bash
claude mcp add notion-extra node /path/to/notion-extra-mcp-server/dist/index.js -e NOTION_TOKEN=ntn_your-token
```

##### Claude Desktop / その他の MCP クライアント

```json
{
  "mcpServers": {
    "notion-extra": {
      "command": "node",
      "args": ["/path/to/notion-extra-mcp-server/dist/index.js"],
      "env": {
        "NOTION_TOKEN": "ntn_your-token"
      }
    }
  }
}
```

## 開発

### コマンド

```bash
pnpm install        # 依存パッケージインストール
pnpm build          # ビルド
pnpm dev            # ウォッチモードでビルド
pnpm start          # サーバー起動（ビルド後）
pnpm dev:tool       # ツールの手動テスト
pnpm test           # テスト実行
pnpm test:watch     # テスト（ウォッチモード）
pnpm type-check     # 型チェック
pnpm lint           # ESLint実行
pnpm lint:fix       # ESLint自動修正
pnpm format         # Prettier実行
pnpm format:check   # フォーマットチェック
```

### ローカルテスト

`pnpm dev:tool` で各ツールを個別にテストできます。

```bash
# スキーマ取得
pnpm dev:tool get_data_source_schema --data_source_id "ds-xxx"

# データベースクエリ
pnpm dev:tool query_database --data_source_id "ds-xxx" --page_size 10

# フィルタ付きクエリ
pnpm dev:tool query_database --data_source_id "ds-xxx" --filter '{"property": "Status", "select": {"equals": "Done"}}'

# スキーマ更新
pnpm dev:tool update_data_source_schema --data_source_id "ds-xxx" --properties '{"NewProp": {"rich_text": {}}}'

# ページアーカイブ
pnpm dev:tool archive_page --page_id "page-xxx"

# 一括更新
pnpm dev:tool batch_update_pages --updates '[{"page_id": "p1", "properties": {"Name": {"title": [{"text": {"content": "New"}}]}}}]'
```

### リリース

[Changesets](https://github.com/changesets/changesets) でバージョン管理しています。

1. changeset ファイルを作成して main に push
2. GitHub Actions が自動で CHANGELOG 更新・バージョンバンプ・npm publish

## 技術スタック

- **TypeScript** (ESM, NodeNext, strict)
- **[MCP SDK](https://modelcontextprotocol.io/)** -- Model Context Protocol サーバー実装
- **[Notion API](https://developers.notion.com/)** -- Node.js 組み込み fetch で直接アクセス
- **[Zod](https://zod.dev/)** -- スキーマバリデーション
- **[Vitest](https://vitest.dev/)** -- テスト
- **[Changesets](https://github.com/changesets/changesets)** -- バージョン管理・CHANGELOG 自動生成

## ライセンス

MIT
