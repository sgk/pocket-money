# お小遣い帳 API (MVP)

## 概要
Google ID トークンの `sub` を uid として利用し、`users/{uid}` 配下に完全分離されたテナントを作る FastAPI + Firestore のバックエンドです。資産・費目・取引を管理し、残高は Firestore transaction で整合性を保ちます。

## セットアップ（ローカル）
1. 仮想環境を作成して有効化します。
2. 依存関係をインストールします。

```bash
pip install -r requirements.txt
```

3. 環境変数を設定します（下記例）。
   - `dotenv-example` を `.env` にコピーして値を設定してください。
   - もしくは `source activate.sh` で venv 有効化と `.env` の読み込みができます。
   - `source activate.sh` 実行時に `.gcloud/` を作成し、このディレクトリ配下に gcloud 設定を保存します。

## 環境変数例

```env
GOOGLE_CLOUD_PROJECT=your-project-id
FIRESTORE_DATABASE=(default)
GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
DEV_USER_ID=local-user
```

## GOOGLE_CLIENT_ID の取得方法
`GOOGLE_CLIENT_ID` には Google OAuth の Web クライアント ID（`xxxx.apps.googleusercontent.com`）を設定します。

1. GCP コンソールで「API とサービス」→「認証情報」へ移動
2. 「認証情報を作成」→「OAuth クライアント ID」
3. アプリケーションの種類は「ウェブ アプリケーション」
4. 発行されたクライアント ID を `GOOGLE_CLIENT_ID` に設定

## クライアントシークレットについて
このAPIでは Google ID トークンを検証するため、クライアントシークレットは不要です（公開鍵検証のみ）。\n\n将来、OAuth の認可コードフローをサーバー側で扱う場合のみ、`GOOGLE_CLIENT_SECRET` を追加で環境変数として設定してください。

## GCP 初期設定
1. gcloud をインストールしてログインします。

```bash
gcloud auth login
```

2. 使用するプロジェクトを設定します。

```bash
gcloud config set project YOUR_PROJECT_ID
```

3. Firestore を有効化します。

```bash
gcloud services enable firestore.googleapis.com
```

4. Firestore を Native モードで作成します（未作成の場合）。

```bash
gcloud firestore databases create --location=YOUR_LOCATION
```

5. ローカル実行時は Application Default Credentials を用意します。

```bash
gcloud auth application-default login
```

## 起動方法（uvicorn）

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Web UI
起動後に `http://localhost:8000/` へアクセスすると、簡易のWeb UIが利用できます。  
ローカル開発では `DEV_USER_ID` を設定しておけば自動ログインで操作できます。  
Google 認証で試す場合は、Web UI の「Google ログイン」ボタンから ID トークンを取得します（`GOOGLE_CLIENT_ID` が必要）。

## ローカル認証（dev トークン）
本番では Google ID トークンで認証します。ローカル開発では環境変数で簡易ログインを行います。

- `DEV_USER_ID` を設定すると、そのユーザーIDで自動ログインします（ヘッダ不要）
- 例: `DEV_USER_ID=local-user`

```bash
curl http://localhost:8000/healthz
```

## APIの簡単な利用例

```bash
# ブートストラップ
curl -X POST \
  -H "Authorization: Bearer dev:local-user" \
  http://localhost:8000/api/bootstrap

# 資産作成
curl -X POST \
  -H "Authorization: Bearer dev:local-user" \
  -H "Content-Type: application/json" \
  -d '{"name":"Bank","type":"bank","initialBalance":1000}' \
  http://localhost:8000/api/assets

# 収入作成
curl -X POST \
  -H "Authorization: Bearer dev:local-user" \
  -H "Content-Type: application/json" \
  -d '{"occurredAt":"2024-01-01T00:00:00Z","amount":500,"assetId":"<assetId>","categoryId":"<categoryId>","source":"Salary"}' \
  http://localhost:8000/api/transactions/income

# 支出作成
curl -X POST \
  -H "Authorization: Bearer dev:local-user" \
  -H "Content-Type: application/json" \
  -d '{"occurredAt":"2024-01-02T00:00:00Z","amount":200,"assetId":"<assetId>","categoryId":"<categoryId>","merchant":"Store"}' \
  http://localhost:8000/api/transactions/expense

# 振替作成
curl -X POST \
  -H "Authorization: Bearer dev:local-user" \
  -H "Content-Type: application/json" \
  -d '{"occurredAt":"2024-01-03T00:00:00Z","amount":100,"fromAssetId":"<fromAssetId>","toAssetId":"<toAssetId>","fee":10}' \
  http://localhost:8000/api/transactions/transfer

# 月次サマリ
curl -H "Authorization: Bearer dev:local-user" \
  "http://localhost:8000/api/summary/monthly?year=2024&month=1"
```

## Cloud Run デプロイ

```bash
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/pocket-money-api

gcloud run deploy pocket-money-api \
  --image gcr.io/YOUR_PROJECT_ID/pocket-money-api \
  --platform managed \
  --region YOUR_REGION \
  --set-env-vars GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID,GOOGLE_CLIENT_ID=YOUR_CLIENT_ID \
  --allow-unauthenticated
```

## 注意：Firestore直アクセスしない理由
資産の `currentBalance` は取引に連動して更新されるキャッシュです。取引の作成/更新/削除は Firestore transaction で原子的に実行される必要があるため、直接書き込みは整合性を壊します。
