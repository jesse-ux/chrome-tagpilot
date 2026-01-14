/**
 * AI 书签分类器（优化版）
 * 重点：
 * 1) 更干净的页面摘要（去噪：登录/下载/页脚/隐私条款等）
 * 2) 更强约束的 Prompt（证据驱动 + 禁止垃圾标签 + 宁缺毋滥）
 * 3) 更稳健的 JSON 解析（支持 response_format 失败回退）
 * 4) 强力后处理（黑名单、同义归一、站点名过滤、泛词降级）
 */

// -----------------------------
// Tag 规则：黑名单/泛词/同义归一
// -----------------------------

const HARD_BAN_TAGS = new Set([
  '登录', '注册', '下载', '安装', '点击', '按钮', '首页', '官网', '欢迎',
  '个人中心', '联系我们', '隐私', '隐私政策', '条款', '服务条款',
  'cookie', 'cookies', 'copyright', '版权所有', '免责声明', '举报', '反馈',
  '飞书', '飞书文档', '飞书云文档', '腾讯文档', '语雀', '石墨文档', 'Notion',
  'bilibili', 'youtube', '知乎', '小红书', // 除非是专门讲运营的，否则这些通常是载体
  'error', '403', '404', 'forbidden',
]);

// 这些不是“绝对不能用”，但经常是废话；除非实在没别的，否则尽量不留
const SOFT_GENERIC_TAGS = new Set([
  '项目', '工具', '学习资源', '资料', '参考', '技术', '技术文档', '资讯', '干货', '合集', '教程资源',
  '开源版本', '在线工具', '免费工具', '实用工具', '软件', '平台', '系统', '应用',
  '中文', 'English', 'GitHub仓库', '使用指南', '解决方案', '成长手册',
  '官方', '系列', '最新',
]);

// 允许保留的“内容类型/载体”标签（相对有用）
const CONTENT_TYPE_ALLOW = new Set([
  '网页', 'API', 'API文档',
  '文档', '教程', '新闻', '视频', '博客', '问答', '仓库', '论文', '规范', '工具', '插件', '书签',
]);

// 明确允许的品牌/平台（当“站点名”出现时，仅白名单放行）
const BRAND_WHITELIST = new Set([
  'GitHub', 'StackOverflow', 'YouTube', 'bilibili', '知乎', '掘金', 'Medium',
  'Docker', 'Kubernetes', 'React', 'Vue', 'Angular', 'Node.js', 'Python', 'JavaScript',
  'AWS', 'GCP', 'Azure', 'OpenAI',
]);

// 注意：CANONICAL_MAP 已移至 utils/tagIndex.js，通过 importScripts 共享

function normalizeTag(tag) {
  if (!tag) return '';
  return String(tag)
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '') // 去引号
    .replace(/\s+/g, ' ')
    .replace(/[，、]/g, ',')
    .trim();
}

const TAG_SUFFIXES = ['工具箱', '工具集', '工具', '支持', '开源版本', '版本', '云端部署', '部署'];

function compactTag(tag) {
  let t = normalizeTag(tag).replace(/\s+/g, '');
  for (const s of TAG_SUFFIXES) {
    if (t.endsWith(s) && t.length > s.length + 2) {
      t = t.slice(0, -s.length);
      break;
    }
  }
  return t;
}

function canonicalizeTag(tag) {
  const t0 = compactTag(tag);
  if (!t0) return '';
  const lower = t0.toLowerCase();
  // 优先按 lower 匹配（覆盖 AI / ai / ML 等）
  if (CANONICAL_MAP.has(lower)) return CANONICAL_MAP.get(lower);
  if (CANONICAL_MAP.has(t0)) return CANONICAL_MAP.get(t0);
  return t0;
}

function isHardBanned(tag) {
  const t = normalizeTag(tag);
  if (!t) return true;
  if (HARD_BAN_TAGS.has(t)) return true;
  if (/^error\s*\d{3}$/i.test(t)) return true;
  if (/^\d{3}$/.test(t)) return true;
  if (/(forbidden|access denied|captcha|cloudflare)/i.test(t)) return true;
  // 也屏蔽一些常见“按钮短语”包含式命中
  if (/^(立即|马上)?(登录|注册|下载|安装)$/.test(t)) return true;
  return false;
}

function looksLikeSiteName(tag, url, title) {
  const t = normalizeTag(tag);
  if (!t) return false;

  // 白名单一律不当站点噪声
  if (BRAND_WHITELIST.has(t)) return false;

  // 以域名核心词为准过滤：狗狗加速.com -> “狗狗加速”
  let hostCore = '';
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    const parts = hostname.split('.');
    hostCore = parts.length >= 2 ? parts[parts.length - 2] : hostname; // example.com -> example
  } catch (_) { }

  // 标题里常出现“站点名”，也容易被模型复读
  const titleStr = (title || '').trim();

  // 站点核心词/标题强相关 且 非白名单 => 大概率是“品牌复读”
  if (hostCore && t.toLowerCase() === hostCore.toLowerCase()) return true;
  if (titleStr && (titleStr.startsWith(t) || titleStr.endsWith(t))) return true;

  return false;
}

function isMostlyCJK(str) {
  if (!str) return false;
  const cjk = str.match(/[\u4e00-\u9fff]/g)?.length || 0;
  return cjk / str.length >= 0.5;
}

function isLengthOk(tag) {
  const t = normalizeTag(tag);
  if (!t) return false;
  if (isMostlyCJK(t)) return t.length >= 2 && t.length <= 10;
  // 英文专名允许更长一点
  return t.length >= 2 && t.length <= 24;
}

/**
 * 后处理：黑名单、同义归一、站点名过滤、泛词降级、去重、补齐内容类型
 */
function postProcessTags(rawTags, url, title) {
  const picked = [];
  const seen = new Set();
  const softPool = []; // 软泛词备用池

  const add = (tag) => {
    const t = canonicalizeTag(tag);
    if (!t) return;
    const key = t.toLowerCase();

    if (seen.has(key)) return;
    if (isHardBanned(t)) return;
    if (!isLengthOk(t)) return;
    if (looksLikeSiteName(t, url, title)) return;

    // “AI/人工智能”这类同义归一后，就不会重复
    seen.add(key);
    picked.push(t);
  };

  const addSoft = (tag) => {
    const t = canonicalizeTag(tag);
    if (!t) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    if (isHardBanned(t)) return;
    if (!isLengthOk(t)) return;
    if (looksLikeSiteName(t, url, title)) return;
    softPool.push(t);
  };

  for (const tag of (Array.isArray(rawTags) ? rawTags : [])) {
    const t = canonicalizeTag(tag);
    if (!t) continue;

    // 软泛词先放到候选池（有更具体的就别用）
    if (SOFT_GENERIC_TAGS.has(t)) {
      addSoft(t);
      continue;
    }
    add(t);
  }

  // 补一个内容类型（如果完全没有）
  // const hasContentType = picked.some(t => CONTENT_TYPE_ALLOW.has(t));
  // if (!hasContentType) {
  //   const inferred = inferContentType(url, title);
  //   if (inferred) {
  //     add(inferred);
  //   } else {
  //     add('网页');
  //   }
  // }

  // 如果太少，再从软泛词里挑一两个（但仍会去重/过滤）
  if (picked.length < 3) {
    for (const t of softPool) {
      // “项目”基本没价值，除非你真的想保留；这里直接跳过
      if (t === '项目') continue;
      add(t);
      if (picked.length >= 3) break;
    }
  }

  // 最终最多 5 个
  return dropRedundantAI(picked).slice(0, 5);
}

function dropRedundantAI(tags) {
  const set = new Set(tags.map(t => t.toLowerCase()));
  const hasSpecific = set.has('ml') || set.has('dl') || set.has('llm');
  if (hasSpecific) return tags.filter(t => t !== 'AI');
  return tags;
}

function inferContentType(url, title, content = '') {
  const u = (url || '').toLowerCase();
  const t = (title || '').toLowerCase();
  const c = (content || '').toLowerCase();

  if (u.includes('github.com')) return '仓库';
  if (u.includes('stackoverflow.com') || u.includes('zhihu.com')) return '问答';
  if (u.includes('youtube.com') || u.includes('bilibili.com')) return '视频';

  // 文档
  if (u.includes('docs.') || u.includes('/docs') || t.includes('documentation') || t.includes('文档')) return '文档';

  // API / 接口
  if (t.includes('api') || u.includes('/api') || u.includes('openapi') || c.includes('api')) return 'API';

  // 工具类信号（即使无正文也能判断）
  const toolHint = /(editor|generator|playground|builder|converter|mockup|palette|diagram|flowchart|translate|tool)/i;
  if (toolHint.test(u) || toolHint.test(t)) return '工具';

  // 兜底：网页
  return '网页';
}

// -----------------------------
// 取页面内容：保留协议 + 去噪清洗
// -----------------------------

function cleanPageContent(raw, maxLength = 3000) {
  if (!raw) return null;

  // 去 script/style（防止抓到 html）
  let text = raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n'); // 连续太多空行压一压

  // 按行去噪（登录/下载/隐私等 + 太短的行）
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .filter(l => l.length >= 6) // 太短通常是导航
    .filter(l => !/(登录|注册|下载|隐私|条款|cookie|版权所有|copyright|联系我们|帮助中心|反馈|举报)/i.test(l));

  // 合并并截断
  const merged = lines.join('\n').trim();
  if (!merged) return null;

  return merged.slice(0, maxLength);
}

function looksLikeBlockedContent(text = '') {
  const head = text.slice(0, 600).toLowerCase();
  return (
    head.includes('error 403') ||
    head.includes('403 forbidden') ||
    head.includes('access denied') ||
    head.includes('forbidden') ||
    head.includes('captcha') ||
    head.includes('cloudflare')
  );
}

// 从网页提取内容（使用 r.jina.ai）
// -----------------------------
// 网络请求优化：重试 + 超时延长
// -----------------------------

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url, options, retries = 1) {
  try {
    const response = await fetch(url, options);
    if (!response.ok && retries > 0 && response.status !== 404 && response.status !== 403) {
      throw new Error(`Status ${response.status}`);
    }
    return response;
  } catch (err) {
    if (retries > 0) {
      console.log(`[TagPilot] Fetch重试中... 剩余次数: ${retries}`);
      await delay(1500); // 等 1.5 秒再试
      return fetchWithRetry(url, options, retries - 1);
    }
    throw err;
  }
}

async function fetchPageContent(url) {
  try {
    if (!/^https?:\/\//i.test(url) || url.includes('chrome://') || url.includes('localhost')) {
      return null;
    }

    const jinaUrl = `https://r.jina.ai/${url}`;

    // 优化：延长超时到 15000ms (15秒)，Jina 有时很慢
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetchWithRetry(jinaUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/plain, */*',
          // 尝试加个标头避免部分反爬
          'X-Return-Format': 'text'
        },
        signal: controller.signal,
      }, 1); // 启用1次重试

      if (!response.ok) return null;

      const rawText = await response.text();
      // 检查内容是否像是被拦截了
      if (looksLikeBlockedContent(rawText) || rawText.length < 50) {
        return null;
      }

      return cleanPageContent(rawText, 4000); // 稍微放宽长度限制

    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    console.log('[TagPilot] 抓取失败:', error.name === 'AbortError' ? '超时' : error.message);
    return null;
  }
}
// -----------------------------
// OpenAI 调用：更强 prompt + 更稳 JSON
// -----------------------------

function buildSystemPrompt(debug = false) {
  return `你是“书签标签生成器”，目标是为书签生成便于日后检索的高质量标签（不是复述标题、不是按钮词、不是站点名堆砌）。
输入包含 url、title、content（网页摘要，可能含导航/按钮/页脚/版权等噪声）。

规则：
1) 只根据标题/正文中能找到明确依据的信息生成标签；证据不足就少给（允许只给 3 个）。
2) 输出 3-5 个标签，按重要性排序：主题 > 领域/对象 > 内容类型 > 用途/意图。
3) 简体中文优先；英文资源允许保留 1-2 个英文专有名词（如 PyTorch、Kubernetes）。
4) 避免同义/近义重复：如 AI/人工智能/机器学习 只选最贴合内容的一个。
5) 严禁输出按钮/界面词：登录、注册、下载、安装、首页、官网、联系我们、隐私、条款、cookie 等。
6) 避免泛化废话：项目、学习资源、资料、技术、技术文档、资讯（除非页面类型非常明确）。
7) 站点名/品牌名默认不作为标签；只有当它是明确的知名平台/框架/产品（如 GitHub、Docker、React）才可用。
8) 至少包含 1 个主题/领域 + 1 个内容类型（文档/教程/新闻/视频/博客/问答/仓库/论文/工具/插件…）。

输出必须是严格 JSON：
{"tags":["标签1","标签2","标签3"]}

${debug ? `Debug 模式额外要求：
- 在同一个 JSON 中额外输出 "_debug" 字段，说明每个标签的证据来自哪里。
- "_debug" 结构如下（只要尽量遵循即可）：
"_debug":{
  "evidence":[
    {"tag":"标签","source":"title|content|url","quote":"不超过60字的原文片段"}
  ],
  "warnings":[ "如果内容噪声大/证据不足，写在这里" ]
}
- quote 必须来自输入的 title/content/url，不要编造。` : ''}`;
}

function buildUserPrompt(url, title, content, debug = false) {
  return `为下列书签生成 3-5 个高质量标签（宁缺毋滥）：
- 只用你能从标题/正文摘要中找到依据的信息
- 忽略导航/按钮/页脚/版权等噪声
- 避免同义重复（如 AI/人工智能 只保留一个）
- 不要输出 登录/下载/官网/条款/cookie/项目/学习资源/技术文档 等

输入：
url: ${url}
title: ${title}
content: ${content || '(无正文摘要)'}

${debug ? `请同时在 JSON 里附带 "_debug.evidence"，每个标签给一条证据（source+quote）。` : ''}

仅输出严格 JSON。`;
}




function extractTagsAndDebug(text) {
  const result = { tags: [], debug: null };

  if (!text) return result;
  const trimmed = String(text).trim();

  const tryParseObj = (s) => {
    try {
      const obj = JSON.parse(s);
      if (obj && Array.isArray(obj.tags)) {
        result.tags = obj.tags;
        if (obj._debug) result.debug = obj._debug;
        return true;
      }
    } catch (_) { }
    return false;
  };

  // 1) 直接 JSON
  if (tryParseObj(trimmed)) return result;

  // 2) 抓第一个 JSON 对象
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch && tryParseObj(jsonMatch[0])) return result;

  // 3) 抓数组（降级）
  const arrMatch = trimmed.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try {
      const arr = JSON.parse(arrMatch[0]);
      if (Array.isArray(arr)) result.tags = arr;
    } catch (_) { }
  } else {
    // 4) 最后兜底：切分
    result.tags = trimmed
      .replace(/^\s*tags\s*:\s*/i, '')
      .split(/[,，\n]+/)
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, 8);
  }

  return result;
}


// 调用 OpenAI API 分析网页
async function analyzeWithOpenAI(url, title, pageContent, config) {
  const { openaiApiKey, model, apiEndpoint, debugEvidence } = config;
  const wantEvidence = !!debugEvidence;

  if (!openaiApiKey) throw new Error('请先在设置中配置 API Key');

  const baseUrl = apiEndpoint || 'https://api.openai.com/v1';
  const apiUrl = `${baseUrl}/chat/completions`;

  const systemPrompt = buildSystemPrompt(wantEvidence);
  const userPrompt = buildUserPrompt(url, title, pageContent, wantEvidence);

  const makeBody = (withResponseFormat) => ({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.2,
    max_tokens: wantEvidence ? 260 : 180,
    ...(withResponseFormat ? { response_format: { type: 'json_object' } } : {})
  });

  const callOnce = async (withResponseFormat) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify(makeBody(withResponseFormat)),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const rawText = await resp.text();
    let data = null;
    try { data = JSON.parse(rawText); } catch (_) { }

    if (!resp.ok) {
      const msg = data?.error?.message || rawText || 'API request failed';
      const err = new Error(msg);
      err.status = resp.status;
      throw err;
    }

    return data?.choices?.[0]?.message?.content || '';
  };

  try {
    const content = await callOnce(true);
    return extractTagsAndDebug(content);
  } catch (err) {
    if (String(err?.message || '').toLowerCase().includes('response_format') || err?.status === 400) {
      const content = await callOnce(false);
      return extractTagsAndDebug(content);
    }
    throw err;
  }
}


// -----------------------------
// 主分类函数
// -----------------------------

async function classifyBookmark(bookmark) {
  const config = await getConfig();

  if (!config.autoTag || !config.openaiApiKey) {
    console.log('自动分类未启用或未配置 API Key');
    return [];
  }

  console.log(`[TagPilot] 开始分类: ${bookmark.title}`);

  const ruleBasedTags = generateRuleBasedTags(bookmark.url, bookmark.title);

  try {
    const pageContent = await fetchPageContent(bookmark.url);
    if (pageContent) {
      console.log(`[TagPilot] 成功获取页面内容，长度: ${pageContent.length}`);
    } else {
      console.log(`[TagPilot] 未获取到页面内容，将仅使用 URL 和标题`);
    }

    const ai = await analyzeWithOpenAI(
      bookmark.url,
      bookmark.title,
      pageContent,
      config
    );

    const aiTagsRaw = ai.tags || [];
    console.log(`[TagPilot] AI 原始标签:`, aiTagsRaw);

    // 只在 debug 开启时打印证据（并且需要模型真的返回了）
    if (config.debug && ai.debug) {
      console.groupCollapsed(`[TagPilot][debug] 证据: ${bookmark.title}`);
      console.log('url:', bookmark.url);
      if (Array.isArray(ai.debug?.evidence)) {
        for (const e of ai.debug.evidence) {
          console.log(`- ${e.tag} (${e.source}): ${e.quote}`);
        }
      }
      if (ai.debug?.warnings?.length) console.warn('warnings:', ai.debug.warnings);
      console.groupEnd();
    }

    const combined = [...aiTagsRaw, ...ruleBasedTags];
    const finalTags = postProcessTags(combined, bookmark.url, bookmark.title);

    console.log(`[TagPilot] 最终标签 (${finalTags.length} 个):`, finalTags);

    // 若过滤后太少，回退规则标签
    if (finalTags.length < 2) return postProcessTags(ruleBasedTags, bookmark.url, bookmark.title);

    return finalTags;
  } catch (error) {
    console.warn('[TagPilot] AI 分类失败，使用规则标签:', error);
    return postProcessTags(ruleBasedTags, bookmark.url, bookmark.title);
  }
}




// -----------------------------
// 规则兜底：去掉同义重复/泛词
// -----------------------------

function generateRuleBasedTags(url, title) {
  const tags = [];
  const urlLower = (url || '').toLowerCase();
  const titleLower = (title || '').toLowerCase();

  const sitePatterns = {
    'github.com': ['GitHub', '仓库'],
    'stackoverflow.com': ['StackOverflow', '问答'],
    'docs.': ['文档'],
    '/docs': ['文档'],
    'blog.': ['博客'],
    '/blog': ['博客'],
    'youtube.com': ['视频'],
    'bilibili.com': ['视频'],
    'zhihu.com': ['知乎', '问答'],
    'juejin.cn': ['掘金', '博客'],
    'medium.com': ['Medium', '博客'],
    'dev.to': ['Dev.to', '博客']
  };

  for (const [pattern, siteTags] of Object.entries(sitePatterns)) {
    if (urlLower.includes(pattern)) {
      tags.push(...siteTags);
      break;
    }
  }

  const techKeywords = {
    'javascript': ['JavaScript'],
    'typescript': ['TypeScript'],
    'python': ['Python'],
    'java': ['Java'],
    'golang': ['Go'],
    'react': ['React'],
    'vue': ['Vue'],
    'angular': ['Angular'],
    'node': ['Node.js'],
    'docker': ['Docker'],
    'kubernetes': ['Kubernetes'],
    'ai': ['AI'],               // 关键：不要再塞 AI + 人工智能
    'machine learning': ['ML'],
    'deep learning': ['DL'],
    'llm': ['LLM'],
    'prompt': ['Prompt'],
    'comfyui': ['ComfyUI', '工作流'],
    'workflow': ['工作流'],
    'flux': ['Flux'],
    'svc': ['SVC', '语音'],
    'runninghub': ['ComfyUI', '工作流'],
  };

  for (const [keyword, techTags] of Object.entries(techKeywords)) {
    if (urlLower.includes(keyword) || titleLower.includes(keyword)) {
      tags.push(...techTags);
    }
  }

  // 先做一次后处理，避免规则本身产生垃圾标签
  const processed = postProcessTags(tags, url, title);

  // 兜底最多给 3 个
  return processed.slice(0, 3);
}
