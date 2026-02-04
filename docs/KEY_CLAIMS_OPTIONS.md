# Key Claims 生成方案（基于问题 + 结构化数据）

---

## 一、Key Claims 是什么？一句话说明

**Key Claims = 根据你搜的问题，AI 从「当前检索到的论文」里提炼出的、和问题直接相关的、可验证的结论句。**

- 不是论文里写死的固定句子，而是**每次搜索后由 AI 现场生成**的。
- 每条 claim 都会标明**来自哪篇论文**，有语义索引时还会带上**页码**，方便你点进 PDF 对证。

---

## 二、什么时候会生成 Key Claims？

1. 你在 **results 页** 输入问题并点击搜索。
2. 系统先用语义搜索得到一批**最相关的论文**（`matchedPapers`）。
3. 紧接着就会在「Key claims」区域显示「Generating key claims from question and papers...」，然后**针对这批论文**生成 Key Claims。

也就是说：**先有「问题 + 检索结果」，再根据这两样生成 Key Claims。**

---

## 三、用到的数据从哪来？

| 数据 | 来源 | 用途 |
|------|------|------|
| 用户问题 `q` | 搜索框 | 让 AI 只提炼和问题相关的 claim |
| 论文列表 | 语义搜索得到的 **top 5** 篇 | 只从这 5 篇里抽 claim，最多共 6 条 |
| 论文摘要 | `papers/metadata.json` 里每篇的 `abstract` | 没有索引时，用「问题 + 摘要」让 AI 生成 claim |
| 语义索引 | `papers/{论文id}_index.json`（可选） | 有的话用「问题 + 索引树」生成，并能带出页码 |

---

## 四、具体逻辑（分步、好懂版）

### 第 1 步：前端准备「索引数据」

- 对 **top 5 篇论文**，并行请求：  
  `papers/论文id_index.json`  
- 能拿到的就放进 `indexByPaperId[论文id]`，拿不到（404 或没建索引）就是 `null`。  
- 这样每篇论文要么「有索引」，要么「无索引」。

### 第 2 步：对每篇论文调用 AI，生成 1～2 条 claim

对 top 5 篇**逐篇**调用 `extractClaimsForPaper(问题, 论文, 索引数据)`：

- **有索引时（有 `papers/xxx_index.json`）**  
  - 把该论文的**语义索引树**拉平成一段带标题、小结和页码的文本（`flattenIndexTree`）。  
  - 把「用户问题 + 这段结构化摘要」发给 LLM，要求：  
    - 给出 1～2 条与问题直接相关的、可验证的 claim；  
    - 每条末尾可带 `(Page N)` 标明页码。  
  - 解析 LLM 返回的每一行，抽出 `claim` 和可选的 `page`，得到 `[{ claim, page? }]`。

- **无索引时**  
  - 只把「用户问题 + 该论文的 title + abstract」发给 LLM。  
  - 同样要求 1～2 条 claim，但**不要求**也**不解析**页码，得到 `[{ claim, page: undefined }]`。

### 第 3 步：汇总并限制条数

- 把 5 篇论文各自返回的 claim 列表**按顺序拼在一起**。
- **最多只取前 6 条**（`results.slice(0, 6)`），所以通常不会满屏都是 claim。

### 第 4 步：在页面上怎么展示

- 每条 claim 一张卡片，包含：  
  - 文案：AI 生成的 **claim 句子**；  
  - 来源：**作者 et al., 年份**，点进去是该论文的 paper 详情页；  
  - 若有页码：显示 **「Page N」** 链接，点开即该论文 PDF 的第 N 页；  
  - 徽章：**「AI · question + papers」** 表示这是根据「问题 + 论文」生成的。

---

## 五、小结（记这三点就够）

1. **Key Claims = 问题 + 当前检索到的 top 5 篇论文 → AI 提炼出的结论句**，每条都标出来自哪篇论文。  
2. **有语义索引就用「问题 + 索引树」生成，并带页码；没有索引就用「问题 + 摘要」生成，不带页码。**  
3. **最多展示 6 条**，按论文顺序从第 1 篇到第 5 篇依次取，取满 6 条就停。

---

## 六、技术方案对比（原文档）

目标：Key claims 由 **AI 真实生成**，且基于 **用户问题** 和 **结构化数据**（语义索引树），可追溯到原文页码。

---

## 方案一：按问题 + 单篇索引逐篇生成

- **流程**：对每条入选论文，若存在 `papers/{id}_index.json`，则拉平树（label + content + page），与**问题**一起发给 LLM，要求生成 1–2 条与问题直接相关、可追溯到页码的 claim。
- **返回**：`[{ claim, paperId, page }]`，前端按论文聚合展示。
- **优点**：每条 claim 可精确定位到节点/页码，证据可溯源。  
- **缺点**：N 篇论文 N 次调用，延迟与成本较高。

---

## 方案二：问题 + 多篇索引一次合成

- **流程**：对 top-k 篇论文加载索引，将多篇的「与问题相关」树片段拼成一份上下文，**一次**请求让 LLM 生成 4–6 条 key claims，每条带 paperId + page。
- **优点**：单次调用、可做跨篇对比与去重。  
- **缺点**：上下文长、可能截断；输出需解析为结构化（如 JSON）。

---

## 方案三：问题 + 摘要/索引混合（推荐，已实现）

- **流程**：  
  - 对每条入选论文：若有 `papers/{id}_index.json`，用 **问题 + 该篇拉平树** 生成带 page 的 claims；若无索引，用 **问题 + abstract** 生成 claims（不带 page）。  
  - 前端先展示 loading，并发或顺序请求各篇，汇总后按相关性展示最多 6 条。
- **优点**：兼容有/无索引；claim 与问题强相关；有索引时可溯源到页码。  
- **缺点**：多篇时多次调用（可限制为 top 3–5 篇以控制成本）。

---

## 方案四：先选「最相关片段」再生成 claim

- **流程**：用问题对每篇的索引节点做一次匹配（关键词或简单相似度）筛出 top 节点，只把这些片段 + 问题发给 LLM 生成 1 条 claim + page。
- **优点**：上下文更短、更聚焦，单次生成质量高。  
- **缺点**：需实现「片段检索」逻辑（可后续用向量检索增强）。

---

## 实现说明（方案三，已实现）

- **ai.js**  
  - `flattenIndexTree(node)`：将语义索引树拉平为文本（label、content、page）。  
  - `extractClaimsForPaper(query, paper, indexData)`：单篇生成 1–3 条 claim；有 index 时用「问题 + 拉平树」，要求 LLM 直接返回 **严格 JSON**：`[{ claim: string, page: number | null }]`，前端用 `page` 字段作为可靠页码；无 index 时用「问题 + abstract」生成 claims（不带页码）。  
  - `generateKeyClaimsForQuery(query, papers, indexByPaperId)`：对 top 5 篇依次调用 `extractClaimsForPaper`，汇总为最多 6 条，返回 `[{ claim, paper, page? }]`。
- **results.html**  
  - `displayClaims()` 改为 async：先显示「Generating key claims from question and papers...」；并行请求 `papers/{id}_index.json` 得到 `indexByPaperId`；调用 `AIService.generateKeyClaimsForQuery(q, matchedPapers, indexByPaperId)`；渲染卡片，有 `page` 时显示「Page N」链接到 PDF 对应页。
- **样式**：`.claim-page-link` 用于「Page N」链接；徽章文案为「AI · question + papers」。
