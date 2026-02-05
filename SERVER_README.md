# PDF上传服务器使用说明

## 功能

这个服务器处理PDF上传，自动：
1. 保存PDF文件到 `papers/` 目录
2. 更新 `papers/metadata.json`，添加新论文的元数据
3. 使用项目中的 `build_semantic_index.py` 逻辑生成结构化索引JSON（`papers/{paper_id}_index.json`）

## 安装依赖

```bash
pip install -r scripts/requirements.txt
```

这会安装：
- pymupdf（PDF文本提取）
- requests（API调用）
- flask（Web服务器）
- flask-cors（跨域支持）

## 启动服务器

1. 设置 Moonshot API Key（用于生成语义索引）：
   ```bash
   # Windows
   set MOONSHOT_API_KEY=你的密钥
   
   # Linux/macOS
   export MOONSHOT_API_KEY=你的密钥
   ```

2. 在项目根目录运行：
   ```bash
   python server.py
   ```

3. 服务器将在 `http://localhost:5000` 启动

## 使用

1. 确保服务器正在运行
2. 在浏览器中打开 `index.html`
3. 点击搜索框左侧的回形针图标
4. 选择PDF文件上传
5. 系统会自动：
   - 保存PDF到 `papers/` 目录
   - 更新 `metadata.json`
   - 生成结构化索引JSON（如果API Key已设置）

## API端点

### POST /api/upload-pdf

上传PDF文件并处理。

**请求：**
- Content-Type: `multipart/form-data`
- 字段名：`pdf`（文件）

**响应：**
```json
{
  "success": true,
  "paperId": "paper_id",
  "title": "论文标题",
  "pdfSaved": true,
  "metadataUpdated": true,
  "indexGenerated": true,
  "pages": 10
}
```

如果索引生成失败（例如未设置API Key），响应会包含：
```json
{
  "error": "错误信息",
  "paperId": "paper_id",
  "pdfSaved": true,
  "metadataUpdated": true,
  "indexGenerated": false
}
```

## 注意事项

- PDF文件会保存为 `papers/{paper_id}.pdf`
- `paper_id` 从文件名自动生成（小写、下划线分隔）
- 如果文件名已存在，会自动添加随机后缀
- 索引JSON保存在 `papers/{paper_id}_index.json`
- 如果未设置 `MOONSHOT_API_KEY`，PDF仍会保存，但不会生成索引

## OpenClaw（本机操控桥接）

浏览器页面无法直接操控你的电脑（安全限制）。因此项目通过本地 `server.py` 提供一个桥接 API，让前端把“指令”发送给 OpenClaw，由 OpenClaw 在本机执行。

### GET /api/openclaw/health

用于前端检测 OpenClaw bridge 是否可用。

### POST /api/openclaw/run

执行一条 OpenClaw 指令。

**请求：**

```json
{
  "instruction": "open file explorer and open Downloads"
}
```

**响应：**

```json
{
  "success": true,
  "returnCode": 0,
  "stdout": "...",
  "stderr": ""
}
```

### OpenClaw 命令配置

不同 OpenClaw 安装方式的 CLI 参数可能不同。你可以通过环境变量指定命令：

```bash
# Windows 示例
set OPENCLAW_CMD=%APPDATA%\npm\openclaw.cmd
set OPENCLAW_ARGS=--json
python server.py
```

如果你的 OpenClaw 不是通过 CLI 调用，需要把 `server.py` 的 `/api/openclaw/run` 逻辑改成适配你本机的 OpenClaw 调用方式（例如 Python 包调用或本地 RPC）。
