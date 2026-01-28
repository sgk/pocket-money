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
  case "$PS1" in
    "(${_PROMPT_NAME}) "*)
      : ;;
    *)
      PS1="(${_PROMPT_NAME}) ${_BASE_PROMPT}"
      ;;
  esac
fi

mkdir -p .gcloud
export CLOUDSDK_CONFIG="$(pwd)/.gcloud"

eval "$_OLD_SHELL_OPTS"
