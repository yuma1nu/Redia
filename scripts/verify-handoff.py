"""Check this handoff folder without requiring the original workspace."""
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = (
    "AGENTS.md", "README.md", "START_DEVELOPMENT.md", ".gitignore", ".gitattributes",
    "docs/next-app-spec.md", "docs/next-app-development-plan.md", "docs/DECISIONS.md",
    "docs/PROGRESS.md", "docs/ACCEPTANCE.md", "prototype/README.md",
    "prototype/workspace.fragment.html", "prototype/workspace.html",
    "scripts/check-prototype.cjs", "scripts/verify-handoff.py",
)


class ExternalAssetCheck(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.assets: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        data = dict(attrs)
        if data.get("data-srcdoc"):
            child = ExternalAssetCheck()
            child.feed(data["data-srcdoc"] or "")
            self.assets.extend(child.assets)
        if tag in {"script", "link", "img", "iframe"}:
            source = data.get("src") or data.get("href") or ""
            if source.startswith(("https://", "http://", "//", "file://")):
                self.assets.append(source)


def verify() -> None:
    for name in REQUIRED:
        if not (ROOT / name).is_file():
            raise ValueError(f"Missing required file: {name}")

    markdown = [ROOT / "AGENTS.md", ROOT / "README.md", ROOT / "START_DEVELOPMENT.md"]
    markdown += sorted((ROOT / "docs").glob("*.md"))
    markdown += [ROOT / "prototype/README.md"]
    link_count = 0
    for path in markdown:
        text = path.read_text(encoding="utf-8")
        for raw in re.findall(r"\]\(([^)]+)\)", text):
            if re.match(r"[a-z]+://", raw, re.I) or raw.startswith("#"):
                continue
            target = (path.parent / unquote(raw.split("#", 1)[0])).resolve()
            try:
                target.relative_to(ROOT)
            except ValueError:
                raise ValueError(f"Link escapes project root: {path.name}: {raw}")
            if not target.exists():
                raise ValueError(f"Broken link: {path.name}: {raw}")
            link_count += 1

    expected = [f"A{i:02d}" for i in range(1, 24)]
    for name in ("docs/next-app-spec.md", "docs/ACCEPTANCE.md"):
        ids = re.findall(r"\| (A\d{2}) \|", (ROOT / name).read_text(encoding="utf-8"))
        if ids != expected:
            raise ValueError(f"Acceptance IDs must be A01-A23 exactly once: {name}")

    for name in ("docs/next-app-spec.md", "docs/next-app-development-plan.md"):
        text = (ROOT / name).read_text(encoding="utf-8")
        if "C:/Users/Yuma" in text or "D:/OneDrive" in text:
            raise ValueError(f"Machine-specific documentation path: {name}")
    document = (ROOT / "prototype/workspace.html").read_text(encoding="utf-8")
    if "<!doctype html>" not in document.lower():
        raise ValueError("Standalone prototype is not a complete HTML document")
    assets = ExternalAssetCheck()
    assets.feed(document)
    if assets.assets:
        raise ValueError(f"Prototype requires external assets: {assets.assets}")
    script = (ROOT / "scripts/check-prototype.cjs").read_text(encoding="utf-8")
    if "../prototype/workspace.fragment.html" not in script:
        raise ValueError("Prototype check does not use a project-relative source")
    print(f"PASS: {len(REQUIRED)} required files; {link_count} local links; A01-A23; offline prototype assets.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--with-prototype", action="store_true", help="Also run the Node.js prototype smoke check")
    args = parser.parse_args()
    try:
        verify()
        if args.with_prototype:
            node = shutil.which("node")
            if not node:
                raise ValueError("Node.js is required for --with-prototype")
            subprocess.run([node, str(ROOT / "scripts/check-prototype.cjs")], cwd=ROOT, check=True)
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        print(f"FAIL: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
