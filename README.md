# Thread — AI-Powered Academic Search for AI Research

面向北美地区的新一代学术检索系统：**AI 驱动的 Claim-First 检索**，专注于 AI/ML 领域，用自然语言问题搜索，先看关键主张与证据，再选论文。

## ✨ 核心功能

- **AI 生成 Field Snapshot**：基于检索结果自动生成领域速览
- **语义检索**：智能匹配相关论文，不依赖精确关键词
- **Skills 面板**：
  - **Student 模式**：论文大纲生成、概念解释、论文对比
  - **Researcher 模式**：科研 gap 发现、前沿趋势追踪、论文对比
- **双模式切换**：针对学生和研究人员的不同需求

## 🚀 运行方式

纯静态页面，需要本地 HTTP 服务器（因为需要加载 `papers/metadata.json`）：

```bash
# 在项目根目录执行
python -m http.server 8765
```

浏览器访问：`http://localhost:8765/index.html`

## 📁 文件结构

```
├── index.html              # 首页：模式切换、搜索框、AI领域示例
├── results.html            # 结果页：AI生成Overview、Claims、Papers、Skills面板
├── paper.html              # 论文详情：从metadata.json加载
├── papers/
│   └── metadata.json       # 13篇经典AI论文的元数据
├── assets/
│   ├── css/style.css       # 统一样式（含Skills面板样式）
│   └── js/ai.js            # AI服务模块（OpenAI API调用）
├── 制作心得.md
└── README.md
```

## 🔄 核心流程

1. **首页**：
   - 选择模式（Student / Researcher）
   - 输入 AI 研究问题或点击示例（如 "How do transformers work?"）
   - 跳转结果页

2. **结果页**：
   - **Field Snapshot**：AI 自动生成领域速览（基于检索到的论文）
   - **Key Claims**：从论文中提取的主张，标注证据强度
   - **Papers**：语义检索匹配的相关论文列表
   - **Skills 按钮**：打开侧边栏，使用 AI 辅助功能

3. **论文详情**：
   - 从 `papers/metadata.json` 加载完整信息
   - 摘要、Key claims、BibTeX 引用格式
   - 「Back to results」返回当前检索（保留 query 和 mode）

## 🤖 AI 功能说明

### Field Snapshot（领域速览）
- 自动分析检索到的论文，生成 2-3 句领域总结
- 使用 OpenAI GPT-4o-mini 生成

### Skills 功能

**Student 模式**：
- 📝 **Generate Paper Outline**：基于检索结果生成论文大纲
- 💡 **Explain Core Concepts**：解释核心概念（适合学生理解）
- ⚖️ **Compare Papers**：对比多篇论文的异同

**Researcher 模式**：
- 🔍 **Identify Research Gaps**：识别科研空白和未探索方向
- 📈 **Track Latest Trends**：追踪最新趋势和突破
- ⚖️ **Compare Papers**：对比论文

## 📊 论文数据

当前包含 **13 篇经典 AI 论文**的元数据：
- Transformer、BERT、GPT-3、Vision Transformer
- ChatGPT/RLHF、ResNet、AlphaGo
- CLIP、Diffusion Models、LLaMA、Stable Diffusion、Gemini、MoE

所有论文信息存储在 `papers/metadata.json`，包括：
- 标题、作者、年份、venue
- 摘要、关键词、分类
- 提取的 Key Claims
- 引用数（示例）

## ⚠️ 注意事项

- **API Key 暴露**：当前 API key 在前端代码中，仅用于演示/作业。生产环境应使用后端代理。
- **论文 PDF**：`metadata.json` 中的 `file_path` 为占位路径，实际 PDF 文件需要单独下载。
- **AI 调用**：所有 AI 功能需要网络连接和有效的 OpenAI API key。

## 🎯 使用示例

1. 访问首页，选择 **Student** 模式
2. 输入："How do transformers work in language models?"
3. 查看 AI 生成的 Field Snapshot
4. 点击 **Skills** 按钮 → 选择 "Explain Core Concepts"
5. 查看 AI 生成的概念解释
6. 点击论文卡片查看详情

更完整的产品思考与竞品分析见 **制作心得.md**。
