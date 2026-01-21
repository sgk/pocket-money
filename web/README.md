# お小遣い帳 Web (Vite + React)

Microsoft Money風の元帳UIを持つSPAです。Google認証（ID Token）を使ってバックエンドAPIに接続します。

## 環境変数

`.env` を作成し、以下を設定してください。

```env
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
VITE_ALLOW_DEV_AUTH=true
```

`.env.example` も参照してください。

## セットアップ & 起動

```bash
npm install
npm run dev
```

## ビルド

```bash
npm run build
```

`dist/` が生成され、FastAPIから静的配信できます。

## Dev Login

`VITE_ALLOW_DEV_AUTH=true` のとき、ログイン画面に Dev Login が表示されます。

- UID を入力して `dev:<uid>` 形式のトークンでログインします。
- 本番環境では `VITE_ALLOW_DEV_AUTH=false` を推奨します。

## 画面一覧

- `/login` ログイン
- `/` ダッシュボード
- `/ledger` 全資産元帳
- `/assets` 資産一覧
- `/assets/:assetId/ledger` 資産別元帳
- `/settings/assets` 資産管理
- `/settings/categories` 費目管理

## FastAPIで配信する場合の注意

SPAのため、FastAPI側で **全ての未解決パスを `index.html` にフォールバック** する必要があります。
