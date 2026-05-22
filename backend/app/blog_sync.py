"""Sync the Notion 'Blog Posts' DB → src/content/blog/<slug>.mdx.

Idempotent. Notion is the source of truth: drafts are skipped, and local MDX
files whose slug isn't in Notion are deleted.

Run from anywhere:
    python -m app.blog_sync                       # default output: ../src/content/blog
    python -m app.blog_sync --out ./tmp           # for dry-run inspection
"""
from __future__ import annotations

import argparse
import logging
import os
import sys
from pathlib import Path
from typing import Iterable

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

NOTION_TOKEN = os.environ["NOTION_TOKEN"]
NOTION_BLOG_DATABASE_ID = os.environ["NOTION_BLOG_DATABASE_ID"]
NOTION_VERSION = os.environ.get("NOTION_VERSION", "2022-06-28")

API = "https://api.notion.com/v1"
HEADERS = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
}

log = logging.getLogger("blog_sync")


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s | %(message)s")
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--out",
        default=str(Path(__file__).resolve().parents[2] / "src" / "content" / "blog"),
        help="Output directory for *.mdx files (defaults to <repo>/src/content/blog).",
    )
    args = parser.parse_args()
    out_dir = Path(args.out).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    with httpx.Client(headers=HEADERS, timeout=30.0) as client:
        pages = list(_query_pages(client))
        log.info("found %d page(s) in Notion blog DB", len(pages))
        kept: set[str] = set()
        for page in pages:
            slug = _prop_text(page, "Slug").strip()
            if not slug:
                log.warning("page %s has no Slug — skipping", page["id"])
                continue
            if _prop_checkbox(page, "Draft"):
                log.info("skip draft %s", slug)
                continue
            mdx = _render(page, _fetch_blocks(client, page["id"]))
            (out_dir / f"{slug}.mdx").write_text(mdx, encoding="utf-8")
            kept.add(slug)
            log.info("wrote %s.mdx", slug)
        _prune_stale(out_dir, kept)
    return 0


# --- Notion API ---------------------------------------------------------------

def _query_pages(client: httpx.Client) -> Iterable[dict]:
    cursor: str | None = None
    while True:
        body: dict = {"page_size": 100, "sorts": [{"property": "Date", "direction": "descending"}]}
        if cursor:
            body["start_cursor"] = cursor
        r = client.post(f"{API}/databases/{NOTION_BLOG_DATABASE_ID}/query", json=body)
        r.raise_for_status()
        data = r.json()
        yield from data["results"]
        if not data.get("has_more"):
            return
        cursor = data.get("next_cursor")


def _fetch_blocks(client: httpx.Client, block_id: str) -> list[dict]:
    out: list[dict] = []
    cursor: str | None = None
    while True:
        params: dict[str, str | int] = {"page_size": 100}
        if cursor:
            params["start_cursor"] = cursor
        r = client.get(f"{API}/blocks/{block_id}/children", params=params)
        r.raise_for_status()
        data = r.json()
        for block in data["results"]:
            if block.get("has_children"):
                block["_children"] = _fetch_blocks(client, block["id"])
            out.append(block)
        if not data.get("has_more"):
            return out
        cursor = data.get("next_cursor")


# --- rendering ----------------------------------------------------------------

def _render(page: dict, blocks: list[dict]) -> str:
    title = _prop_text(page, "Title")
    description = _prop_text(page, "Description")
    date = _prop_date(page, "Date")
    tag = _prop_select(page, "Tag")
    author = _prop_select(page, "Author") or "FoodWeb"
    minutes = _prop_number(page, "Reading minutes")
    cover = _prop_url(page, "Cover")
    draft = _prop_checkbox(page, "Draft")

    front = ["---", f"title: {_yaml_str(title)}", f"description: {_yaml_str(description)}"]
    if date:
        front.append(f"date: {date}")
    if tag:
        front.append(f"tag: {tag}")
    front.append(f"author: {author}")
    if minutes is not None:
        front.append(f"minutes: {int(minutes)}")
    if draft:
        front.append("draft: true")
    if cover:
        front.append(f"cover: {_yaml_str(cover)}")
    front.append("---")

    body = _blocks_to_md(blocks).rstrip()
    return "\n".join(front) + "\n\n" + body + "\n"


def _blocks_to_md(blocks: list[dict], depth: int = 0) -> str:
    out: list[str] = []
    i = 0
    while i < len(blocks):
        b = blocks[i]
        t = b.get("type") or ""
        rt = b.get(t, {}).get("rich_text", [])
        if t == "paragraph":
            out.append(_rich_to_md(rt))
        elif t == "heading_1":
            out.append(f"# {_rich_to_md(rt)}")
        elif t == "heading_2":
            out.append(f"## {_rich_to_md(rt)}")
        elif t == "heading_3":
            out.append(f"### {_rich_to_md(rt)}")
        elif t == "bulleted_list_item":
            group, i = _collect(blocks, i, "bulleted_list_item")
            out.append(_render_list(group, ordered=False, depth=depth))
            continue
        elif t == "numbered_list_item":
            group, i = _collect(blocks, i, "numbered_list_item")
            out.append(_render_list(group, ordered=True, depth=depth))
            continue
        elif t == "quote":
            text = _rich_to_md(rt)
            out.append("\n".join(f"> {line}" for line in (text.splitlines() or [""])))
        elif t == "callout":
            out.append(f"> {_rich_to_md(rt)}")
        elif t == "code":
            lang = b.get("code", {}).get("language", "")
            out.append(f"```{lang}\n{_rich_to_plain(rt)}\n```")
        elif t == "divider":
            out.append("---")
        elif t == "image":
            img = b.get("image", {})
            url = (img.get("external") or img.get("file") or {}).get("url", "")
            caption = _rich_to_plain(img.get("caption", []))
            if url:
                out.append(f"![{caption}]({url})")
        else:
            log.debug("unhandled block type: %s", t)
        i += 1
    return "\n\n".join(s for s in out if s.strip())


def _collect(blocks: list[dict], start: int, ty: str) -> tuple[list[dict], int]:
    j = start
    group: list[dict] = []
    while j < len(blocks) and blocks[j].get("type") == ty:
        group.append(blocks[j])
        j += 1
    return group, j


def _render_list(items: list[dict], ordered: bool, depth: int) -> str:
    indent = "  " * depth
    lines: list[str] = []
    for n, item in enumerate(items, start=1):
        rt = item.get(item["type"], {}).get("rich_text", [])
        marker = f"{n}." if ordered else "-"
        lines.append(f"{indent}{marker} {_rich_to_md(rt)}")
        for child in item.get("_children") or []:
            # only nested lists get re-indented; other children rendered as-is
            lines.append(_blocks_to_md([child], depth + 1))
    return "\n".join(lines)


def _rich_to_md(rich: list[dict]) -> str:
    parts: list[str] = []
    for span in rich:
        text = span.get("plain_text", "")
        ann = span.get("annotations", {}) or {}
        if ann.get("code"):
            text = f"`{text}`"
        if ann.get("bold"):
            text = f"**{text}**"
        if ann.get("italic"):
            text = f"*{text}*"
        if ann.get("strikethrough"):
            text = f"~~{text}~~"
        href = span.get("href")
        if href:
            text = f"[{text}]({href})"
        parts.append(text)
    return "".join(parts)


def _rich_to_plain(rich: list[dict]) -> str:
    return "".join(t.get("plain_text", "") for t in rich)


# --- property accessors -------------------------------------------------------

def _prop(page: dict, name: str) -> dict | None:
    return page.get("properties", {}).get(name)


def _prop_text(page: dict, name: str) -> str:
    p = _prop(page, name) or {}
    if p.get("type") == "title":
        return _rich_to_plain(p.get("title", []))
    if p.get("type") == "rich_text":
        return _rich_to_plain(p.get("rich_text", []))
    return ""


def _prop_select(page: dict, name: str) -> str:
    sel = (_prop(page, name) or {}).get("select") or {}
    return sel.get("name", "")


def _prop_number(page: dict, name: str) -> float | None:
    return (_prop(page, name) or {}).get("number")


def _prop_date(page: dict, name: str) -> str:
    d = (_prop(page, name) or {}).get("date") or {}
    return d.get("start") or ""


def _prop_checkbox(page: dict, name: str) -> bool:
    return bool((_prop(page, name) or {}).get("checkbox"))


def _prop_url(page: dict, name: str) -> str:
    return (_prop(page, name) or {}).get("url") or ""


# --- helpers ------------------------------------------------------------------

def _yaml_str(value: str) -> str:
    escaped = (value or "").replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def _prune_stale(out_dir: Path, keep: set[str]) -> None:
    for path in out_dir.glob("*.mdx"):
        if path.stem not in keep:
            log.info("removing stale %s", path.name)
            path.unlink()


if __name__ == "__main__":
    sys.exit(main())
