# CLAUDE.md

公式 Notion MCP サーバーを補完する MCP サーバー。データベースクエリ、スキーマ管理、一括操作を提供。

## 開発コマンド

```bash
pnpm install        # 依存パッケージインストール
pnpm build          # ビルド
pnpm dev            # ウォッチモードでビルド
pnpm start          # サーバー起動（ビルド後）
pnpm dev:tool       # ツールの手動テスト
pnpm clean          # ビルド成果物削除
pnpm test           # テスト実行（Vitest）
pnpm test:watch     # テスト（ウォッチモード）
pnpm type-check     # 型チェック
pnpm lint           # ESLint実行
pnpm lint:fix       # ESLint自動修正
pnpm format         # Prettier実行
pnpm format:check   # フォーマットチェック
```

## アーキテクチャ

### ディレクトリ構成

```
src/
  config.ts              # 環境変数・サーバー設定
  index.ts               # エントリポイント
  types/                 # 型定義
  lib/                   # Notion API クライアント
    __tests__/           # lib のユニットテスト
  tools/                 # MCPツール（5ツール）
    __tests__/           # tools のユニットテスト
  utils/                 # ユーティリティ（rate-limiter）
scripts/
  test-tool.ts           # ローカルテスト用CLI
.changeset/              # Changesets 設定・changeset ファイル
.github/workflows/       # GitHub Actions（CI, Release）
```

### 提供ツール

1. **query-database** — データソースをフィルター・ソート付きでクエリ。ページネーション対応
2. **get-data-source-schema** — データソースのスキーマ（プロパティ一覧と型情報）を取得
3. **update-data-source-schema** — データベースのスキーマ（プロパティ定義）を更新
4. **archive-page** — ページをアーカイブ（ゴミ箱に移動）
5. **batch-update-pages** — 複数ページのプロパティを一括更新（最大50件、レート制限対応）

### Notion API

- **ベースURL**: `https://api.notion.com/v1`
- **APIバージョン**: `2025-09-03`
- **Data Sources API**: query-database, get-data-source-schema で使用
- **Database API**: update-data-source-schema で使用（`/v1/databases/{id}`）
- **Pages API**: archive-page, batch-update-pages で使用

### 環境変数

- `NOTION_TOKEN` — Notion Internal Integration トークン（必須）

## テスト

- **フレームワーク**: Vitest
- **テスト配置**: `src/**/__tests__/*.test.ts`
- **ビルド除外**: `tsconfig.json` で `__tests__` を exclude（dist に含まれない）
- **API モック**: notion-client モジュールを `vi.mock` でモック。実際の API 呼び出しは行わない

## CI/CD

- **CI** (`ci.yml`): push/PR で type-check, lint, format:check, test, build を実行
- **Release** (`ci.yml`): main に changeset 付きで push すると自動で CHANGELOG 更新・バージョンバンプ・npm publish

### リリースフロー

1. changeset ファイルを `.changeset/` に作成（`pnpm changeset` は非対応、ファイルを直接作成）
2. main に push
3. GitHub Actions が自動処理: changeset version → コミット & push → npm publish

### Changeset 運用ルール

- **機能変更時は必ず changeset を作成する**（バグ修正・機能追加・破壊的変更など）
- ドキュメントのみの変更や CI 設定変更など、npm パッケージに影響しない変更では不要
- セマンティックバージョニング: `patch`（バグ修正）、`minor`（機能追加・変更）、`major`（破壊的変更）

## 技術スタック

- TypeScript (ESM, NodeNext, strict)
- @modelcontextprotocol/sdk
- Notion API（Node.js 組み込み fetch）
- zod v4
- Vitest
- Changesets
