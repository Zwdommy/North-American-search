/* eslint-disable no-undef */
// Moonshot (Kimi) API Configuration
// 说明：Moonshot API 与 OpenAI Chat Completions 协议基本兼容，只是 base_url 和 model 不同。
const OPENAI_API_KEY = 'sk-BPCnzrTWbnWMxpPwRFqpFJcSZpniaCuyGSrMg1r5nwTOnxqF';
// 如果你在中国大陆，推荐使用 .cn 域名；如需全球节点可改为 https://api.moonshot.ai/v1/chat/completions
const OPENAI_API_URL = 'https://api.moonshot.cn/v1/chat/completions';

'use strict';

// AI Service Module
const AIService = {
  /**
   * Call OpenAI API
   */
  async callAPI(messages, temperature = 0.7, maxTokens = 1000) {
    try {
      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          // Moonshot 模型，可根据需要切换，如：'moonshot-v1-8k', 'moonshot-v1-32k', 'kimi-k2-turbo-preview' 等
          model: 'kimi-k2-turbo-preview',
          messages: messages,
          temperature: temperature,
          max_tokens: maxTokens
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'API request failed');
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('AI API Error:', error);
      throw error;
    }
  },

  /**
   * Generate Field Snapshot (领域速览)
   */
  async generateFieldSnapshot(query, papers) {
    const papersSummary = papers.slice(0, 5).map(p => {
      const title = p.title || 'Untitled';
      const year = p.year || 'Unknown';
      const abstract = p.abstract || '';
      return `- ${title} (${year}): ${abstract.substring(0, 200)}...`;
    }).join('\n');

    const prompt = `You are an academic research assistant. Based on the following research papers related to the query "${query}", generate a concise 2-3 sentence field snapshot that summarizes:
1. The current state of research in this area
2. Key trends or patterns across the papers
3. Notable findings or gaps

Papers:
${papersSummary}

Generate only the snapshot text, no markdown formatting, no bullet points. Keep it academic but accessible.`;

    try {
      const snapshot = await this.callAPI([
        { role: 'system', content: 'You are a helpful academic research assistant.' },
        { role: 'user', content: prompt }
      ], 0.7, 300);
      return snapshot.trim();
    } catch (error) {
      return `Research in this area shows significant developments. The papers cover various aspects of ${query}, with notable contributions to understanding and advancing the field.`;
    }
  },

  /**
   * Extract Key Claims from papers (if not already extracted)
   */
  async extractClaims(paper) {
    const prompt = `Extract 2-3 key claims or findings from this research paper abstract. Each claim should be a clear, verifiable statement.

Paper: ${paper.title}
Abstract: ${paper.abstract}

Return only the claims, one per line, without numbering or bullets.`;

    try {
      const claims = await this.callAPI([
        { role: 'system', content: 'You are a research assistant that extracts key claims from academic papers.' },
        { role: 'user', content: prompt }
      ], 0.5, 400);
      return claims.split('\n').filter(c => c.trim()).map(c => c.trim().replace(/^[-•\d.]+\s*/, ''));
    } catch (error) {
      return paper.claims || [];
    }
  },

  /**
   * Student Skill: Generate Paper Outline
   */
  async generatePaperOutline(query, papers) {
    const papersList = papers.slice(0, 5).map(p => {
      const title = p.title || 'Untitled';
      const year = p.year || 'Unknown';
      return `- ${title} (${year})`;
    }).join('\n');

    const prompt = `As a research assistant, help a student write a paper on: "${query}"

Based on these relevant papers:
${papersList}

Generate a structured paper outline with:
1. Introduction (with research question and motivation)
2. Literature Review (key themes to cover)
3. Methodology (suggested approaches)
4. Results/Discussion (expected findings)
5. Conclusion

Format as a clear outline with main sections and 2-3 subsections each. Use markdown formatting.`;

    try {
      const outline = await this.callAPI([
        { role: 'system', content: 'You are a helpful academic writing assistant for students.' },
        { role: 'user', content: prompt }
      ], 0.7, 800);
      return outline;
    } catch (error) {
      return `# Paper Outline: ${query}\n\n## 1. Introduction\n## 2. Literature Review\n## 3. Methodology\n## 4. Results\n## 5. Conclusion`;
    }
  },

  /**
   * Student Skill: Create an initial paper draft outline (JSON)
   * - Returns a light-weight framework first (sections + bullets), not a full paper.
   */
  async generateDraftOutline(query, papers) {
    const papersList = papers.slice(0, 5).map(p => {
      const title = p.title || 'Untitled';
      const year = p.year || 'Unknown';
      return `- ${title} (${year})`;
    }).join('\n');

    const prompt = `You are an academic writing assistant.
Create a minimal paper framework (outline only) for the research question: "${query}".

Use these relevant papers as context:
${papersList}

Return STRICT JSON with this exact schema:
{
  "title": string,
  "sections": [
    { "id": "introduction", "title": "Introduction", "bullets": [string] },
    { "id": "related_work", "title": "Related Work", "bullets": [string] },
    { "id": "method", "title": "Method", "bullets": [string] },
    { "id": "experiments", "title": "Experiments", "bullets": [string] },
    { "id": "discussion", "title": "Discussion", "bullets": [string] },
    { "id": "conclusion", "title": "Conclusion", "bullets": [string] }
  ]
}

Rules:
- Keep it minimal: 2-4 bullets per section.
- Bullets should be actionable (what to write), not full paragraphs.
- No markdown, no extra keys, JSON only.`;

    try {
      const jsonText = await this.callAPI([
        { role: 'system', content: 'You are a helpful academic writing assistant. Output JSON only.' },
        { role: 'user', content: prompt }
      ], 0.3, 900);

      // Best-effort parse: strip possible code fences
      const cleaned = (jsonText || '')
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
      return JSON.parse(cleaned);
    } catch (error) {
      // Fallback outline when AI is unavailable
      return {
        title: `Paper Draft: ${query}`,
        sections: [
          { id: 'introduction', title: 'Introduction', bullets: ['Motivation and problem statement', 'Research question and contributions'] },
          { id: 'related_work', title: 'Related Work', bullets: ['Summarize key lines of work', 'Position your approach vs prior art'] },
          { id: 'method', title: 'Method', bullets: ['Proposed approach overview', 'Key design choices and algorithms'] },
          { id: 'experiments', title: 'Experiments', bullets: ['Datasets and setup', 'Baselines and metrics', 'Ablations'] },
          { id: 'discussion', title: 'Discussion', bullets: ['Interpret results', 'Limitations and risks'] },
          { id: 'conclusion', title: 'Conclusion', bullets: ['Summary of findings', 'Future work'] }
        ]
      };
    }
  },

  /**
   * Classify a snippet into a paper section.
   * Returns section id from: introduction | related_work | method | experiments | discussion | conclusion
   */
  async classifySnippetToSection(query, snippet) {
    const allowed = ['introduction', 'related_work', 'method', 'experiments', 'discussion', 'conclusion'];

    const prompt = `You are helping place text into a paper.
Research question: "${query}"
Snippet: "${snippet}"

Choose the best section id from this list ONLY:
${allowed.join(', ')}

Return STRICT JSON: {"section_id": "<one_of_allowed>"} (JSON only, no markdown).`;

    try {
      const jsonText = await this.callAPI([
        { role: 'system', content: 'Return JSON only.' },
        { role: 'user', content: prompt }
      ], 0.0, 80);
      const cleaned = (jsonText || '')
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
      const obj = JSON.parse(cleaned);
      if (obj && allowed.includes(obj.section_id)) return obj.section_id;
    } catch (e) {
      // fall through to heuristic
    }

    // Heuristic fallback
    const s = (snippet || '').toLowerCase();
    if (s.includes('dataset') || s.includes('benchmark') || s.includes('metric') || s.includes('experiment') || s.includes('evaluation')) return 'experiments';
    if (s.includes('we propose') || s.includes('architecture') || s.includes('algorithm') || s.includes('method') || s.includes('model')) return 'method';
    if (s.includes('prior') || s.includes('related work') || s.includes('previous') || s.includes('baseline')) return 'related_work';
    if (s.includes('limitation') || s.includes('risk') || s.includes('future')) return 'discussion';
    if (s.includes('in summary') || s.includes('conclude') || s.includes('overall')) return 'conclusion';
    return 'introduction';
  },

  /**
   * Compose a coherent paragraph for a paper section from bullets + draft items.
   */
  async composeSectionText(query, sectionTitle, bullets, items, existingBody) {
    const notes = (items || []).map(it => {
      const src = it.source || 'note';
      return `- [${src}] ${it.text}`;
    }).join('\n');

    const outline = (bullets || []).map(b => `- ${b}`).join('\n');

    const prompt = `You are writing the "${sectionTitle}" section of an academic paper about "${query}".

Use the following section outline:
${outline || '(no explicit outline)'}

Use these notes/claims as supporting material:
${notes || '(no notes yet)'}

Current draft text (if any):
${existingBody || '(none yet)'}

Task:
- Produce 1-3 coherent paragraphs of academic prose for this section.
- Integrate the key ideas from the notes logically.
- Avoid bullet points and markdown, write plain text only.
- Do NOT restate the section title or query, just the body text.`;

    try {
      const body = await this.callAPI([
        { role: 'system', content: 'You are an academic writing assistant. Write clear, logically structured paragraphs.' },
        { role: 'user', content: prompt }
      ], 0.6, 700);
      return (body || '').trim();
    } catch (e) {
      return existingBody || '';
    }
  },

  /**
   * Student Skill: Explain Core Concepts
   */
  async explainConcepts(query, papers) {
    const papersSummary = papers.slice(0, 5).map(p => {
      const title = p.title || 'Untitled';
      const year = p.year || 'Unknown';
      return `- ${title} (${year})`;
    }).join('\n');

    const prompt = `You are helping a student understand the core concepts behind this question:
"${query}"

Relevant papers:
${papersSummary}

Write a SHORT markdown note with EXACTLY these sections:

1) "# Overview"
- 1 short paragraph (2-4 sentences) explaining the big picture in simple language.

2) "# Concepts"
- 3-5 bullet points.
- Each bullet must be in the form "- ConceptName: one-sentence definition in simple language".

3) "# Paper-ready sentences (Intro)"
- 3-6 bullet points.
- Each bullet must be a single, well-formed academic sentence that can be pasted directly into the Introduction of a paper.

Important formatting rules:
- Use ONLY markdown headings and bullets, no numbered lists.
- Do NOT include any other sections.
- Do NOT wrap content in code fences.
- Keep the whole output under 450 words.`;

    try {
      const explanation = await this.callAPI([
        { role: 'system', content: 'You are a patient teacher explaining AI/ML concepts to students using clear markdown sections.' },
        { role: 'user', content: prompt }
      ], 0.7, 650);
      return explanation || '';
    } catch (error) {
      return `Core concepts related to ${query} involve understanding the fundamental principles and their applications in AI research.`;
    }
  },

  /**
   * Student Skill: Compare Research Papers
   */
  async comparePapers(papers) {
    if (papers.length < 2) {
      return 'Please select at least 2 papers to compare.';
    }

    const papersInfo = papers.slice(0, 3).map((p, i) => {
      const title = p.title || 'Untitled';
      const year = p.year || 'Unknown';
      const abstract = p.abstract || '';
      return `Paper ${i + 1}: ${title} (${year})\nAbstract: ${abstract.substring(0, 300)}...`;
    }).join('\n\n');

    const prompt = `You are helping a student or researcher write the Related Work section by comparing these papers:

${papersInfo}

Write a SHORT markdown note with EXACTLY these sections.
For quick visual scanning, prefix each heading with an UPPERCASE tag in square brackets, and use simple emojis like 📚 / 📌 / ✍️.

1) "# 📚 [COMPARISON] Comparison bullets"
- 3-6 bullet points.
- Each bullet must explicitly compare at least two papers (e.g. "Paper 1 vs Paper 2: ...") and highlight a clear difference or similarity (method, data, results, limitations).

2) "# 📌 [STRENGTHS] Strengths and limitations"
- 2-4 bullet points summarizing the main strengths and weaknesses across these papers.

3) "# ✍️ [PARAGRAPH] Draft Related Work paragraph"
- 1 single paragraph (6-8 sentences) written in formal academic style that could be pasted directly into a Related Work section.
- This paragraph should weave together the comparisons from sections 1 and 2 into a coherent narrative.

Important formatting rules:
- Use ONLY markdown headings and bullets, no numbered lists.
- Do NOT include any other sections.
- Do NOT wrap content in code fences.
- Keep the whole output under 450 words.`;

    try {
      const comparison = await this.callAPI([
        { role: 'system', content: 'You are a research assistant structuring comparisons to help write Related Work, using clear markdown sections and one well-formed paragraph.' },
        { role: 'user', content: prompt }
      ], 0.7, 700);
      return comparison || '';
    } catch (error) {
      return 'Comparison analysis is being generated...';
    }
  },

  /**
   * Researcher Skill: Identify Research Gaps
   */
  async identifyResearchGaps(query, papers) {
    const papersSummary = papers.map(p => {
      const title = p.title || 'Untitled';
      const year = p.year || 'Unknown';
      const abstract = p.abstract || '';
      return `- ${title} (${year}): ${abstract.substring(0, 200)}...`;
    }).join('\n');

    const prompt = `You are helping a researcher identify concrete, publishable research gaps for: "${query}"

Based on these papers (titles, years and abstracts):
${papersSummary}

Write a SHORT markdown note with EXACTLY these sections.
For quick visual scanning, prefix each heading with an UPPERCASE tag in square brackets, and use simple emojis like 🧩 / 📚 / ✍️.

1) "# 🧩 [GAP LIST] Gap list"
- 2-4 items.
- Each item must be in the form "- Gap X: one-sentence description of the missing piece", focusing on underexplored questions, contradictions, or limitations in current methods.

2) "# 📚 [DETAIL] Details by gap"
- For each gap above, add a "## Gap X" subsection. Use emojis to structure information clearly:
  - Start with a line "📖 Evidence" and then bullet the 1-3 key papers (title + year) that motivate this gap.
  - Then a line "🔍 What is missing" followed by 2-3 short bullet points describing what has NOT been done yet.

3) "# ✍️ [PARAGRAPH] Draft discussion paragraph"
- 1 single paragraph (6-8 sentences) in formal academic tone that could be pasted into a Discussion or Future Work section.
- This paragraph should synthesise the most important 1-2 gaps and briefly explain why they matter and how future work could address them.

Important formatting rules:
- Use ONLY markdown headings and bullets, no numbered lists.
- Do NOT include any other sections.
- Do NOT wrap content in code fences.
- Keep the whole output under 500 words.`;

    try {
      const gaps = await this.callAPI([
        { role: 'system', content: 'You are an expert research analyst identifying gaps in the literature and drafting discussion text, using clear markdown sections.' },
        { role: 'user', content: prompt }
      ], 0.7, 800);
      return gaps;
    } catch (error) {
      return `Research gaps in ${query} include areas that need further investigation and methodological improvements.`;
    }
  },

  /**
   * Researcher Skill: Track Latest Trends
   */
  async trackTrends(query, papers) {
    const papersByYear = {};
    papers.forEach(p => {
      const year = p.year || 'Unknown';
      const title = p.title || 'Untitled';
      if (!papersByYear[year]) papersByYear[year] = [];
      papersByYear[year].push(title);
    });

    const prompt = `You are helping a researcher understand how work on "${query}" has evolved over time and write an introduction-style background.

Papers by year:
${Object.entries(papersByYear).map(([year, titles]) => 
  `${year}: ${titles.join(', ')}`
).join('\n')}

Write a SHORT markdown note with EXACTLY these sections.
For quick visual scanning, prefix each heading with an UPPERCASE tag in square brackets, and use simple emojis like 🕒 / 📈 / ✍️.

1) "# 🕒 [TIMELINE] Timeline"
- 3-5 bullet points.
- Each bullet should cover a time span (e.g. "2012–2015") and briefly summarise the dominant theme and representative papers in that period.

2) "# 📈 [TRENDS] Recent trends"
- 3-5 bullet points focusing on the last 2-3 years only.
- Include mentions of concrete model families, datasets, or techniques where possible.

3) "# ✍️ [PARAGRAPH] Draft intro paragraph"
- 1 single paragraph (6-8 sentences) in formal academic style that could be pasted into the Introduction of a paper.
- This paragraph should smoothly describe the historical evolution and conclude with why the current topic/problem is timely.

Important formatting rules:
- Use ONLY markdown headings and bullets, no numbered lists.
- Do NOT include any other sections.
- Do NOT wrap content in code fences.
- Keep the whole output under 500 words.`;

    try {
      const trends = await this.callAPI([
        { role: 'system', content: 'You are a research trend analyst producing timeline-style summaries and an introduction paragraph, using clear markdown sections.' },
        { role: 'user', content: prompt }
      ], 0.7, 700);
      return trends;
    } catch (error) {
      return `Recent trends in ${query} show continued development and innovation in the field.`;
    }
  },

  /**
   * Semantic Search (TEST MODE): rule-based scoring.
   * Kept for debugging / offline testing.
   */
  semanticSearchTest(query, allPapers) {
    const queryLower = (query || '').toLowerCase();
    const scoredPapers = (allPapers || []).map(paper => {
      let score = 0;
      const title = paper.title || '';
      const abstract = paper.abstract || '';
      const paperKeywords = Array.isArray(paper.keywords) ? paper.keywords.join(' ') : '';
      const text = `${title} ${abstract} ${paperKeywords}`.toLowerCase();

      // Keyword matching
      const queryKeywords = queryLower.split(/\s+/).filter(Boolean);
      queryKeywords.forEach(kw => {
        if (text.includes(kw)) score += 2;
      });

      // Category matching
      if (queryLower.includes('transformer') && paper.category === 'transformer') score += 5;
      if (queryLower.includes('llm') && paper.category === 'llm') score += 5;
      if (queryLower.includes('vision') && paper.category === 'cv') score += 5;
      if (queryLower.includes('nlp') && paper.category === 'nlp') score += 5;

      // Recency bonus
      if (paper.year >= 2020) score += 1;

      return { ...paper, relevanceScore: score };
    });

    scoredPapers.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    const topPapers = scoredPapers.slice(0, 10);
    if (topPapers.length > 0 && (topPapers[0].relevanceScore || 0) > 0) {
      return topPapers;
    }
    return (allPapers || []).slice(0, 10);
  },

  /**
   * Semantic Search (REAL MODE): LLM thinks and selects papers.
   * Returns a list of papers ordered by AI-chosen relevance.
   */
  async semanticSearchAI(query, allPapers) {
    if (!allPapers || allPapers.length === 0) return [];

    const limited = allPapers.slice(0, 30); // safety cap
    const catalog = limited.map(p => {
      return {
        id: p.id,
        title: p.title,
        year: p.year,
        venue: p.venue,
        category: p.category,
        keywords: p.keywords,
        abstract: (p.abstract || '').substring(0, 400)
      };
    });

    const prompt = `You are an academic search engine ranking assistant.
The user query is:
"${query}"

You are given a small catalog of papers as JSON:
${JSON.stringify(catalog, null, 2)}

Think carefully about which papers are most relevant to this query.
Consider:
- matching of core topic and method
- how central the paper is to answering the question
- recency (prefer newer work if equally relevant)

Return ONLY a JSON array of objects with this exact schema, sorted from most to least relevant:
[
  { "id": "<paper_id_string>", "score": <number between 0 and 1> }
]

Rules:
- Include at most 10 papers.
- Do NOT add any explanations or text outside the JSON.
- If nothing seems strongly relevant, still pick the best few.`;

    try {
      const body = await this.callAPI([
        { role: 'system', content: 'You are an academic search ranking model. Output only strict JSON as specified.' },
        { role: 'user', content: prompt }
      ], 0.4, 900);

      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch (e) {
        // try to salvage JSON from text
        const match = body && body.match(/\[([\s\S]*?)\]/);
        if (match) {
          parsed = JSON.parse(match[0]);
        } else {
          throw e;
        }
      }

      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('Empty AI ranking');
      }

      // Expose last ranking for visualization
      this._lastRanking = parsed;

      const byId = {};
      allPapers.forEach(p => {
        if (p && p.id) byId[p.id] = p;
      });

      const ordered = [];
      parsed.forEach(entry => {
        if (!entry || !entry.id) return;
        const paper = byId[entry.id];
        if (paper) {
          if (typeof entry.score === 'number') {
            paper._aiScore = entry.score;
          }
          ordered.push(paper);
        }
      });

      if (ordered.length > 0) {
        return ordered.slice(0, 10);
      }

      // Fallback: test-mode scoring
      return this.semanticSearchTest(query, allPapers);
    } catch (e) {
      // On any error, fall back to test-mode scoring
      return this.semanticSearchTest(query, allPapers);
    }
  },

  /**
   * Compute pairwise semantic similarity between papers for visualization.
   * Returns an array of { a: id1, b: id2, similarity: number between 0 and 1 }.
   */
  async computePaperSimilarities(query, papers) {
    if (!papers || papers.length < 2) return [];

    const compact = papers.slice(0, 12).map(p => ({
      id: p.id,
      title: p.title,
      year: p.year,
      abstract: (p.abstract || '').substring(0, 260)
    }));

    const prompt = `You are helping visualize how related papers are to each other for the query:
"${query}"

Here is a small list of papers as JSON:
${JSON.stringify(compact, null, 2)}

Think carefully about how similar each pair of papers is, based on topic, method, and contributions.

Return ONLY a JSON array with entries of the form:
[
  { "a": "<paper_id_string>", "b": "<paper_id_string>", "similarity": <number between 0 and 1> }
]

Guidelines:
- similarity = 1.0 means "almost the same idea or a direct extension"
- similarity ~ 0.7 means "strongly related, same line of work"
- similarity ~ 0.4 means "related but clearly different focus"
- similarity < 0.2 means "weakly related or mostly different"
- Only include pairs where similarity >= 0.2 to avoid clutter.

Rules:
- Include at most 40 entries.
- Do NOT add any explanation or text outside the JSON.`;

    try {
      const body = await this.callAPI([
        { role: 'system', content: 'You are a semantic similarity rater between academic papers. Output only strict JSON as specified.' },
        { role: 'user', content: prompt }
      ], 0.3, 900);

      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch (e) {
        const match = body && body.match(/\[([\s\S]*?)\]/);
        if (match) {
          parsed = JSON.parse(match[0]);
        } else {
          throw e;
        }
      }

      if (!Array.isArray(parsed)) return [];

      return parsed.filter(
        link =>
          link &&
          typeof link.a === 'string' &&
          typeof link.b === 'string' &&
          typeof link.similarity === 'number'
      );
    } catch (e) {
      return [];
    }
  }
};

// Make AIService globally available
if (typeof window !== 'undefined') {
  window.AIService = AIService;
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIService;
}
