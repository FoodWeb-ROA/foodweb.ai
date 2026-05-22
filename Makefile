SHELL := /bin/bash
.DEFAULT_GOAL := help

PYTHON ?= python3.11
UV ?= uv
BACKEND_DIR := backend
VENV_DIR := $(BACKEND_DIR)/.venv
PORT ?= 8080

.PHONY: help start install clean

help:
	@printf "foodweb.ai targets:\n"
	@printf "  make install   Create backend/.venv and install requirements.txt\n"
	@printf "  make start     Load backend/.env and run the FastAPI backend with reload (PORT=$(PORT))\n"
	@printf "  make clean     Remove backend/.venv\n"

install:
	cd "$(BACKEND_DIR)" && $(UV) venv --python "$(PYTHON)" .venv
	cd "$(BACKEND_DIR)" && $(UV) pip install --python .venv/bin/python -r requirements.txt

start:
	@bash -c 'set -euo pipefail; \
		if [[ ! -f "./$(BACKEND_DIR)/.env" ]]; then \
			echo "$(BACKEND_DIR)/.env not found — copy $(BACKEND_DIR)/.env.example to $(BACKEND_DIR)/.env and fill it in" >&2; \
			exit 1; \
		fi; \
		if [[ ! -x "./$(VENV_DIR)/bin/uvicorn" ]]; then \
			echo "$(VENV_DIR) missing — running make install first" >&2; \
			$(MAKE) install; \
		fi; \
		set -a; \
		source "./$(BACKEND_DIR)/.env"; \
		set +a; \
		cd "$(BACKEND_DIR)" && ./.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port "$(PORT)" --reload'

clean:
	rm -rf "$(VENV_DIR)"
