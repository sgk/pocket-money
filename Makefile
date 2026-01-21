.PHONY: run web-build

web-build:
	npm --prefix web install
	npm --prefix web run build

run: web-build
	uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
