.PHONY: run web-build deploy

web-build:
	npm --prefix web install
	npm --prefix web run build

run: web-build
	uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

deploy:
	@if [ ! -f .env ]; then echo ".env ファイルが見つかりません"; exit 1; fi
	@set -a; . ./.env; set +a; \
	if [ -z "$$GOOGLE_CLOUD_PROJECT" ]; then echo "GOOGLE_CLOUD_PROJECT が必要です"; exit 1; fi; \
	if [ -z "$$GOOGLE_CLIENT_ID" ]; then echo "GOOGLE_CLIENT_ID が必要です"; exit 1; fi; \
	if [ -z "$$SESSION_SECRET" ]; then echo "SESSION_SECRET が必要です"; exit 1; fi; \
	if [ -z "$$FIRESTORE_DATABASE" ]; then echo "FIRESTORE_DATABASE が必要です"; exit 1; fi; \
	if [ -z "$$CLOUD_RUN_SERVICE" ]; then echo "CLOUD_RUN_SERVICE が必要です"; exit 1; fi; \
	if [ -z "$$CLOUD_RUN_REGION" ]; then echo "CLOUD_RUN_REGION が必要です"; exit 1; fi; \
	gcloud run deploy "$$CLOUD_RUN_SERVICE" \
		--source . \
		--region "$$CLOUD_RUN_REGION" \
		--project "$$GOOGLE_CLOUD_PROJECT" \
		--allow-unauthenticated \
		--set-env-vars "GOOGLE_CLOUD_PROJECT=$$GOOGLE_CLOUD_PROJECT,FIRESTORE_DATABASE=$$FIRESTORE_DATABASE,GOOGLE_CLIENT_ID=$$GOOGLE_CLIENT_ID,SESSION_SECRET=$$SESSION_SECRET"
