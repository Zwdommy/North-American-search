# 强语义索引构建脚本

## 作用

对 `papers/` 下所有有 `file_path` 的 PDF 做**语义碎片化**：提取正文（带页码），调用大模型生成「从一点到一棵树」的结构化索引，每个节点可定位到原文页码，保存为 `papers/{paper_id}_index.json`。论文详情页会加载该文件并以「思维树」形式展示。

## 环境

- Python 3.9+
- 依赖：`pip install -r scripts/requirements.txt`（PyMuPDF、requests）

## 运行

1. 设置 Moonshot API Key（与前端 ai.js 使用同一密钥）：
   - Windows: `set MOONSHOT_API_KEY=你的密钥`
   - Linux/macOS: `export MOONSHOT_API_KEY=你的密钥`
2. 在**项目根目录**执行：
   ```bash
   python scripts/build_semantic_index.py
   ```
   脚本会读取 `papers/metadata.json`，对其中每条有 `file_path` 的论文依次提取 PDF 正文、调用大模型、写入 `papers/{id}_index.json`。

## 可选环境变量

- `MOONSHOT_API_BASE`：默认 `https://api.moonshot.cn/v1`
- `MOONSHOT_MODEL`：默认 `kimi-k2-turbo-preview`

## 数据结构

见项目根目录下 `docs/SEMANTIC_INDEX_SCHEMA.md`。
