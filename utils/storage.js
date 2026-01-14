/**
 * 本地存储管理（优化版）
 */

// 导入标签规范化工具（在 background.js 中通过 importScripts 加载）
// 如果是在 popup.js 中使用，需要通过 <script> 标签引入

const DEFAULT_CONFIG = {
  apiEndpoint: '',
  openaiApiKey: '',
  model: 'gpt-4o-mini',
  autoTag: true,
  maxRetries: 3,
  language: 'zh-CN',

  // Debug 功能（新增）
  debug: false,          // 开关：是否输出 debug 日志
  debugEvidence: false,  // 开关：是否让模型返回 _debug 证据（建议只在 debug 时开启）
};

// 获取配置（自动补齐默认值 + 自动迁移）
async function getConfig() {
  const result = await chrome.storage.local.get('config');
  const stored = result?.config || {};

  // merge 默认值，保证新字段存在
  const merged = { ...DEFAULT_CONFIG, ...stored };

  // 自动迁移：如果存储里缺字段，则写回，避免后续版本读到 undefined
  const needMigrate = Object.keys(DEFAULT_CONFIG).some(k => !(k in stored));
  if (needMigrate) {
    await chrome.storage.local.set({ config: merged });
  }

  // debugEvidence 通常跟 debug 走：如果 debug 关了，强制关 debugEvidence（可选）
  if (!merged.debug) merged.debugEvidence = false;

  return merged;
}

// 保存配置（merge 默认值，避免丢字段）
async function saveConfig(config) {
  const safe = { ...DEFAULT_CONFIG, ...(config || {}) };

  // 保持 debug 逻辑一致（可选）
  if (!safe.debug) safe.debugEvidence = false;

  await chrome.storage.local.set({ config: safe });
}

// 获取书签标签数据
async function getBookmarkTags() {
  const result = await chrome.storage.local.get('bookmarkTags');
  return result.bookmarkTags || {};
}

// 保存书签标签
async function saveBookmarkTags(bookmarkTags) {
  await chrome.storage.local.set({ bookmarkTags });
}

// 为书签添加标签
async function addTagsToBookmark(bookmarkId, tags) {
  const bookmarkTags = await getBookmarkTags();
  const existingTags = bookmarkTags[bookmarkId] || [];

  // 合并标签，去重
  const mergedTags = [...new Set([...(existingTags || []), ...(tags || [])])];
  bookmarkTags[bookmarkId] = mergedTags;

  await saveBookmarkTags(bookmarkTags);
  return mergedTags;
}

// 获取书签的标签
async function getBookmarkTagsById(bookmarkId) {
  const bookmarkTags = await getBookmarkTags();
  return bookmarkTags[bookmarkId] || [];
}

// 搜索书签（按标签或标题/URL）
// 🔥 已更新：支持 alias 展开（通过 TagIndex）
async function searchBookmarks(query) {
  // 加载新结构数据
  const data = await chrome.storage.local.get(['bookmarkMeta', 'tagsById']);
  const bookmarkMeta = data.bookmarkMeta || {};
  const tagsById = data.tagsById || {};

  // 向后兼容：如果新结构没有数据，使用旧的 bookmarkTags
  const legacyData = await chrome.storage.local.get('bookmarkTags');
  const bookmarkTags = legacyData.bookmarkTags || {};

  const results = [];
  const q = (query || '').trim().toLowerCase();

  // 🔥 构建 TagIndex（如果存在 tagsById）
  let tagIndex = null;
  if (tagsById && Object.keys(tagsById).length > 0) {
    // 假设 TagIndex 已在某个地方定义（通过 importScripts）
    if (typeof TagIndex !== 'undefined') {
      tagIndex = new TagIndex(tagsById);
    }
  }

  // 如果查询的是标签，尝试解析为 tagId（alias 展开）
  const queriedTagIds = new Set();
  if (q && tagIndex) {
    const resolvedId = tagIndex.resolve(q);
    if (resolvedId) {
      queriedTagIds.add(resolvedId);
    }
  }

  // 递归搜索书签树
  async function searchTree(nodes) {
    for (const node of nodes) {
      if (node.url) {
        // 优先使用新结构
        let tagIds = [];
        let tags = [];

        if (bookmarkMeta[node.id]) {
          tagIds = bookmarkMeta[node.id].tagIds || [];
          // 展开标签名用于显示
          tags = tagIds.map(id => tagsById[id]?.name || '').filter(Boolean);
        } else {
          // 向后兼容：旧结构
          tags = bookmarkTags[node.id] || [];
        }

        const title = (node.title || '').toLowerCase();
        const url = (node.url || '').toLowerCase();

        // 🔥 检查书签是否包含查询的标签（alias 展开）
        const hasQueriedTag = tagIds.some(id => queriedTagIds.has(id));

        // 简单相关度：标题命中 > 标签命中（含 alias） > URL 命中 > 其他
        let score = 0;
        if (!q) score = 1; // 空查询：全量返回
        else {
          if (title.includes(q)) score += 3;
          if (hasQueriedTag) score += 2;  // 🔥 标签命中（包含 alias）
          if (url.includes(q)) score += 1;
        }

        if (!q || score > 0) {
          results.push({
            id: node.id,
            title: node.title,
            url: node.url,
            tags,
            dateAdded: node.dateAdded,
            _score: score,
          });
        }
      }

      if (node.children) {
        await searchTree(node.children);
      }
    }
  }

  const entireTree = await chrome.bookmarks.getTree();
  await searchTree(entireTree);

  // 排序：先 score 再按 dateAdded（新一点优先）
  results.sort((a, b) => {
    if (b._score !== a._score) return b._score - a._score;
    return (b.dateAdded || 0) - (a.dateAdded || 0);
  });

  // 清理内部字段
  return results.map(({ _score, ...rest }) => rest);
}

// 获取所有书签（用于批量处理）
async function getAllBookmarks() {
  const results = [];

  async function collectBookmarks(nodes) {
    for (const node of nodes) {
      if (node.url) results.push(node);
      if (node.children) await collectBookmarks(node.children);
    }
  }

  const entireTree = await chrome.bookmarks.getTree();
  await collectBookmarks(entireTree);

  return results;
}
