/**
 * Background Service Worker
 * 监听书签事件并自动分类
 */

// 导入工具函数
importScripts('utils/storage.js');
importScripts('utils/tagNormalizer.js');
importScripts('utils/tagIndex.js');  // 🔥 必须在 classifier.js 之前（包含 CANONICAL_MAP）
importScripts('utils/classifier.js');
importScripts('utils/tagResolver.js');

// 监听书签创建事件
chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
  console.log('新书签已创建:', bookmark);

  if (!bookmark.url) return; // 忽略文件夹

  try {
    // 自动分类
    const suggestedTags = await classifyBookmark(bookmark);

    if (suggestedTags.length > 0) {
      // 🔥 关键改动：走 resolveTag 统一入口
      const tagIds = [];
      const duplicateWarnings = [];

      for (const tag of suggestedTags) {
        const { tagId, similar } = await resolveTag(tag, {
          createIfNotFound: true  // 自动创建（AI 的标签通常是可信的）
        });

        if (tagId) {
          tagIds.push(tagId);
        }

        // 记录相似标签警告
        if (similar && similar.length > 0) {
          duplicateWarnings.push({
            suggested: tag,
            existing: similar.map(t => t.name)
          });
          console.log(`[TagPilot] 标签 "${tag}" 与现有标签相似:`, similar.map(t => t.name));
        }
      }

      // 保存到 bookmarkMeta（新结构）
      const data = await chrome.storage.local.get('bookmarkMeta');
      const bookmarkMeta = data.bookmarkMeta || {};
      bookmarkMeta[id] = {
        tagIds,
        updatedAt: Date.now()
      };
      await chrome.storage.local.set({ bookmarkMeta });

      console.log(`已为 "${bookmark.title}" 添加标签:`, suggestedTags);

      // 页面内浮层提示（可手动修正标签）
      await showTagOverlayForBookmark(bookmark, suggestedTags);
    }
  } catch (error) {
    console.error('自动分类失败:', error);
  } finally {
    notifyPopupRefresh();
  }
});

// 监听书签移除事件
chrome.bookmarks.onRemoved.addListener(async (id, removeInfo) => {
  console.log('书签已移除:', id);

  // 清理旧标签数据（向后兼容）
  const bookmarkTags = await getBookmarkTags();
  delete bookmarkTags[id];
  await saveBookmarkTags(bookmarkTags);

  // 清理新 bookmarkMeta 数据
  const data = await chrome.storage.local.get('bookmarkMeta');
  const bookmarkMeta = data.bookmarkMeta || {};
  delete bookmarkMeta[id];
  await chrome.storage.local.set({ bookmarkMeta });

  notifyPopupRefresh();
});

// 监听书签更改事件
chrome.bookmarks.onChanged.addListener(async (id, changeInfo) => {
  console.log('书签已更改:', id, changeInfo);

  // 如果标题或 URL 改变，重新分类
  if (changeInfo.title || changeInfo.url) {
    try {
      const bookmark = await chrome.bookmarks.get(id);
      if (bookmark[0] && bookmark[0].url) {
        const suggestedTags = await classifyBookmark(bookmark[0]);

        if (suggestedTags.length > 0) {
          // 使用 resolveTag 统一入口
          const tagIds = [];
          for (const tag of suggestedTags) {
            const { tagId } = await resolveTag(tag, { createIfNotFound: true });
            if (tagId) tagIds.push(tagId);
          }

          // 保存到 bookmarkMeta
          const data = await chrome.storage.local.get('bookmarkMeta');
          const bookmarkMeta = data.bookmarkMeta || {};
          bookmarkMeta[id] = {
            tagIds,
            updatedAt: Date.now()
          };
          await chrome.storage.local.set({ bookmarkMeta });

          console.log(`已更新 "${bookmark[0].title}" 的标签:`, suggestedTags);
        }
      }
    } catch (error) {
      console.error('重新分类失败:', error);
    } finally {
      notifyPopupRefresh();
    }
  }
});

// 处理来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'batchClassify') {
    handleBatchClassify().then(sendResponse);
    return true; // 异步响应
  }

  if (request.action === 'getConfig') {
    getConfig().then(sendResponse);
    return true;
  }

  if (request.action === 'saveConfig') {
    saveConfig(request.config).then(() => sendResponse({ success: true }));
    return true;
  }

  if (request.action === 'testConfig') {
    handleTestConfig(request.config).then(sendResponse);
    return true;
  }

  if (request.action === 'getStats') {
    getStats().then(sendResponse);
    return true;
  }

  // 🔥 新增：标签管理相关
  if (request.action === 'mergeTags') {
    handleMergeTags(request.sourceId, request.targetId).then(sendResponse);
    return true;
  }

  if (request.action === 'deleteTag') {
    handleDeleteTag(request.tagId).then(sendResponse);
    return true;
  }

  if (request.action === 'updateBookmarkTags') {
    handleUpdateBookmarkTags(request.bookmarkId, request.tags).then(sendResponse);
    return true;
  }

  if (request.action === 'suggestTags') {
    handleSuggestTags(request.query).then(sendResponse);
    return true;
  }
});

// 批量处理现有书签
async function handleBatchClassify() {
  console.log('开始批量分类...');

  try {
    const config = await getConfig();
    const bookmarks = await getAllBookmarks();
    const bookmarkTags = await getBookmarkTags();

    let processed = 0;
    let tagged = 0;
    let errors = 0;
    const maxToProcess = config.debug ? 5 : Infinity;

    for (const bookmark of bookmarks) {
      if (processed >= maxToProcess) {
        break;
      }
      // 跳过已经有标签的书签（新结构）
      const data = await chrome.storage.local.get('bookmarkMeta');
      const bookmarkMeta = data.bookmarkMeta || {};
      if (bookmarkMeta[bookmark.id] && bookmarkMeta[bookmark.id].tagIds.length > 0) {
        processed++;
        continue;
      }

      // 向后兼容：如果旧结构有标签，也跳过
      if (bookmarkTags[bookmark.id] && bookmarkTags[bookmark.id].length > 0) {
        processed++;
        continue;
      }

      try {
        const suggestedTags = await classifyBookmark(bookmark);

        if (suggestedTags.length > 0) {
          // 使用 resolveTag 统一入口
          const tagIds = [];
          for (const tag of suggestedTags) {
            const { tagId } = await resolveTag(tag, { createIfNotFound: true });
            if (tagId) tagIds.push(tagId);
          }

          // 保存到 bookmarkMeta
          bookmarkMeta[bookmark.id] = {
            tagIds,
            updatedAt: Date.now()
          };
          await chrome.storage.local.set({ bookmarkMeta });

          console.log(`[TagPilot] ✓ 已分类: "${bookmark.title}" -> ${suggestedTags.join(', ')}`);
          tagged++;

          // 实时通知 popup 更新进度
          try {
            await chrome.runtime.sendMessage({
              action: 'updateProgress',
              processed: processed + 1,
              tagged: tagged,
              total: bookmarks.length
            });
          } catch (e) {
            // popup 可能未打开，忽略
          }
        } else {
          console.log(`[TagPilot] ⚠ 未生成标签: "${bookmark.title}"`);
        }

        processed++;

        // 每处理 5 个书签，延迟一下避免 API 限流
        if (processed % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`[TagPilot] ✗ 分类失败: ${bookmark.title}`, error);
        errors++;
        processed++;
      }
    }

    console.log(`批量分类完成: 处理 ${processed} 个，成功 ${tagged} 个，失败 ${errors} 个`);

    // 通知 popup 刷新结果
    try {
      // 尝试向扩展的 popup 发送刷新消息
      await chrome.runtime.sendMessage({
        action: 'refreshResults'
      });
    } catch (e) {
      // popup 可能没有打开，忽略错误
      console.log('Popup 未打开，跳过刷新通知');
    }

    return {
      success: true,
      processed,
      tagged,
      errors
    };
  } catch (error) {
    console.error('批量分类失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 测试 API 配置
async function handleTestConfig(config) {
  const { apiEndpoint, openaiApiKey, model } = config;

  const baseUrl = apiEndpoint || 'https://api.openai.com/v1';
  const apiUrl = `${baseUrl}/chat/completions`;

  const startTime = Date.now();

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'user', content: 'Hi' }
        ],
        max_tokens: 10
      })
    });

    const latency = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error?.message || response.statusText
      };
    }

    const data = await response.json();

    return {
      success: true,
      model: data.model || model,
      latency: latency
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// 获取统计信息
async function getStats() {
  const bookmarks = await getAllBookmarks();
  const totalBookmarks = bookmarks.length;

  // 优先使用新数据结构
  const data = await chrome.storage.local.get(['bookmarkMeta', 'tagsById']);
  const bookmarkMeta = data.bookmarkMeta || {};
  const tagsById = data.tagsById || {};

  // 统计已标签的书签数量
  const taggedBookmarks = Object.keys(bookmarkMeta).filter(
    id => bookmarkMeta[id] && bookmarkMeta[id].tagIds && bookmarkMeta[id].tagIds.length > 0
  ).length;

  // 统计所有标签（使用新结构）
  const tagCounts = {};
  for (const [bookmarkId, meta] of Object.entries(bookmarkMeta)) {
    const tagIds = meta.tagIds || [];
    for (const tagId of tagIds) {
      const tag = tagsById[tagId];
      if (tag) {
        const tagName = tag.name;
        tagCounts[tagName] = (tagCounts[tagName] || 0) + 1;
      }
    }
  }

  // 热门标签
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));

  return {
    totalBookmarks,
    taggedBookmarks,
    untaggedBookmarks: totalBookmarks - taggedBookmarks,
    totalTags: Object.keys(tagCounts).length,
    topTags
  };
}

// 扩展安装时初始化
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('Smart Bookmarks 已安装');

    // 打开设置页面
    chrome.tabs.create({
      url: chrome.runtime.getURL('popup.html?action=setup')
    });
  }
});

async function notifyPopupRefresh() {
  try {
    await chrome.runtime.sendMessage({ action: 'refreshUI' });
  } catch (error) {
    // popup/side panel 可能未打开，忽略
  }
}

async function showTagOverlayForBookmark(bookmark, suggestedTags) {
  if (!bookmark || !bookmark.url) return;

  let tab = null;
  try {
    const matched = await chrome.tabs.query({ url: bookmark.url });
    if (matched && matched.length > 0) {
      tab = matched[0];
    }
  } catch (error) {
    console.warn('查找书签标签页失败:', error);
  }

  if (!tab) {
    try {
      const activeTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const active = activeTabs.find(t => t.url === bookmark.url);
      if (active) {
        tab = active;
      }
    } catch (error) {
      console.warn('获取活动标签页失败:', error);
    }
  }

  if (!tab || !tab.id) return;
  if (!tab.url || !/^https?:\/\//i.test(tab.url)) return;

  const payload = {
    action: 'showTagOverlay',
    payload: {
      bookmark: {
        id: bookmark.id,
        title: bookmark.title || '',
        url: bookmark.url || ''
      },
      tags: suggestedTags || []
    }
  };

  try {
    await chrome.tabs.sendMessage(tab.id, payload);
  } catch (error) {
    setTimeout(() => {
      chrome.tabs.sendMessage(tab.id, payload).catch(() => {});
    }, 500);
  }
}

async function handleUpdateBookmarkTags(bookmarkId, tagNames) {
  if (!bookmarkId) {
    return { success: false, error: '缺少书签 ID' };
  }

  const names = Array.isArray(tagNames) ? tagNames : [];
  const tagIds = [];

  for (const name of names) {
    const trimmed = String(name || '').trim();
    if (!trimmed) continue;
    const { tagId } = await resolveTag(trimmed, { createIfNotFound: true });
    if (tagId) tagIds.push(tagId);
  }

  const uniqueTagIds = Array.from(new Set(tagIds));
  const data = await chrome.storage.local.get('bookmarkMeta');
  const bookmarkMeta = data.bookmarkMeta || {};
  bookmarkMeta[bookmarkId] = {
    tagIds: uniqueTagIds,
    updatedAt: Date.now()
  };
  await chrome.storage.local.set({ bookmarkMeta });

  notifyPopupRefresh();
  return { success: true, tagIds: uniqueTagIds };
}

async function handleSuggestTags(rawQuery) {
  const query = String(rawQuery || '').trim();
  if (!query) {
    return { exact: null, similar: [] };
  }

  const data = await chrome.storage.local.get('tagsById');
  const tagsById = data.tagsById || {};
  if (!tagsById || Object.keys(tagsById).length === 0) {
    return { exact: null, similar: [] };
  }

  const index = new TagIndex(tagsById);
  const exactId = index.resolve(query);
  const exact = exactId ? tagsById[exactId]?.name || null : null;

  const similar = index.findSimilar(query, 5)
    .map(tag => tag?.name)
    .filter(Boolean)
    .filter(name => name !== exact);

  return { exact, similar };
}

// 点击扩展图标时打开侧边栏；旧版 Chrome 回退到新标签页
chrome.action.onClicked.addListener((tab) => {
  if (chrome.sidePanel && chrome.sidePanel.open) {
    try {
      chrome.sidePanel.open({ windowId: tab.windowId }, () => {
        if (chrome.runtime.lastError) {
          console.warn('打开侧边栏失败，回退到新标签页:', chrome.runtime.lastError);
          chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
        }
      });
      return;
    } catch (error) {
      console.warn('打开侧边栏失败，回退到新标签页:', error);
    }
  }

  chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
});


// 🔥 P1: 合并标签
// 将 sourceId 标签合并到 targetId
async function handleMergeTags(sourceId, targetId) {
  console.log(`[TagPilot] 合并标签: ${sourceId} → ${targetId}`);

  try {
    const data = await chrome.storage.local.get(['tagsById', 'bookmarkMeta']);
    const tagsById = data.tagsById || {};
    const bookmarkMeta = data.bookmarkMeta || {};

    const sourceTag = tagsById[sourceId];
    const targetTag = tagsById[targetId];

    if (!sourceTag || !targetTag) {
      return { success: false, error: '标签不存在' };
    }

    // 1. 将 source 的 aliases 合并到 target（去重）
    const sourceAliases = sourceTag.aliases || [];
    const targetAliases = targetTag.aliases || [];
    const mergedAliases = Array.from(new Set([...targetAliases, ...sourceAliases]));

    tagsById[targetId].aliases = mergedAliases;
    tagsById[targetId].updatedAt = Date.now();

    // 2. 更新所有书签：把 sourceId 替换成 targetId
    let affectedBookmarks = 0;
    for (const [bookmarkId, meta] of Object.entries(bookmarkMeta)) {
      const tagIds = meta.tagIds || [];
      if (tagIds.includes(sourceId)) {
        // 替换 sourceId 为 targetId
        const newTagIds = tagIds.map(id => id === sourceId ? targetId : id);
        // 去重
        bookmarkMeta[bookmarkId].tagIds = Array.from(new Set(newTagIds));
        bookmarkMeta[bookmarkId].updatedAt = Date.now();
        affectedBookmarks++;
      }
    }

    // 3. 删除 source tag
    delete tagsById[sourceId];

    // 4. 保存
    await chrome.storage.local.set({ tagsById, bookmarkMeta });

    console.log(`[TagPilot] 合并完成: "${sourceTag.name}" → "${targetTag.name}", 影响 ${affectedBookmarks} 个书签`);

    return {
      success: true,
      affectedBookmarks,
      sourceTagName: sourceTag.name,
      targetTagName: targetTag.name
    };
  } catch (error) {
    console.error('[TagPilot] 合并标签失败:', error);
    return { success: false, error: error.message };
  }
}

// 🔥 P1: 删除标签
async function handleDeleteTag(tagId) {
  console.log(`[TagPilot] 删除标签: ${tagId}`);

  try {
    const data = await chrome.storage.local.get(['tagsById', 'bookmarkMeta']);
    const tagsById = data.tagsById || {};
    const bookmarkMeta = data.bookmarkMeta || {};

    const tag = tagsById[tagId];
    if (!tag) {
      return { success: false, error: '标签不存在' };
    }

    // 1. 从所有书签中移除该标签
    let affectedBookmarks = 0;
    for (const [bookmarkId, meta] of Object.entries(bookmarkMeta)) {
      const tagIds = meta.tagIds || [];
      if (tagIds.includes(tagId)) {
        bookmarkMeta[bookmarkId].tagIds = tagIds.filter(id => id !== tagId);
        bookmarkMeta[bookmarkId].updatedAt = Date.now();
        affectedBookmarks++;
      }
    }

    // 2. 删除 tag
    delete tagsById[tagId];

    // 3. 保存
    await chrome.storage.local.set({ tagsById, bookmarkMeta });

    console.log(`[TagPilot] 删除完成: "${tag.name}", 影响 ${affectedBookmarks} 个书签`);

    return {
      success: true,
      affectedBookmarks,
      tagName: tag.name
    };
  } catch (error) {
    console.error('[TagPilot] 删除标签失败:', error);
    return { success: false, error: error.message };
  }
}
