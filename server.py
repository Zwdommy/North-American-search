#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PDF上传和处理服务器
处理PDF上传，保存到papers目录，并生成结构化索引JSON
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
import uuid
import subprocess
import shlex
import shutil
from pathlib import Path
from datetime import datetime

# 导入项目中的索引构建逻辑
import sys
scripts_dir = Path(__file__).parent / 'scripts'
sys.path.insert(0, str(scripts_dir))

# 直接导入函数
import importlib.util
spec = importlib.util.spec_from_file_location("build_semantic_index", scripts_dir / "build_semantic_index.py")
build_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build_module)

extract_text_by_page = build_module.extract_text_by_page
build_paged_text = build_module.build_paged_text
generate_semantic_tree = build_module.generate_semantic_tree

app = Flask(__name__)
# 允许跨域请求，允许所有来源
CORS(app, resources={r"/api/*": {"origins": "*"}})

ROOT = Path(__file__).resolve().parent
PAPERS_DIR = ROOT / "papers"
METADATA_PATH = PAPERS_DIR / "metadata.json"

# 后端专用的 Moonshot API Key（与前端保持一致）
BACKEND_MOONSHOT_API_KEY = "sk-TgNhX6rZAu9e8oMSr04VqyHwY75NmwmMhOXkvX3pUy081bmk"

# 确保papers目录存在
PAPERS_DIR.mkdir(exist_ok=True)


def get_moonshot_api_key() -> str:
    """
    获取用于语义索引的 Moonshot API Key。
    """
    # 1. 如果显式设置了环境变量，优先用环境变量（方便以后切换）
    key = os.environ.get("MOONSHOT_API_KEY") or os.environ.get("OPENAI_API_KEY")
    if key:
        return key.strip()
    # 2. 否则直接使用项目内约定的后端 Key
    return BACKEND_MOONSHOT_API_KEY.strip()


def generate_paper_id(filename: str) -> str:
    """从文件名生成paper_id"""
    # 移除扩展名，转换为小写，替换空格和特殊字符为下划线
    base = Path(filename).stem.lower()
    base = base.replace(' ', '_').replace('-', '_')
    # 移除特殊字符，只保留字母数字和下划线
    base = ''.join(c if c.isalnum() or c == '_' else '_' for c in base)
    # 如果已存在，添加随机后缀
    if (PAPERS_DIR / f"{base}.pdf").exists():
        base = f"{base}_{uuid.uuid4().hex[:8]}"
    return base


@app.route('/api/health', methods=['GET'])
def health():
    """健康检查端点"""
    return jsonify({
        'status': 'ok',
        'message': 'PDF上传服务器运行正常'
    })


@app.route('/api/upload-pdf', methods=['POST'])
def upload_pdf():
    """处理PDF上传"""
    try:
        if 'pdf' not in request.files:
            return jsonify({'error': '没有上传文件'}), 400
        
        file = request.files['pdf']
        if file.filename == '':
            return jsonify({'error': '文件名为空'}), 400
        
        if not file.filename.lower().endswith('.pdf'):
            return jsonify({'error': '只支持PDF文件'}), 400
        
        # 提取PDF基本信息（标题等）
        # 这里简化处理，使用文件名作为标题
        title = Path(file.filename).stem
        title_norm = title.strip().lower()

        # 读取metadata.json（容错）
        try:
            if METADATA_PATH.exists():
                with open(METADATA_PATH, 'r', encoding='utf-8') as f:
                    metadata = json.load(f)
            else:
                metadata = {"papers": []}
        except Exception:
            metadata = {"papers": []}

        # 去重：如果同名论文已存在，则重用其 id，不再往 metadata 里追加新条目
        existing_paper = None
        for p in metadata.get("papers", []):
            p_title = (p.get("title") or "").strip().lower()
            if p_title and p_title == title_norm:
                existing_paper = p
                break

        if existing_paper:
            paper_id = existing_paper.get("id")
            if not paper_id:
                # 保险：如果旧条目没有 id，就退回到新 id 逻辑
                paper_id = generate_paper_id(file.filename)
                existing_paper["id"] = paper_id
            pdf_filename = f"{paper_id}.pdf"
            pdf_path = PAPERS_DIR / pdf_filename
            # 覆盖保存 PDF（认为是同一篇的更新版）
            file.save(str(pdf_path))
        else:
            # 生成新的 paper_id 和文件名
            paper_id = generate_paper_id(file.filename)
            pdf_filename = f"{paper_id}.pdf"
            pdf_path = PAPERS_DIR / pdf_filename
            # 保存PDF文件
            file.save(str(pdf_path))

            # 创建新的paper条目
            new_paper = {
                "id": paper_id,
                "title": title,
                "authors": [],
                "year": datetime.now().year,
                "venue": "Uploaded",
                "category": "general",
                "keywords": [],
                "abstract": "",
                "claims": [],
                "citation_count": 0,
                "file_path": f"papers/{pdf_filename}"
            }
            metadata.setdefault("papers", []).append(new_paper)

        # 保存metadata.json（不论是否新增，都写回，保证结构统一）
        with open(METADATA_PATH, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
        
        # 生成语义索引
        api_key = get_moonshot_api_key()
        if not api_key:
            # 不中断：返回成功，但提醒未生成索引
            return jsonify({
                'success': True,
                'paperId': paper_id,
                'title': title,
                'pdfSaved': True,
                'metadataUpdated': True,
                'indexGenerated': False,
                'pages': None,
                'error': '未设置MOONSHOT_API_KEY环境变量（PDF已保存，索引未生成）'
            })
        
        try:
            # 提取PDF文本
            pages = extract_text_by_page(pdf_path)
            if not pages:
                return jsonify({
                    'success': True,
                    'error': '无法从PDF提取文本（PDF已保存，索引未生成）',
                    'paperId': paper_id,
                    'title': title,
                    'pdfSaved': True,
                    'metadataUpdated': True,
                    'indexGenerated': False
                })
            
            # 构建分页文本
            paged_text = build_paged_text(pages)
            
            # 生成语义树
            tree = generate_semantic_tree(paper_id, title, paged_text, api_key)
            
            # 保存索引JSON
            index_data = {
                "paperId": paper_id,
                "title": title,
                "builtAt": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
                "tree": tree,
            }
            
            index_path = PAPERS_DIR / f"{paper_id}_index.json"
            with open(index_path, 'w', encoding='utf-8') as f:
                json.dump(index_data, f, ensure_ascii=False, indent=2)
            
            return jsonify({
                'success': True,
                'paperId': paper_id,
                'title': title,
                'pdfSaved': True,
                'metadataUpdated': True,
                'indexGenerated': True,
                'pages': len(pages)
            })
            
        except Exception as e:
            # PDF已保存，但索引生成失败
            return jsonify({
                'success': True,
                'error': f'索引生成失败: {str(e)}（PDF已保存，索引未生成）',
                'paperId': paper_id,
                'title': title,
                'pdfSaved': True,
                'metadataUpdated': True,
                'indexGenerated': False
            })
        
    except Exception as e:
        return jsonify({'error': f'处理失败: {str(e)}'}), 500


@app.route('/api/openclaw/health', methods=['GET'])
def openclaw_health():
    """OpenClaw 健康检查端点（用于前端探测是否可用）"""
    return jsonify({
        'status': 'ok',
        'message': 'OpenClaw bridge is running',
    })


def _resolve_openclaw_cmd() -> str:
    """解析 OpenClaw CLI 可执行文件路径。"""
    # 1) 显式指定
    env_cmd = os.environ.get("OPENCLAW_CMD", "").strip()
    if env_cmd:
        return env_cmd

    # 2) PATH 查找（通常 npm 全局安装的 openclaw.cmd 会在这里）
    found = shutil.which("openclaw")
    if found:
        return found

    # 3) 常见的 npm 全局目录（Windows）
    appdata = os.environ.get("APPDATA", "").strip()
    if appdata:
        npm_bin = Path(appdata) / "npm"
        for name in ("openclaw.cmd", "openclaw.ps1", "openclaw.exe", "openclaw"):
            candidate = npm_bin / name
            if candidate.exists():
                return str(candidate)

    return ""


def run_openclaw_command(instruction: str) -> dict:
    """调用真正的 OpenClaw agent 服务（通过 openclaw CLI）。

    等价于在终端里执行：
        openclaw agent --message "<instruction>"

    前置条件：
    - @anthropic-ai/openclaw 已安装（npm 全局或本地）
    - 已完成 onboard / gateway 等官方初始化步骤
    """
    cmd = _resolve_openclaw_cmd()
    if not cmd:
        return {
            "success": False,
            "returnCode": -1,
            "stdout": "",
            "stderr": (
                "OpenClaw CLI not found. "
                "Please install it with `npm install -g @anthropic-ai/openclaw` "
                "or set OPENCLAW_CMD to the full path."
            ),
        }

    # 允许通过环境变量追加额外参数（比如 --local 或自定义 agent）
    # 如果未指定，则默认使用 main agent，以匹配你现在的配置（见 `openclaw agents` 输出）。
    extra_raw = os.environ.get("OPENCLAW_AGENT_ARGS")
    if extra_raw is None or not extra_raw.strip():
        extra_raw = "--agent main"
    extra_args = shlex.split(extra_raw, posix=(os.name != "nt")) if extra_raw else []

    args = [cmd, "agent", "--message", instruction]
    # 如果你希望默认使用本地模式，可以在环境变量里加：OPENCLAW_AGENT_ARGS="--local"
    if extra_args:
        args.extend(extra_args)

    try:
        result = subprocess.run(
            args,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=120,
            check=False,
        )
        return {
            "success": result.returncode == 0,
            "returnCode": result.returncode,
            "stdout": (result.stdout or "").strip(),
            "stderr": (result.stderr or "").strip(),
        }
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "returnCode": -1,
            "stdout": "",
            "stderr": "OpenClaw agent timed out after 120 seconds",
        }
    except Exception as exc:
        return {
            "success": False,
            "returnCode": -1,
            "stdout": "",
            "stderr": f"Error invoking OpenClaw: {exc}",
        }


@app.route('/api/openclaw/run', methods=['POST'])
def openclaw_run():
    """
    运行 OpenClaw 指令（项目内简化版）。

    前端约定请求体：
        { "instruction": "..." }

    当前实现侧重“可用性”：把指令当作本机系统命令执行，
    行为与 `openclaw_simple_bridge.py` 中的 demo 一致，
    保证不会频繁 500。
    """
    try:
        data = request.get_json(silent=True) or {}
        instruction = (data.get('instruction') or '').strip()
        if not instruction:
            return jsonify({'error': 'Missing instruction'}), 400

        # 实际执行指令
        result = run_openclaw_command(instruction)
        ok = result.get('success', False)
        return jsonify({
            'success': ok,
            'returnCode': result.get('returnCode', -1),
            'stdout': (result.get('stdout') or '').strip(),
            'stderr': (result.get('stderr') or '').strip(),
        }), (200 if ok else 500)

    except Exception as e:
        return jsonify({'error': f'OpenClaw run failed: {str(e)}'}), 500


if __name__ == '__main__':
    print("PDF上传服务器启动中...")
    print(f"Papers目录: {PAPERS_DIR}")
    print(f"Metadata文件: {METADATA_PATH}")
    print("\n请确保已设置环境变量 MOONSHOT_API_KEY")
    print("服务器将在 http://localhost:5000 启动\n")
    app.run(debug=True, port=5000)
