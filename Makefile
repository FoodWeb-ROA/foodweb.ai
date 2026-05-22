SHELL := /bin/bash
.DEFAULT_GOAL := help

PYTHON ?= python3.11
UV ?= uv
BACKEND_DIR := backend
VENV_DIR := $(BACKEND_DIR)/.venv
PORT ?= 8080
FRONTEND_PORT ?= 4321

.PHONY: help start stop install clean

help:
	@printf "foodweb.ai targets:\n"
	@printf "  make install   Create backend/.venv and install requirements.txt\n"
	@printf "  make start     Run the FastAPI backend (PORT=$(PORT)) and the Astro frontend (FRONTEND_PORT=$(FRONTEND_PORT)) together\n"
	@printf "  make stop      Kill any processes listening on PORT/FRONTEND_PORT\n"
	@printf "  make clean     Remove backend/.venv\n"

install:
	cd "$(BACKEND_DIR)" && $(UV) venv --python "$(PYTHON)" .venv
	cd "$(BACKEND_DIR)" && $(UV) pip install --python .venv/bin/python -r requirements.txt

stop:
	@bash -c 'for port in $(PORT) $(FRONTEND_PORT); do \
		pids=$$(lsof -ti tcp:$$port 2>/dev/null || true); \
		if [[ -n "$$pids" ]]; then \
			echo "killing pids on port $$port: $$pids"; \
			kill $$pids 2>/dev/null || true; \
			sleep 1; \
			pids=$$(lsof -ti tcp:$$port 2>/dev/null || true); \
			if [[ -n "$$pids" ]]; then kill -9 $$pids 2>/dev/null || true; fi; \
		fi; \
	done'

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
		if [[ ! -d "./node_modules" ]]; then \
			echo "node_modules missing — running yarn install first" >&2; \
			yarn install; \
		fi; \
		set -a; \
		source "./$(BACKEND_DIR)/.env"; \
		set +a; \
		cleanup() { echo; echo "shutting down..."; $(MAKE) stop || true; }; \
		trap cleanup EXIT INT TERM; \
		( cd "$(BACKEND_DIR)" && ./.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port "$(PORT)" --reload ) & \
		backend_pid=$$!; \
		( yarn dev --port "$(FRONTEND_PORT)" ) & \
		frontend_pid=$$!; \
		while kill -0 "$$backend_pid" 2>/dev/null && kill -0 "$$frontend_pid" 2>/dev/null; do sleep 1; done'

clean:
	rm -rf "$(VENV_DIR)"
