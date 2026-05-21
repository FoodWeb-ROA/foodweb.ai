"""notion-proxy.

Thin Cloud Run service that proxies foodweb.ai traffic into Notion.
Currently: POST /contact → Website Contact Form database.
Coming next turn: blog post sync from a Notion database.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Literal

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import recaptchaenterprise_v1
from pydantic import BaseModel, EmailStr, Field, field_validator

# Load .env when present — no-op in Cloud Run (env comes from --set-env-vars / --set-secrets).
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

log = logging.getLogger("notion-proxy")
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s | %(message)s")

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
