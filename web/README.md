# お小遣い帳 Web

`web/` は React + Vite で実装された SPA です。最終的には `npm run build` の成果物を FastAPI から配信します。

## 役割
- ログイン画面（Google Identity Services）
- ダッシュボード / 元帳 / 資産 / 設定画面
- `/api/*` へのクライアント通信

## 開発

```bash
npm install
npm run dev
```

## ビルド

```bash
npm run build
```

`dist/` が生成され、バックエンド（`app/main.py`）が静的配信します。

## 環境変数について

現在の実装では、Google クライアント ID は Vite 環境変数ではなく、`/api/config` から取得します。
そのため、フロント単体の `.env` 必須項目はありません。

## ディレクトリ概要

```text
src/
  components/   UI コンポーネント
  lib/          API クライアント、状態管理、各種ロジック
  pages/        ページコンポーネント
  routes.tsx    ルーティング定義
```
