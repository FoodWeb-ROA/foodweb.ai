from __future__ import annotations

import logging
import os
import secrets as _secrets
from pathlib import Path
from typing import Any, Literal

import httpx
import sentry_sdk
from sentry_sdk.types import Event, Hint
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import recaptchaenterprise_v1
from pydantic import BaseModel, EmailStr, Field, field_validator

# Load .env when present — no-op in Cloud Run (env comes from --set-env-vars / --set-secrets).
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

log = logging.getLogger("notion-proxy")
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s | %(message)s")


def _sentry_before_send(event: Event, hint: Hint) -> Event | None:
    """Drop client-error HTTPExceptions — they're user/captcha problems, not bugs."""
    exc_info = hint.get("exc_info") if isinstance(hint, dict) else None
    if isinstance(exc_info, tuple) and len(exc_info) >= 2:
        exc = exc_info[1]
        if isinstance(exc, HTTPException) and 400 <= exc.status_code < 500:
            return None
    return event


def _sentry_traces_sampler(ctx: dict[str, Any]) -> float:
    name = str((ctx.get("transaction_context") or {}).get("name") or "")
    if name.endswith("/healthz") or "/healthz" in name.lower():
        return 0.0
    return 1.0


_SENTRY_DSN = os.environ.get("SENTRY_DSN", "").strip()
_ENVIRONMENT = os.environ.get("ENVIRONMENT", "").strip().lower()
# Cloud Run sets ENVIRONMENT=production via cloudbuild; local dev leaves it unset,
# so Sentry stays disabled even if a developer happens to have SENTRY_DSN in their .env.
if _SENTRY_DSN and _ENVIRONMENT in {"production", "staging"}:
    sentry_sdk.init(
        dsn=_SENTRY_DSN,
        environment=_ENVIRONMENT,
        traces_sampler=_sentry_traces_sampler,
        send_default_pii=False,
        max_breadcrumbs=50,
        before_send=_sentry_before_send,
        enable_logs=True,
    )
    log.info("Sentry configured")
else:
    log.info("Sentry disabled (local/dev runtime)")

NOTION_TOKEN = os.environ["NOTION_TOKEN"]
NOTION_CONTACT_DATABASE_ID = os.environ["NOTION_CONTACT_DATABASE_ID"]
RECAPTCHA_PROJECT_ID = os.environ["RECAPTCHA_PROJECT_ID"]
RECAPTCHA_SITE_KEY = os.environ["RECAPTCHA_SITE_KEY"]
# Below this score (0.0 bot — 1.0 human) we reject. 0.5 is Google's default cut-off.
RECAPTCHA_MIN_SCORE = float(os.environ.get("RECAPTCHA_MIN_SCORE", "0.5"))
NOTION_VERSION = os.environ.get("NOTION_VERSION", "2022-06-28")
CORS_ALLOWED_ORIGINS = [
    o.strip() for o in os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",") if o.strip()
]

NOTION_PAGES_URL = "https://api.notion.com/v1/pages"

# Notion DB automations call this service when a blog page is published; we forward
# to GitHub's workflow_dispatch to re-run deploy.yml, which re-runs blog_sync and
# redeploys the site. Both values are optional so local dev / preview envs don't
# need them; the endpoint 503s if either is missing.
BLOG_WEBHOOK_SECRET = os.environ.get("BLOG_WEBHOOK_SECRET", "")
GITHUB_DISPATCH_TOKEN = os.environ.get("GITHUB_DISPATCH_TOKEN", "")
GITHUB_DISPATCH_REPO = os.environ.get("GITHUB_DISPATCH_REPO", "FoodWeb-ROA/foodweb.ai")
GITHUB_DISPATCH_WORKFLOW = os.environ.get("GITHUB_DISPATCH_WORKFLOW", "deploy.yml")
GITHUB_DISPATCH_REF = os.environ.get("GITHUB_DISPATCH_REF", "main")

# Authenticated via Application Default Credentials — the Cloud Run service account
# needs roles/recaptchaenterprise.agent on the project.
recaptcha_client = recaptchaenterprise_v1.RecaptchaEnterpriseServiceClient()

ContactSource = Literal["contact-page", "pricing-modal", "other"]

app = FastAPI(title="notion-proxy", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS or ["*"],
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["Content-Type"],
    max_age=86400,
)


class ContactPayload(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    company: str = Field(default="", max_length=120)
    role: str = Field(default="", max_length=120)
    message: str = Field(min_length=1, max_length=4000)
    source: ContactSource = "contact-page"
    recaptchaToken: str = Field(min_length=1, max_length=4096)

    @field_validator("name", "company", "role", "message", mode="before")
    @classmethod
    def _strip(cls, v):
        return v.strip() if isinstance(v, str) else v


@app.get("/healthz")
async def healthz():
    return {"ok": True}


@app.post("/contact")
async def contact(payload: ContactPayload):
    _verify_recaptcha(payload.recaptchaToken, expected_action="contact")
    async with httpx.AsyncClient(timeout=15.0) as client:
        page_url = await _create_contact_page(client, payload)
    return {"ok": True, "url": page_url}


def _verify_recaptcha(token: str, expected_action: str) -> None:
    event = recaptchaenterprise_v1.Event(token=token, site_key=RECAPTCHA_SITE_KEY)
    request = recaptchaenterprise_v1.CreateAssessmentRequest(
        parent=f"projects/{RECAPTCHA_PROJECT_ID}",
        assessment=recaptchaenterprise_v1.Assessment(event=event),
    )
    try:
        assessment = recaptcha_client.create_assessment(request=request)
    except Exception as exc:
        log.error("recaptcha assessment errored: %s", exc)
        raise HTTPException(status_code=502, detail={"error": "Captcha verification unavailable."})

    token_props = assessment.token_properties
    if not token_props.valid:
        log.warning("recaptcha token invalid: %s", token_props.invalid_reason)
        raise HTTPException(status_code=400, detail={"error": "Captcha failed. Please retry."})
    if token_props.action != expected_action:
        log.warning("recaptcha action mismatch: got=%s want=%s", token_props.action, expected_action)
        raise HTTPException(status_code=400, detail={"error": "Captcha failed. Please retry."})

    score = assessment.risk_analysis.score
    if score < RECAPTCHA_MIN_SCORE:
        log.warning("recaptcha low score: %.2f reasons=%s", score, list(assessment.risk_analysis.reasons))
        raise HTTPException(status_code=400, detail={"error": "Submission flagged as suspicious."})


async def _create_contact_page(client: httpx.AsyncClient, p: ContactPayload) -> str:
    body = {
        "parent": {"database_id": NOTION_CONTACT_DATABASE_ID},
        "properties": {
            "Name": {"title": [{"text": {"content": p.name[:120]}}]},
            "Email": {"email": str(p.email)},
            "Company": _rich_text(p.company),
            "Role": _rich_text(p.role),
            "Message": _rich_text(p.message),
            "Source": {"select": {"name": p.source}},
        },
    }
    resp = await client.post(
        NOTION_PAGES_URL,
        headers={
            "Authorization": f"Bearer {NOTION_TOKEN}",
            "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json",
        },
        json=body,
    )
    if resp.status_code >= 400:
        log.error("notion error %s: %s", resp.status_code, resp.text[:500])
        raise HTTPException(status_code=502, detail={"error": "Could not record submission."})
    return resp.json().get("url", "")


def _rich_text(value: str) -> dict:
    if not value:
        return {"rich_text": []}
    # Notion caps rich_text content per block at 2000 chars; split if needed.
    chunks = [value[i : i + 2000] for i in range(0, len(value), 2000)]
    return {"rich_text": [{"text": {"content": c}} for c in chunks]}


@app.post("/webhooks/notion-blog", status_code=202)
async def notion_blog_webhook(request: Request, x_webhook_secret: str = Header(default="")):
    if not BLOG_WEBHOOK_SECRET or not GITHUB_DISPATCH_TOKEN:
        log.error("blog webhook called but BLOG_WEBHOOK_SECRET / GITHUB_DISPATCH_TOKEN unset")
        raise HTTPException(status_code=503, detail={"error": "Webhook not configured."})
    if not _secrets.compare_digest(x_webhook_secret, BLOG_WEBHOOK_SECRET):
        raise HTTPException(status_code=401, detail={"error": "Bad secret."})

    try:
        body = await request.json()
    except Exception:
        body = {}
    page_id = _extract_page_id(body)
    if not page_id:
        log.warning("blog webhook: no page id in body keys=%s", list(body) if isinstance(body, dict) else type(body).__name__)
        raise HTTPException(status_code=400, detail={"error": "No page id in webhook body."})

    async with httpx.AsyncClient(timeout=15.0) as client:
        page_resp = await client.get(
            f"https://api.notion.com/v1/pages/{page_id}",
            headers={
                "Authorization": f"Bearer {NOTION_TOKEN}",
                "Notion-Version": NOTION_VERSION,
            },
        )
        if page_resp.status_code >= 400:
            log.error("notion fetch failed %s: %s", page_resp.status_code, page_resp.text[:500])
            raise HTTPException(status_code=502, detail={"error": "Could not read page."})
        page = page_resp.json()
        if bool((page.get("properties", {}).get("Draft") or {}).get("checkbox")):
            log.info("blog webhook %s: draft, skipping dispatch", page_id)
            return {"ok": True, "skipped": "draft"}

        url = (
            f"https://api.github.com/repos/{GITHUB_DISPATCH_REPO}"
            f"/actions/workflows/{GITHUB_DISPATCH_WORKFLOW}/dispatches"
        )
        resp = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {GITHUB_DISPATCH_TOKEN}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            json={"ref": GITHUB_DISPATCH_REF},
        )
    if resp.status_code >= 400:
        log.error("github dispatch failed %s: %s", resp.status_code, resp.text[:500])
        raise HTTPException(status_code=502, detail={"error": "Could not trigger rebuild."})
    log.info("dispatched %s on %s@%s for page %s", GITHUB_DISPATCH_WORKFLOW, GITHUB_DISPATCH_REPO, GITHUB_DISPATCH_REF, page_id)
    return {"ok": True}


def _extract_page_id(body: Any) -> str:
    # Notion "Send webhook" payloads put the triggering page under .data; older /
    # custom payloads might put it at the top level. Try both, accept either shape.
    if not isinstance(body, dict):
        return ""
    for candidate in (body.get("data"), body):
        if isinstance(candidate, dict) and candidate.get("object") == "page" and candidate.get("id"):
            return str(candidate["id"])
    pid = body.get("page_id") or body.get("id")
    return str(pid) if pid else ""
