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
     - `VITE_GOOGLE_CLIENT_ID`
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

### バックエンドだけ起動したい場合
- `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`

### フロントだけを開発したい場合
- 現状はAPIのベースURLが同一オリジン前提です
- フロント単独で動かすには、Viteのプロキシ設定などの追加が必要です

### 認証について
- Googleログインが前提です
- 開発時に認証をスキップしたい場合は、`.env` に `DEV_USER_ID` を設定してください

