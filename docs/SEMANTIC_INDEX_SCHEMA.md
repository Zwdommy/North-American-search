# 强语义索引 (Semantic Index) 数据结构

## 目标

- 对每篇 PDF 做**语义碎片化**：把长文分而治之，拆成「从一点到一棵树」的逻辑链路。
- 为每个**事实点**打上高精度标签，并**可定位到原文位置**（页码）。
- 前端以「思维树 / 脑图」展示，用户能清楚自己读了什么、证据从哪来。

## 索引文件

- 路径：`papers/{paperId}_index.json`
- 仅当存在该文件时，论文详情页才展示「思维树」并支持按节点定位到 PDF 页码。

## 根结构

```json
{
  "paperId": "attention_is_all_you_need",
  "title": "Attention Is All You Need",
  "builtAt": "2025-01-29T12:00:00Z",
  "tree": { ... }
}
```

| 字段       | 类型   | 说明 |
|------------|--------|------|
| paperId    | string | 与 metadata.json 中 id 一致 |
| title      | string | 论文标题（冗余便于展示） |
| builtAt    | string | ISO 时间，索引生成时间 |
| tree       | object | 根节点，见下文 Node |

## 节点 (Node)

每个节点对应语义上的一个块（章节 / 小节 / 事实点），且**必须能定位到原文**。

```json
{
  "id": "intro",
  "label": "Introduction",
  "content": "Brief summary or key fact of this block.",
  "position": { "page": 1, "quote": "optional exact excerpt from PDF" },
  "children": [ ... ]
}
```

| 字段      | 类型   | 必填 | 说明 |
|-----------|--------|------|------|
| id        | string | 是   | 唯一标识，同篇内不重复 |
| label     | string | 是   | 高精度标签（章节名 / 事实点简述） |
| content   | string | 否   | 简短概括或关键句，供脑图展示 |
| position  | object | 否*  | 原文定位；叶子节点强烈建议有 |
| position.page | number | 是** | 页码，从 1 开始 |
| position.quote | string | 否   | 原文摘录，便于核对 |
| children  | array  | 是   | 子节点列表，可为 [] |

\* 根节点可无 position；其余节点建议有，至少含 page。  
\** 有 position 时必含 page，用于「打开 PDF 并跳转到第 N 页」。

## 树的设计原则

1. **分而治之**：长文先按章节拆，再按小节 / 事实点拆，形成多级树。
2. **叶子即证据点**：叶子节点对应可引用的最小语义单元，必须带 `position.page`，便于「证据来自第 X 页」。
3. **标签高精度**：label 一眼能看出该点讲什么（如「Self-attention 公式」「BLEU 结果」），便于检索与脑图浏览。

## 前端使用

- 论文详情页请求 `papers/{id}_index.json`，若存在则渲染思维树（可折叠）。
- 每个节点若有 `position.page`，展示「第 N 页」链接，点击打开 PDF 并尽量跳转到该页（如 `pdf#page=N` 或新开 PDF 时带参数，视浏览器/插件而定）。
- 检索或 Skills 引用某篇论文时，可展示对应树节点与页码，实现「证据可溯源」。
