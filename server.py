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

# 确保papers目录存在
PAPERS_DIR.mkdir(exist_ok=True)


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
        
        # 生成paper_id和文件名
        paper_id = generate_paper_id(file.filename)
        pdf_filename = f"{paper_id}.pdf"
        pdf_path = PAPERS_DIR / pdf_filename
        
        # 保存PDF文件
        file.save(str(pdf_path))
        
        # 提取PDF基本信息（标题等）
        # 这里简化处理，使用文件名作为标题
        title = Path(file.filename).stem
        
        # 读取metadata.json
        if METADATA_PATH.exists():
            with open(METADATA_PATH, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
        else:
            metadata = {"papers": []}
        
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
        
        # 添加到metadata
        metadata["papers"].append(new_paper)
        
        # 保存metadata.json
        with open(METADATA_PATH, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
        
        # 生成语义索引
        api_key = os.environ.get("MOONSHOT_API_KEY", "").strip()
        if not api_key:
            return jsonify({
                'error': '未设置MOONSHOT_API_KEY环境变量',
                'paperId': paper_id,
                'pdfSaved': True,
                'metadataUpdated': True
            }), 500
        
        try:
            # 提取PDF文本
            pages = extract_text_by_page(pdf_path)
            if not pages:
                return jsonify({
                    'error': '无法从PDF提取文本',
                    'paperId': paper_id,
                    'pdfSaved': True,
                    'metadataUpdated': True
                }), 500
            
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
                'error': f'索引生成失败: {str(e)}',
                'paperId': paper_id,
                'pdfSaved': True,
                'metadataUpdated': True,
                'indexGenerated': False
            }), 500
        
    except Exception as e:
        return jsonify({'error': f'处理失败: {str(e)}'}), 500


if __name__ == '__main__':
    print("PDF上传服务器启动中...")
    print(f"Papers目录: {PAPERS_DIR}")
    print(f"Metadata文件: {METADATA_PATH}")
    print("\n请确保已设置环境变量 MOONSHOT_API_KEY")
    print("服务器将在 http://localhost:5000 启动\n")
    app.run(debug=True, port=5000)
