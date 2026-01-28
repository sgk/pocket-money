# 開発者向けガイド

## 開発環境
- Node.js 18以上
- Python 3.11以上
- Google Cloud プロジェクト（Firestore利用）
- Google OAuth クライアントID（Web）
- Application Default Credentials（gcloudなどで認証）

## 開発環境の設定
1. 環境変数の準備
   - `cp dotenv-example .env`
   - `.env` の値を埋める
     - `GOOGLE_CLOUD_PROJECT`
     - `FIRESTORE_DATABASE`
     - `GOOGLE_CLIENT_ID`
     - `SESSION_SECRET`
     - `SESSION_EXPIRE_DAYS`（未指定なら7）
2. Python依存の導入
   - `python3 -m venv .venv`
   - `source .venv/bin/activate`
   - `pip install -r requirements.txt`
3. フロント依存の導入
   - `npm --prefix web install`

## 開発環境の使い方
### ふだんの起動
- `make run`
  - 先にフロントをビルドしてから、FastAPIを起動します
  - アクセス先: `http://localhost:8000/`
  - `.env` は `make run` の中で読み込みます

### シェルの準備
- `source activate.sh`
  - Python venv と GCP CLI の設定のみを行います
  - `.env` は読み込みません

## UI仕様
- 画面ごとの重要な仕様は `docs/UI_SPEC.md` にまとめています

### Cloud Runへデプロイ
- `.env` に `CLOUD_RUN_SERVICE` と `CLOUD_RUN_REGION` を追加
- `make deploy` を実行

### バックエンドだけ起動したい場合
- `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`

### フロントだけを開発したい場合
- 現状はAPIのベースURLが同一オリジン前提です
- フロント単独で動かすには、Viteのプロキシ設定などの追加が必要です

### 認証について
- Googleログインが前提です
- 開発時に認証をスキップしたい場合は、`.env` に `DEV_USER_ID` を設定してください
- ログイン有効期限は `SESSION_EXPIRE_DAYS` で調整できます
- 長期セッションの署名に `SESSION_SECRET` が必要です

## 取引APIのキャッシュ方針（Last-Modified / 304）
- `/api/transactions` は `Last-Modified` ヘッダーを返します
- クライアントは同じ条件（資産・期間など）で再取得する際に `If-Modified-Since` を付けます
- 変更がなければAPIは `304 Not Modified` を返し、クライアントは手元の結果を再利用します
- 変更検知はユーザー単位の `transactionsUpdatedAt` で行います
- `transactionsUpdatedAt` は取引の作成・更新・削除・一括削除・インポートで更新されます
- `transactionsUpdatedAt` は資産の作成・更新・無効化でも更新されます（初期残高が元帳に影響するため）
フロント側（React Query）の挙動:
- `useTransactions` に `staleTime: 60秒` を設定しています
- `refetchOnWindowFocus: false` を設定しています
- 取引系の更新では `invalidateQueries(["transactions"])` に加えて、`If-Modified-Since` 用のローカルキャッシュもクリアします

## スマホへのインストール（PWA）
- `vite-plugin-pwa` を導入し、Service Worker と manifest を生成しています
- 本番ビルド後にインストール可能になります
- 確認手順は次のとおりです
1. `npm --prefix web run build`
2. `make run`
3. スマホのブラウザで `http://<PCのIPアドレス>:8000/` を開く
4. ブラウザの「ホーム画面に追加」または「インストール」を実行する
- アイコンは現在 `web/public/favicon.svg` を使っています
- iOSの見た目を整えるには、PNGの `apple-touch-icon` と 192/512px のアイコンを追加してください
