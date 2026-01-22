# おこづかいノート

## これは何か
Googleログインで使える、家計の元帳（いれもの別の入出金・資金移動）アプリです。FastAPIとViteの構成で、起動するとブラウザから使えます。

## 必要な環境
- Node.js 18以上
- Python 3.11以上
- Google Cloud プロジェクト（Firestore利用）
- Google OAuth クライアントID（Web）
- Application Default Credentials（gcloudなどで認証）

## インストール方法
1. リポジトリを取得
   - `git clone <repo> && cd pocket-money`
2. 環境変数を用意
   - `cp dotenv-example .env`
   - `.env` の値を埋める
     - `GOOGLE_CLOUD_PROJECT`
     - `FIRESTORE_DATABASE`
     - `GOOGLE_CLIENT_ID`
     - `VITE_GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_ID` と `VITE_GOOGLE_CLIENT_ID` は同じ値を使ってください
3. 依存関係をインストール
   - `python3 -m venv .venv`
   - `source .venv/bin/activate`
   - `pip install -r requirements.txt`

## 操作方法
1. 起動
   - `make run`
2. ブラウザで開く
   - `http://localhost:8000/`
3. Googleログインして使う

## GCPの設定方法（gcloud）
1. プロジェクト作成・選択
   - `gcloud projects create <PROJECT_ID>`
   - `gcloud config set project <PROJECT_ID>`
2. Firestoreを有効化（Nativeモード）
   - `gcloud services enable firestore.googleapis.com`
   - `gcloud firestore databases create --region=asia-northeast1`
3. Cloud Run用のAPIを有効化
   - `gcloud services enable run.googleapis.com artifactregistry.googleapis.com`
4. 認証情報の準備
   - Google CloudのADCを使います
   - `gcloud auth application-default login`
5. OAuthクライアントIDを作成
   - `gcloud services enable oauth2.googleapis.com`
   - `gcloud alpha iap oauth-clients create --display_name=money-web --brand=<BRAND_ID>`
   - 作成されたクライアントIDを `GOOGLE_CLIENT_ID` と `VITE_GOOGLE_CLIENT_ID` に設定

## Cloud Runへのデプロイ方法
1. コンテナをビルドしてArtifact Registryへ登録
   - `gcloud artifacts repositories create pocket-money --repository-format=docker --location=asia-northeast1`
   - `gcloud builds submit --tag asia-northeast1-docker.pkg.dev/<PROJECT_ID>/pocket-money/app`
2. Cloud Runへデプロイ
   - `gcloud run deploy pocket-money --image asia-northeast1-docker.pkg.dev/<PROJECT_ID>/pocket-money/app --region asia-northeast1 --allow-unauthenticated`
3. 環境変数を設定
   - `gcloud run services update pocket-money --region asia-northeast1 --set-env-vars GOOGLE_CLOUD_PROJECT=<PROJECT_ID>,FIRESTORE_DATABASE=(default),GOOGLE_CLIENT_ID=<CLIENT_ID>,VITE_GOOGLE_CLIENT_ID=<CLIENT_ID>`
