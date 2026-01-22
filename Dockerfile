FROM node:20-slim AS web-build

WORKDIR /app

COPY web/package.json web/package-lock.json web/
RUN npm --prefix web install

COPY web web
RUN npm --prefix web run build

FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY --from=web-build /app/web/dist ./web/dist

ENV PORT=8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
