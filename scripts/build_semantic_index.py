#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
强语义索引构建脚本：
1. 从 papers/metadata.json 读取论文列表
2. 对每篇有 file_path 的 PDF 提取带页码的正文
3. 调用大模型做语义碎片化，生成「从一点到一棵树」的结构化数据
4. 每个节点带可定位到原文的 position（至少 page）
5. 保存为 papers/{paper_id}_index.json
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

# 项目根目录（脚本在 scripts/ 下）
ROOT = Path(__file__).resolve().parent.parent
PAPERS_DIR = ROOT / "papers"
METADATA_PATH = PAPERS_DIR / "metadata.json"

# 单篇 PDF 最多送入的字符数（留足空间给 prompt + 输出）
MAX_TEXT_CHARS = 52000
# 最多处理页数
MAX_PAGES = 60

# Moonshot API（与前端 ai.js 一致）
MOONSHOT_BASE = os.environ.get("MOONSHOT_API_BASE", "https://api.moonshot.cn/v1")
MOONSHOT_MODEL = os.environ.get("MOONSHOT_MODEL", "kimi-k2-turbo-preview")


def extract_text_by_page(pdf_path: Path) -> list[tuple[int, str]]:
    """提取 PDF 每页正文，返回 [(page_num, text), ...]，page_num 从 1 开始。"""
    try:
        import fitz
    except ImportError:
        raise SystemExit("请先安装 PyMuPDF: pip install pymupdf")

    doc = fitz.open(pdf_path)
    out = []
    for i in range(min(len(doc), MAX_PAGES)):
        page = doc[i]
        text = page.get_text().strip()
        out.append((i + 1, text))
    doc.close()
    return out


def build_paged_text(pages: list[tuple[int, str]], max_chars: int = MAX_TEXT_CHARS) -> str:
    """组装带页码标记的正文，总长不超过 max_chars。"""
    buf = []
    total = 0
    for num, text in pages:
        block = f"--- Page {num} ---\n{text}\n"
        if total + len(block) > max_chars:
            # 截断当前页内容以不超出
            remain = max_chars - total - len(f"--- Page {num} ---\n\n") - 20
            if remain > 0:
                buf.append(f"--- Page {num} ---\n{text[:remain]}...\n")
            break
        buf.append(block)
        total += len(block)
    return "".join(buf)


def call_moonshot(prompt: str, system: str, api_key: str) -> str:
    """调用 Moonshot 聊天接口，返回 content。"""
    import requests

    url = f"{MOONSHOT_BASE.rstrip('/')}/chat/completions"
    payload = {
        "model": MOONSHOT_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.3,
        "max_tokens": 4000,
    }
    resp = requests.post(
        url,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        json=payload,
        timeout=120,
    )
    resp.raise_for_status()
    data = resp.json()
    return (data.get("choices") or [{}])[0].get("message", {}).get("content", "")


def parse_tree_from_response(raw: str, paper_id: str, title: str) -> dict:
    """从模型回复中解析出 tree 根节点；回复应为纯 JSON 或 ```json ... ```。"""
    raw = raw.strip()
    # 去掉可能的 markdown 代码块
    m = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
    if m:
        raw = m.group(1).strip()
    try:
        node = json.loads(raw)
    except json.JSONDecodeError:
        # 尝试只取第一个 { ... } 或 [ ... ] 的顶层对象
        for pattern in (r"\{[\s\S]*\}", r"\[\s*\{[\s\S]*\}\s*\]"):
            m = re.search(pattern, raw)
            if m:
                try:
                    node = json.loads(m.group(0))
                    if isinstance(node, list) and len(node) == 1:
                        node = node[0]
                    break
                except json.JSONDecodeError:
                    continue
        else:
            raise ValueError("无法从模型回复中解析 JSON")

    # 确保根节点有 id/label/children
    if "id" not in node:
        node["id"] = "root"
    if "label" not in node:
        node["label"] = title
    if "children" not in node:
        node["children"] = []
    return node


def generate_semantic_tree(paper_id: str, title: str, paged_text: str, api_key: str) -> dict:
    """Call LLM to generate semantic tree (root node). Output must be in English."""
    system = """You are an academic paper structuring assistant. Your task is to semantically fragment a paper's body into a tree:
1. Break the long text into a logical tree: first by major sections, then by subsections or fact points.
2. Give each node a precise label (in English) so readers know at a glance what it covers.
3. Each node must be locatable in the source: include position with at least "page" (1-based). Optionally add "quote" for a short excerpt from that page.
4. Output only one JSON object, the root of the tree. Root id is "root", label is the paper title, position can be null. Root's children are top-level sections; each section can have children for subsections or fact points.
5. Leaf nodes (no children or empty children) must have position.page.
6. Output all labels and content in English. Do not output any explanation, only the JSON object."""

    prompt = f"""Paper title: {title}

Below is the body with page markers (--- Page N --- means page N):

{paged_text}

Output the root node of the semantic tree as JSON. All labels and content must be in English. Example format:
{{
  "id": "root",
  "label": "Paper Title",
  "content": null,
  "position": null,
  "children": [
    {{
      "id": "sec1",
      "label": "Introduction",
      "content": "Brief summary or key sentence",
      "position": {{ "page": 1 }},
      "children": [
        {{
          "id": "sec1-1",
          "label": "Background",
          "content": "...",
          "position": {{ "page": 1, "quote": "optional excerpt" }},
          "children": []
        }}
      ]
    }}
  ]
}}
"""

    content = call_moonshot(prompt, system, api_key)
    return parse_tree_from_response(content, paper_id, title)


def build_index_for_paper(paper: dict, api_key: str) -> dict | None:
    """为单篇论文构建索引；无 PDF 或失败则返回 None。"""
    paper_id = paper.get("id")
    title = paper.get("title") or "Untitled"
    file_path = paper.get("file_path")
    if not file_path or not paper_id:
        return None

    pdf_path = ROOT / file_path.replace("/", os.sep)
    if not pdf_path.is_file():
        print(f"  [skip] PDF 不存在: {pdf_path}")
        return None

    print(f"  [extract] {pdf_path.name}")
    pages = extract_text_by_page(pdf_path)
    if not pages:
        print(f"  [skip] 无法提取正文")
        return None

    paged_text = build_paged_text(pages)
    print(f"  [llm] 正文共 {len(pages)} 页, {len(paged_text)} 字符")
    tree = generate_semantic_tree(paper_id, title, paged_text, api_key)

    from datetime import datetime, timezone
    return {
        "paperId": paper_id,
        "title": title,
        "builtAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "tree": tree,
    }


def main() -> None:
    api_key = os.environ.get("MOONSHOT_API_KEY", "").strip()
    if not api_key:
        print("请设置环境变量 MOONSHOT_API_KEY")
        sys.exit(1)

    if not METADATA_PATH.is_file():
        print(f"未找到 {METADATA_PATH}")
        sys.exit(1)

    with open(METADATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    papers = data.get("papers") or []
    print(f"共 {len(papers)} 篇论文")

    for paper in papers:
        pid = paper.get("id", "?")
        print(f"\n[{pid}]")
        try:
            index_data = build_index_for_paper(paper, api_key)
            if index_data is None:
                continue
            out_path = PAPERS_DIR / f"{index_data['paperId']}_index.json"
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(index_data, f, ensure_ascii=False, indent=2)
            print(f"  [ok] 已写入 {out_path.name}")
        except Exception as e:
            print(f"  [error] {e}")
            raise

    print("\n完成。")


if __name__ == "__main__":
    main()
