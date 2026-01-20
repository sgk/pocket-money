#!/usr/bin/env bash
_OLD_SHELL_OPTS="$(set +o)"
set -e
set -o pipefail

VENV_DIR=".venv"
if [ ! -d "$VENV_DIR" ]; then
  python3 -m venv "$VENV_DIR"
fi

_PROMPT_NAME="$(basename "$(pwd)")"
export VIRTUAL_ENV_DISABLE_PROMPT=1

# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"

if [ -n "${PS1-}" ]; then
  _BASE_PROMPT="${_OLD_VIRTUAL_PROMPT-${PS1}}"
  PS1="(${_PROMPT_NAME}) ${_BASE_PROMPT}"
fi

mkdir -p .gcloud
export CLOUDSDK_CONFIG="$(pwd)/.gcloud"

if [ -f ".env" ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
else
  echo ".env not found. Copy from .env.example and fill values." >&2
fi

eval "$_OLD_SHELL_OPTS"
