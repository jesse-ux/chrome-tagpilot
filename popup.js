/**
 * Popup 界面逻辑
 */

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('searchInput').addEventListener('input', debounce(handleSearch, 300));
  document.getElementById('batchBtn').addEventListener('click', handleBatchClassify);
  document.getElementById('settingsBtn').addEventListener('click', () => setActiveView('settings'));
  document.getElementById('backToListBtn').addEventListener('click', () => setActiveView('list'));
  document.getElementById('saveConfigBtn').addEventListener('click', savePopupConfig);
  document.getElementById('testConfigBtn').addEventListener('click', testConfig);
  document.getElementById('openTagManageBtn').addEventListener('click', openTagManageModal);
  document.getElementById('closeTagManageBtn').addEventListener('click', closeTagManageModal);
  document.getElementById('tagManageDoneBtn').addEventListener('click', closeTagManageModal);

  // 🔥 新增：标签管理相关
  document.getElementById('addTagBtn').addEventListener('click', handleAddTag);
  document.getElementById('newTagInput').addEventListener('input', debounce(handleTagInput, 150));
  document.getElementById('newTagInput').addEventListener('keydown', handleTagInputKeydown);

  // 🔥 标签编辑弹窗相关
  document.getElementById('closeModalBtn').addEventListener('click', closeEditModal);
  document.getElementById('modalCancelBtn').addEventListener('click', closeEditModal);
  document.getElementById('modalSaveBtn').addEventListener('click', saveBookmarkTags);
  document.getElementById('modalAddTagBtn').addEventListener('click', handleModalAddTag);
  document.getElementById('modalTagInput').addEventListener('input', debounce(handleModalTagInput, 150));
  document.getElementById('modalTagInput').addEventListener('keydown', handleModalTagInputKeydown);

  // 加载配置
  const config = await loadConfig();
  if (config?.openaiApiKey) {
    setActiveView('list');
    await refreshListUI('', { refreshTags: true });
  } else {
    setActiveView('settings');
  }
});

// 防抖函数
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

let noticeTimer;

function showNotice(message, type = 'info', timeout = 2500) {
  const notice = document.getElementById('notice');
  if (!notice) return;

  notice.textContent = message;
  notice.classList.remove('hidden', 'success', 'error');
  if (type && type !== 'info') {
    notice.classList.add(type);
  }

  clearTimeout(noticeTimer);
  if (timeout > 0) {
    noticeTimer = setTimeout(() => {
      notice.classList.add('hidden');
    }, timeout);
  }
}

// 加载统计信息
async function loadStats() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getStats' });
    const stats = await response;

    const taggedPercent = stats.totalBookmarks > 0
      ? Math.round((stats.taggedBookmarks / stats.totalBookmarks) * 100)
      : 0;

    document.getElementById('stats').textContent =
      `TOTAL: ${stats.totalBookmarks} | INDEXED: ${stats.taggedBookmarks} (${taggedPercent}%)`;
  } catch (error) {
    console.error('加载统计失败:', error);
  }
}

// 更新统计显示（用于批量处理时的实时更新）
function updateStatsDisplay(processed, tagged, total) {
  const taggedPercent = total > 0 ? Math.round((tagged / total) * 100) : 0;
  document.getElementById('stats').textContent =
    `TOTAL: ${total} | INDEXED: ${tagged} (${taggedPercent}%) | PROCESSING: ${processed}`;
  updateProgressBar(processed, total);
}

function updateProgressBar(processed, total) {
  const progressWrap = document.getElementById('progressWrap');
  const progressBarFill = document.getElementById('progressBarFill');
  const progressText = document.getElementById('progressText');

  if (!progressWrap || !progressBarFill || !progressText) {
    return;
  }

  if (!total) {
    progressWrap.classList.add('hidden');
    progressBarFill.style.width = '0%';
    progressText.textContent = 'PROCESSING: 0/0 (0%)';
    return;
  }

  progressWrap.classList.remove('hidden');
  const percent = Math.min(100, Math.round((processed / total) * 100));
  progressBarFill.style.width = `${percent}%`;
  progressText.textContent = `PROCESSING: ${processed}/${total} (${percent}%)`;
}

function setActiveView(view) {
  const listView = document.getElementById('listView');
  const settingsView = document.getElementById('settingsView');
  if (!listView || !settingsView) return;

  if (view === 'settings') {
    listView.classList.remove('active');
    settingsView.classList.add('active');
  } else {
    settingsView.classList.remove('active');
    listView.classList.add('active');
  }
}

async function refreshListUI(query, options = {}) {
  const { refreshTags = false } = options;
  await loadStats();
  if (refreshTags) {
    await loadPopularTags();
  }
  await searchBookmarks(query ?? document.getElementById('searchInput').value);
}

// 加载热门标签
async function loadPopularTags() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getStats' });
    const stats = await response;

    const filterTagsContainer = document.getElementById('filterTags');
    filterTagsContainer.innerHTML = '';

    if (!stats.topTags || stats.topTags.length === 0) {
      filterTagsContainer.innerHTML = `
        <div style="color: var(--text-muted); font-size: 11px; padding: 6px 0;">
          暂无标签，请先在标签管理里创建
        </div>
      `;
      return;
    }

    stats.topTags.forEach(({ tag }) => {
      const tagEl = document.createElement('div');
      tagEl.className = 'filter-tag';
      tagEl.dataset.tag = tag;
      tagEl.textContent = `${tag}`;
      tagEl.addEventListener('click', () => filterByTag(tag));
      filterTagsContainer.appendChild(tagEl);
    });
  } catch (error) {
    console.error('加载标签失败:', error);
  }
}

// 搜索书签
async function handleSearch(event) {
  const query = event.target.value;
  await searchBookmarks(query);
}

async function searchBookmarks(query) {
  const resultsContainer = document.getElementById('results');

  try {
    // 直接调用搜索函数，不通过消息传递
    const results = await searchBookmarksInStorage(query);

    if (results.length === 0) {
      resultsContainer.innerHTML = `
        <div class="no-results">
          NO_MATCHES
        </div>
      `;
      return;
    }

    resultsContainer.innerHTML = results.map(bookmark => `
      <div class="bookmark-item" data-url="${escapeHtml(bookmark.url)}" data-id="${escapeHtml(bookmark.id)}">
        <div class="bookmark-title">
          ${escapeHtml(bookmark.title)}
        </div>
        <button class="bookmark-edit-btn" data-id="${escapeHtml(bookmark.id)}">编辑</button>
        <div class="bookmark-url">${escapeHtml(bookmark.url)}</div>
        <div class="bookmark-tags">
          ${(bookmark.tags || []).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
        </div>
      </div>
    `).join('');

    // 绑定点击事件
    document.querySelectorAll('.bookmark-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // 如果点击的是编辑按钮，不打开书签
        if (e.target.classList.contains('bookmark-edit-btn')) {
          e.stopPropagation();
          return;
        }
        const url = item.dataset.url;
        chrome.tabs.create({ url });
      });
    });

    // 绑定编辑按钮事件
    document.querySelectorAll('.bookmark-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const bookmarkId = btn.dataset.id;
        openEditModal(bookmarkId);
      });
    });
  } catch (error) {
    console.error('搜索失败:', error);
    resultsContainer.innerHTML = `
      <div class="no-results">
        SYSTEM_ERROR
      </div>
    `;
  }
}

// 按标签过滤
function filterByTag(tag) {
  const searchInput = document.getElementById('searchInput');
  const activeTag = document.querySelector('.filter-tag.active');
  const isSameTag = activeTag && activeTag.dataset.tag === tag;

  if (isSameTag) {
    searchInput.value = '';
    searchBookmarks('');
  } else {
    searchInput.value = tag;
    searchBookmarks(tag);
  }

  // 更新标签激活状态
  document.querySelectorAll('.filter-tag').forEach(tagEl => {
    const shouldActivate = !isSameTag && tagEl.dataset.tag === tag;
    tagEl.classList.toggle('active', shouldActivate);
  });
}

// 批量分类
async function handleBatchClassify() {
  const batchBtn = document.getElementById('batchBtn');
  const originalText = batchBtn.textContent;
  let dotCount = 0;
  let dotTimer;

  const baseText = 'PROCESSING';
  batchBtn.textContent = `${baseText}...`;
  batchBtn.disabled = true;
  dotTimer = setInterval(() => {
    dotCount = (dotCount + 1) % 4;
    const dots = '.'.repeat(dotCount);
    batchBtn.textContent = `${baseText}${dots}`;
  }, 400);

  try {
    const response = await chrome.runtime.sendMessage({ action: 'batchClassify' });
    const result = await response;

    if (result.success) {
      const summary = `批量完成：处理 ${result.processed}，已标注 ${result.tagged}，失败 ${result.errors}`;
      showNotice(summary, result.errors ? 'error' : 'success', 5000);

      // 刷新统计
      await loadStats();

      // 刷新搜索结果
      const searchInput = document.getElementById('searchInput');
      await searchBookmarks(searchInput.value);
    } else {
      showNotice(`批量失败：${result.error}`, 'error', 5000);
    }
  } catch (error) {
    console.error('批量分类失败:', error);
    showNotice(`批量失败：${error.message}`, 'error', 5000);
  } finally {
    clearInterval(dotTimer);
    batchBtn.textContent = originalText;
    batchBtn.disabled = false;
  }
}

// 切换设置面板
// 加载配置
async function loadConfig() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getConfig' });
    const config = await response;

    document.getElementById('apiEndpoint').value = config.apiEndpoint || '';
    document.getElementById('apiKey').value = config.openaiApiKey || '';
    document.getElementById('model').value = config.model || 'gpt-4o-mini';
    document.getElementById('debugLog').checked = !!config.debug;
    document.getElementById('debugEvidence').checked = !!config.debugEvidence;
    updateProgressBar(0, 0);
    return config;
  } catch (error) {
    console.error('加载配置失败:', error);
    return null;
  }
}

// 测试配置
async function testConfig() {
  const config = {
    apiEndpoint: document.getElementById('apiEndpoint').value.trim(),
    openaiApiKey: document.getElementById('apiKey').value.trim(),
    model: document.getElementById('model').value.trim(),
  };

  if (!config.openaiApiKey) {
    showNotice('请先填写 API Key', 'error', 4000);
    return;
  }

  if (!config.model) {
    showNotice('请填写模型名称', 'error', 4000);
    return;
  }

  const testBtn = document.getElementById('testConfigBtn');
  const originalText = testBtn.textContent;
  testBtn.textContent = '[TESTING...]';
  testBtn.disabled = true;

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'testConfig',
      config
    });

    if (response.success) {
      showNotice(`测试成功：${response.model}，${response.latency}ms`, 'success', 3000);
    } else {
      showNotice(`测试失败：${response.error}`, 'error', 5000);
    }
  } catch (error) {
    console.error('测试配置失败:', error);
    showNotice(`测试失败：${error.message}`, 'error', 5000);
  } finally {
    testBtn.textContent = originalText;
    testBtn.disabled = false;
  }
}

// 保存配置
async function savePopupConfig() {
  const apiEndpoint = document.getElementById('apiEndpoint').value.trim();
  const openaiApiKey = document.getElementById('apiKey').value.trim();
  const model = document.getElementById('model').value.trim();
  const debug = document.getElementById('debugLog').checked;
  const debugEvidence = document.getElementById('debugEvidence').checked;

  if (!openaiApiKey) {
    showNotice('请先填写 API Key', 'error', 4000);
    return;
  }

  try {
    const current = await chrome.runtime.sendMessage({ action: 'getConfig' });
    const config = {
      ...current,
      apiEndpoint,
      openaiApiKey,
      model,
      debug,
      debugEvidence,
      autoTag: true,
      maxRetries: 3,
      language: 'zh-CN'
    };

    await chrome.runtime.sendMessage({
      action: 'saveConfig',
      config
    });

    const saveBtn = document.getElementById('saveConfigBtn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = `已保存：${model || '默认模型'}`;
    setTimeout(() => {
      saveBtn.textContent = originalText;
    }, 1500);
    showNotice(`配置已保存：${model || '默认模型'}`, 'success', 2000);

    setActiveView('list');
    await refreshListUI('', { refreshTags: true });
  } catch (error) {
    console.error('保存配置失败:', error);
    showNotice(`保存失败：${error.message}`, 'error', 5000);
  }
}

// 搜索书签（包装函数，用于调用 storage.js 中的函数）
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'searchBookmarks') {
    searchBookmarksInStorage(request.query).then(sendResponse);
    return true;
  }

  if (request.action === 'refreshResults') {
    refreshListUI();
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'updateProgress') {
    // 实时更新进度
    updateStatsDisplay(request.processed, request.tagged, request.total);
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'refreshUI') {
    refreshListUI();
    sendResponse({ success: true });
    return true;
  }
});

// 在 storage 中搜索（复制自 storage.js 的 searchBookmarks 逻辑）
async function searchBookmarksInStorage(query) {
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

// 🔥 ==================== 标签管理功能 ====================

let deleteConfirmTimer = null;

function openTagManageModal() {
  const modal = document.getElementById('tagManageModal');
  if (!modal) return;
  modal.classList.remove('modal-hidden');
  modal.classList.add('modal-visible');
  loadTagList();
  const input = document.getElementById('newTagInput');
  if (input) {
    input.value = '';
    input.focus();
  }
}

function closeTagManageModal() {
  const modal = document.getElementById('tagManageModal');
  if (!modal) return;
  modal.classList.remove('modal-visible');
  modal.classList.add('modal-hidden');
  const autocomplete = document.getElementById('tagAutocomplete');
  if (autocomplete) {
    autocomplete.style.display = 'none';
  }
}

/**
 * 加载并显示所有标签
 */
async function loadTagList() {
  const tagList = document.getElementById('tagList');
  if (!tagList) return;

  const data = await chrome.storage.local.get(['tagsById', 'bookmarkMeta']);
  const tagsById = data.tagsById || {};
  const bookmarkMeta = data.bookmarkMeta || {};

  // 统计每个标签的使用次数
  const tagUsage = {};
  for (const [bookmarkId, meta] of Object.entries(bookmarkMeta)) {
    const tagIds = meta.tagIds || [];
    for (const tagId of tagIds) {
      tagUsage[tagId] = (tagUsage[tagId] || 0) + 1;
    }
  }

  // 按使用次数排序
  const sortedTags = Object.entries(tagsById)
    .map(([id, tag]) => ({ ...tag, id, usage: tagUsage[id] || 0 }))
    .sort((a, b) => b.usage - a.usage);

  if (sortedTags.length === 0) {
    tagList.innerHTML = '<div style="color: var(--text-muted); padding: 8px;">暂无标签</div>';
    return;
  }

  if (deleteConfirmTimer) {
    clearTimeout(deleteConfirmTimer);
    deleteConfirmTimer = null;
  }

  tagList.innerHTML = sortedTags.map(tag => `
    <div class="tag-item" data-tag-id="${tag.id}" data-tag-name="${escapeHtml(tag.name)}" style="display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; border-bottom: 1px solid var(--border); margin-bottom: 4px; gap: 8px;">
      <div class="tag-item-display" style="flex: 1;">
        <span class="tag" style="display: inline-block; padding: 2px 8px; background: var(--accent-dim); color: var(--accent); border-radius: 3px; font-size: 12px;">${escapeHtml(tag.name)}</span>
        <span style="margin-left: 8px; color: var(--text-muted); font-size: 12px;">${tag.usage} 个书签</span>
        ${tag.aliases && tag.aliases.length > 0 ? `<span style="margin-left: 8px; color: var(--text-muted); font-size: 11px;">别名: ${tag.aliases.map(a => escapeHtml(a)).join(', ')}</span>` : ''}
      </div>
      <div class="tag-item-edit" style="flex: 1; display: none; position: relative;">
        <input class="tag-edit-input tag-manage-input" type="text" value="${escapeHtml(tag.name)}">
        <div class="tag-edit-suggest hidden"></div>
      </div>
      <div class="tag-item-actions" style="display: flex; gap: 6px; flex-shrink: 0;">
        <button class="btn-edit-tag tag-action-btn" data-tag-id="${tag.id}">修改</button>
        <button class="btn-save-tag tag-action-btn tag-save-btn" data-tag-id="${tag.id}" style="display: none;">保存</button>
        <button class="btn-cancel-edit tag-action-btn" data-tag-id="${tag.id}" style="display: none;">取消</button>
        <button class="btn-delete-tag tag-action-btn tag-delete-btn" data-tag-id="${tag.id}" data-tag-name="${escapeHtml(tag.name)}">删除</button>
      </div>
    </div>
  `).join('');

  const resetDeleteButtons = () => {
    tagList.querySelectorAll('.btn-delete-tag').forEach(btn => {
      if (btn.dataset.armed === 'true') {
        btn.dataset.armed = 'false';
        btn.textContent = '删除';
        btn.classList.remove('tag-delete-armed');
      }
    });
    if (deleteConfirmTimer) {
      clearTimeout(deleteConfirmTimer);
      deleteConfirmTimer = null;
    }
  };

  tagList.onclick = async (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    const row = button.closest('.tag-item');
    if (!row) return;

    if (button.classList.contains('btn-delete-tag')) {
      const tagId = button.dataset.tagId;
      if (button.dataset.armed === 'true') {
        await handleDeleteTag(tagId);
        await loadTagList();
        await loadPopularTags();
        await refreshListUI();
        return;
      }
      resetDeleteButtons();
      button.dataset.armed = 'true';
      button.textContent = '确认删除';
      button.classList.add('tag-delete-armed');
      deleteConfirmTimer = setTimeout(resetDeleteButtons, 3000);
      return;
    }

    if (button.classList.contains('btn-edit-tag')) {
      resetDeleteButtons();
      setTagRowEditing(row, true);
      const input = row.querySelector('.tag-edit-input');
      input.focus();
      input.select();
      return;
    }

    if (button.classList.contains('btn-cancel-edit')) {
      resetDeleteButtons();
      const input = row.querySelector('.tag-edit-input');
      input.value = row.dataset.tagName || input.value;
      setTagRowEditing(row, false);
      return;
    }

    if (button.classList.contains('btn-save-tag')) {
      resetDeleteButtons();
      await commitTagRename(row);
    }
  };

  tagList.onkeydown = async (event) => {
    const input = event.target;
    if (!input.classList.contains('tag-edit-input')) return;
    const row = input.closest('.tag-item');

    if (event.key === 'Enter') {
      event.preventDefault();
      await commitTagRename(row);
    } else if (event.key === 'Escape') {
      input.value = row.dataset.tagName || input.value;
      setTagRowEditing(row, false);
    }
  };

  tagList.oninput = (event) => {
    const input = event.target;
    if (!input.classList.contains('tag-edit-input')) return;
    handleTagEditSuggest(input);
  };
}

function handleTagEditSuggest(input) {
  if (input._suggestTimer) {
    clearTimeout(input._suggestTimer);
  }

  const row = input.closest('.tag-item');
  const suggest = row ? row.querySelector('.tag-edit-suggest') : null;
  const query = input.value.trim();

  if (!suggest || !query) {
    if (suggest) {
      suggest.classList.add('hidden');
      suggest.innerHTML = '';
    }
    return;
  }

  input._suggestTimer = setTimeout(async () => {
    try {
      const data = await chrome.storage.local.get('tagsById');
      const tagsById = data.tagsById || {};
      if (!tagsById || Object.keys(tagsById).length === 0) {
        suggest.classList.add('hidden');
        suggest.innerHTML = '';
        return;
      }

      const index = new TagIndex(tagsById);
      const currentTagId = row.dataset.tagId;
      const currentName = row.dataset.tagName || '';
      const exactId = index.resolve(query);
      const exact = exactId ? tagsById[exactId]?.name || '' : '';

      const similar = index.findSimilar(query, 5)
        .map(tag => tag?.name)
        .filter(Boolean)
        .filter(name => name !== exact);

      const items = [];
      if (exact && exact !== currentName) {
        items.push(`<div class="tag-edit-suggest-item" data-tag-name="${escapeHtml(exact)}">已存在：${escapeHtml(exact)}</div>`);
      }
      similar.forEach((name) => {
        if (name !== currentName) {
          items.push(`<div class="tag-edit-suggest-item" data-tag-name="${escapeHtml(name)}">相似：${escapeHtml(name)}</div>`);
        }
      });

      if (!items.length) {
        suggest.classList.add('hidden');
        suggest.innerHTML = '';
        return;
      }

      suggest.innerHTML = items.join('');
      suggest.classList.remove('hidden');
      suggest.querySelectorAll('.tag-edit-suggest-item').forEach((item) => {
        item.addEventListener('click', () => {
          input.value = item.dataset.tagName || input.value;
          suggest.classList.add('hidden');
          suggest.innerHTML = '';
          input.focus();
        });
      });
    } catch (error) {
      suggest.classList.add('hidden');
      suggest.innerHTML = '';
    }
  }, 150);
}

function setTagRowEditing(row, isEditing) {
  if (!row) return;
  const display = row.querySelector('.tag-item-display');
  const edit = row.querySelector('.tag-item-edit');
  const editBtn = row.querySelector('.btn-edit-tag');
  const saveBtn = row.querySelector('.btn-save-tag');
  const cancelBtn = row.querySelector('.btn-cancel-edit');
  const deleteBtn = row.querySelector('.btn-delete-tag');

  if (isEditing) {
    display.style.display = 'none';
    edit.style.display = 'block';
    editBtn.style.display = 'none';
    saveBtn.style.display = 'inline-block';
    cancelBtn.style.display = 'inline-block';
    deleteBtn.style.display = 'none';
    const suggest = row.querySelector('.tag-edit-suggest');
    if (suggest) {
      suggest.classList.add('hidden');
      suggest.innerHTML = '';
    }
  } else {
    display.style.display = 'block';
    edit.style.display = 'none';
    editBtn.style.display = 'inline-block';
    saveBtn.style.display = 'none';
    cancelBtn.style.display = 'none';
    deleteBtn.style.display = 'inline-block';
    const suggest = row.querySelector('.tag-edit-suggest');
    if (suggest) {
      suggest.classList.add('hidden');
      suggest.innerHTML = '';
    }
  }
}

async function commitTagRename(row) {
  if (!row) return;
  const tagId = row.dataset.tagId;
  const input = row.querySelector('.tag-edit-input');
  const nextName = input.value;
  const result = await renameTag(tagId, nextName);
  if (result && result.success) {
    await loadTagList();
    await loadPopularTags();
    await refreshListUI();
  }
}

/**
 * 处理标签输入（自动完成）
 */
let autocompleteDebounce = null;
async function handleTagInput(event) {
  clearTimeout(autocompleteDebounce);

  const input = event.target;
  const query = input.value.trim();
  const autocomplete = document.getElementById('tagAutocomplete');
  input.dataset.resolvedTagId = '';

  if (!query) {
    autocomplete.style.display = 'none';
    return;
  }

  // 延迟 150ms 执行
  autocompleteDebounce = setTimeout(async () => {
    const data = await chrome.storage.local.get('tagsById');
    const tagsById = data.tagsById || {};

    if (Object.keys(tagsById).length === 0) {
      autocomplete.style.display = 'none';
      return;
    }

    const index = new TagIndex(tagsById);

    // 1. 检查精确匹配
    const existingId = index.resolve(query);
    if (existingId) {
      const tag = tagsById[existingId];
      input.dataset.resolvedTagId = existingId;
      autocomplete.innerHTML = `
        <div class="autocomplete-item" data-tag-name="${escapeHtml(tag.name)}" data-tag-id="${existingId}"
          style="padding: 8px; cursor: pointer; border-bottom: 1px solid var(--border); transition: background 0.2s;">
          <span style="color: var(--text-primary);">已存在: ${escapeHtml(tag.name)}</span>
          <span style="margin-left: 8px; color: var(--text-muted); font-size: 12px;">点击选择</span>
        </div>
      `;
      autocomplete.querySelectorAll('.autocomplete-item').forEach(item => {
        item.addEventListener('click', () => {
          input.value = item.dataset.tagName;
          input.dataset.resolvedTagId = item.dataset.tagId || '';
          autocomplete.style.display = 'none';
        });
        item.addEventListener('mouseenter', () => {
          item.style.background = 'var(--bg-tertiary)';
        });
        item.addEventListener('mouseleave', () => {
          item.style.background = 'transparent';
        });
      });
      autocomplete.style.display = 'block';
      return;
    }

    // 2. 查找相似标签
    const similar = index.findSimilar(query, 5);

    if (similar.length > 0) {
      input.dataset.resolvedTagId = '';
      autocomplete.innerHTML = similar.map(tag => `
        <div class="autocomplete-item" data-tag-name="${escapeHtml(tag.name)}" style="padding: 8px; cursor: pointer; border-bottom: 1px solid var(--border); transition: background 0.2s;">
          <span style="color: var(--text-primary);">${escapeHtml(tag.name)}</span>
          <span style="margin-left: 8px; color: var(--text-muted); font-size: 12px;">点击选择</span>
        </div>
      `).join('');

      // 绑定点击事件
      autocomplete.querySelectorAll('.autocomplete-item').forEach(item => {
        item.addEventListener('click', () => {
          input.value = item.dataset.tagName;
          autocomplete.style.display = 'none';
        });
        item.addEventListener('mouseenter', () => {
          item.style.background = 'var(--bg-tertiary)';
        });
        item.addEventListener('mouseleave', () => {
          item.style.background = 'transparent';
        });
      });

      autocomplete.style.display = 'block';
    } else {
      autocomplete.style.display = 'none';
    }
  }, 150);
}

/**
 * 处理键盘事件（回车添加）
 */
function handleTagInputKeydown(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    handleAddTag();
  } else if (event.key === 'Escape') {
    const autocomplete = document.getElementById('tagAutocomplete');
    autocomplete.style.display = 'none';
  }
}

/**
 * 添加新标签
 */
async function handleAddTag() {
  const input = document.getElementById('newTagInput');
  const tagName = input.value.trim();
  const resolvedTagId = input.dataset.resolvedTagId;

  if (!tagName) {
    showNotice('请输入标签名称', 'error', 3000);
    return;
  }

  try {
    if (resolvedTagId) {
      showNotice(`标签 "${tagName}" 已存在`, 'info', 2500);
      input.value = '';
      input.dataset.resolvedTagId = '';
      document.getElementById('tagAutocomplete').style.display = 'none';
      return;
    }

    // 调用 resolveTag 检查是否已存在
    const { tagId, isNew, similar } = await resolveTag(tagName, { createIfNotFound: true });

    if (isNew && similar && similar.length > 0) {
      showNotice(`已创建标签 "${tagName}"，但有 ${similar.length} 个相似标签`, 'success', 4000);
    } else if (isNew) {
      showNotice(`已创建标签 "${tagName}"`, 'success', 3000);
    } else {
      showNotice(`标签 "${tagName}" 已存在`, 'info', 3000);
    }

    // 清空输入框
    input.value = '';
    input.dataset.resolvedTagId = '';
    document.getElementById('tagAutocomplete').style.display = 'none';

    // 刷新标签列表
    await loadTagList();
    await loadPopularTags();
  } catch (error) {
    console.error('添加标签失败:', error);
    showNotice(`添加失败: ${error.message}`, 'error', 4000);
  }
}

/**
 * 修改标签名称（如存在冲突则自动合并）
 */
async function renameTag(tagId, nextName) {
  const name = String(nextName || '').trim();
  if (!name) {
    showNotice('标签名称不能为空', 'error', 3000);
    return { success: false, reason: 'empty' };
  }

  const data = await chrome.storage.local.get('tagsById');
  const tagsById = data.tagsById || {};
  const currentTag = tagsById[tagId];

  if (!currentTag) {
    showNotice('标签不存在', 'error', 3000);
    return { success: false, reason: 'missing' };
  }

  const index = new TagIndex(tagsById);
  const resolvedId = index.resolve(name);

  if (resolvedId && resolvedId !== tagId) {
    const response = await chrome.runtime.sendMessage({
      action: 'mergeTags',
      sourceId: tagId,
      targetId: resolvedId
    });

    if (response && response.success) {
      showNotice(`名称冲突，已合并到 "${response.targetTagName}"`, 'success', 4000);
      return { success: true, merged: true };
    }

    showNotice(`合并失败: ${response?.error || '未知错误'}`, 'error', 4000);
    return { success: false, reason: 'merge-failed' };
  }

  if (currentTag.name === name) {
    showNotice('标签名称未变化', 'info', 2000);
    return { success: true, unchanged: true };
  }

  tagsById[tagId] = {
    ...currentTag,
    name,
    updatedAt: Date.now()
  };

  await chrome.storage.local.set({ tagsById });
  showNotice(`已更新为 "${name}"`, 'success', 2000);
  return { success: true, renamed: true };
}

/**
 * 删除标签
 */
async function handleDeleteTag(tagId) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'deleteTag',
      tagId
    });

    const result = await response;

    if (result.success) {
      showNotice(`已删除标签 "${result.tagName}"，影响 ${result.affectedBookmarks} 个书签`, 'success', 4000);
    } else {
      showNotice(`删除失败: ${result.error}`, 'error', 4000);
    }
  } catch (error) {
    console.error('删除标签失败:', error);
    showNotice(`删除失败: ${error.message}`, 'error', 4000);
  }
}

// 🔥 ==================== 标签编辑弹窗功能 ====================

// 当前正在编辑的书签ID和标签
let currentEditingBookmarkId = null;
let currentEditingTagIds = new Set();

/**
 * 打开编辑弹窗
 */
async function openEditModal(bookmarkId) {
  currentEditingBookmarkId = bookmarkId;
  currentEditingTagIds = new Set();

  // 获取书签信息
  const bookmarks = await chrome.bookmarks.get(bookmarkId);
  if (!bookmarks || bookmarks.length === 0) {
    showNotice('书签不存在', 'error', 3000);
    return;
  }

  const bookmark = bookmarks[0];

  // 显示书签信息
  document.getElementById('modalBookmarkTitle').textContent = bookmark.title;
  document.getElementById('modalBookmarkUrl').textContent = bookmark.url;

  // 加载书签的标签
  const data = await chrome.storage.local.get(['bookmarkMeta', 'tagsById']);
  const bookmarkMeta = data.bookmarkMeta || {};
  const tagsById = data.tagsById || {};

  const meta = bookmarkMeta[bookmarkId];
  if (meta && meta.tagIds) {
    currentEditingTagIds = new Set(meta.tagIds);

    // 渲染当前标签
    const currentTagsContainer = document.getElementById('modalCurrentTags');
    currentTagsContainer.innerHTML = meta.tagIds.map(tagId => {
      const tag = tagsById[tagId];
      if (!tag) return '';
      return `
        <span class="tag" style="display: inline-flex; align-items: center; gap: 4px; background: var(--accent-dim); color: var(--accent); border-color: var(--accent);">
          ${escapeHtml(tag.name)}
          <button class="remove-tag-btn" data-tag-id="${tagId}" style="background: none; border: none; color: inherit; cursor: pointer; font-size: 14px; padding: 0; line-height: 1;">×</button>
        </span>
      `;
    }).join('');

    // 绑定移除按钮事件
    currentTagsContainer.querySelectorAll('.remove-tag-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tagId = btn.dataset.tagId;
        removeTagFromBookmark(tagId);
      });
    });
  } else {
    document.getElementById('modalCurrentTags').innerHTML = '<span style="color: var(--text-muted); font-size: 11px;">暂无标签</span>';
  }

  // 显示弹窗
  const modal = document.getElementById('editTagModal');
  modal.classList.remove('modal-hidden');
  modal.classList.add('modal-visible');
}

/**
 * 关闭编辑弹窗
 */
function closeEditModal() {
  const modal = document.getElementById('editTagModal');
  modal.classList.remove('modal-visible');
  modal.classList.add('modal-hidden');
  currentEditingBookmarkId = null;
  currentEditingTagIds = new Set();

  // 清空输入框
  document.getElementById('modalTagInput').value = '';
  document.getElementById('modalTagAutocomplete').style.display = 'none';
}

/**
 * 处理标签输入（自动完成）
 */
let modalAutocompleteDebounce = null;
async function handleModalTagInput(event) {
  clearTimeout(modalAutocompleteDebounce);

  const input = event.target;
  const query = input.value.trim();
  const autocomplete = document.getElementById('modalTagAutocomplete');
  input.dataset.resolvedTagId = '';

  if (!query) {
    autocomplete.style.display = 'none';
    return;
  }

  modalAutocompleteDebounce = setTimeout(async () => {
    const data = await chrome.storage.local.get('tagsById');
    const tagsById = data.tagsById || {};

    if (Object.keys(tagsById).length === 0) {
      autocomplete.style.display = 'none';
      return;
    }

    const index = new TagIndex(tagsById);

    // 1. 检查精确匹配
    const existingId = index.resolve(query);
    if (existingId) {
      const tag = tagsById[existingId];
      const isAdded = currentEditingTagIds.has(existingId);
      input.dataset.resolvedTagId = existingId;
      autocomplete.innerHTML = `
        <div class="modal-autocomplete-item" data-tag-id="${existingId}"
          style="padding: 8px; cursor: ${isAdded ? 'default' : 'pointer'}; border-bottom: 1px solid var(--border); transition: background 0.2s; ${isAdded ? 'opacity: 0.5;' : ''}">
          <span style="color: var(--text-primary);">已存在: ${escapeHtml(tag.name)}</span>
          ${isAdded ? '<span style="margin-left: 8px; color: var(--text-muted); font-size: 10px;">已添加</span>' : '<span style="margin-left: 8px; color: var(--text-muted); font-size: 12px;">点击添加</span>'}
        </div>
      `;

      if (!isAdded) {
        autocomplete.querySelectorAll('.modal-autocomplete-item').forEach(item => {
          item.addEventListener('click', () => {
            const tagId = item.dataset.tagId;
            addTagToBookmark(tagId);
            input.value = '';
            autocomplete.style.display = 'none';
          });
          item.addEventListener('mouseenter', () => {
            item.style.background = 'var(--bg-tertiary)';
          });
          item.addEventListener('mouseleave', () => {
            item.style.background = 'transparent';
          });
        });
      }

      autocomplete.style.display = 'block';
      return;
    }

    // 2. 查找相似标签
    const similar = index.findSimilar(query, 5);

    if (similar.length > 0) {
      input.dataset.resolvedTagId = '';
      autocomplete.innerHTML = similar.map(tag => {
        const isAdded = currentEditingTagIds.has(tag.id);
        return `
          <div class="modal-autocomplete-item" data-tag-name="${escapeHtml(tag.name)}" data-tag-id="${tag.id}"
            style="padding: 8px; cursor: pointer; border-bottom: 1px solid var(--border); transition: background 0.2s; ${isAdded ? 'opacity: 0.5;' : ''}">
            <span style="color: var(--text-primary);">${escapeHtml(tag.name)}</span>
            ${isAdded ? '<span style="margin-left: 8px; color: var(--text-muted); font-size: 10px;">已添加</span>' : '<span style="margin-left: 8px; color: var(--text-muted); font-size: 12px;">点击添加</span>'}
          </div>
        `;
      }).join('');

      // 绑定点击事件
      autocomplete.querySelectorAll('.modal-autocomplete-item').forEach(item => {
        if (!currentEditingTagIds.has(item.dataset.tagId)) {
          item.addEventListener('click', () => {
            const tagId = item.dataset.tagId;
            addTagToBookmark(tagId);
            input.value = '';
            autocomplete.style.display = 'none';
          });
          item.addEventListener('mouseenter', () => {
            item.style.background = 'var(--bg-tertiary)';
          });
          item.addEventListener('mouseleave', () => {
            item.style.background = 'transparent';
          });
        }
      });

      autocomplete.style.display = 'block';
    } else {
      autocomplete.style.display = 'none';
    }
  }, 150);
}

/**
 * 处理键盘事件
 */
function handleModalTagInputKeydown(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    handleModalAddTag();
  } else if (event.key === 'Escape') {
    const autocomplete = document.getElementById('modalTagAutocomplete');
    autocomplete.style.display = 'none';
  }
}

/**
 * 添加标签到书签
 */
async function handleModalAddTag() {
  const input = document.getElementById('modalTagInput');
  const tagName = input.value.trim();
  const resolvedTagId = input.dataset.resolvedTagId;

  if (!tagName) {
    showNotice('请输入标签名称', 'error', 3000);
    return;
  }

  try {
    if (resolvedTagId) {
      if (currentEditingTagIds.has(resolvedTagId)) {
        showNotice('该标签已添加', 'info', 2000);
        return;
      }
      addTagToBookmark(resolvedTagId);
      input.value = '';
      input.dataset.resolvedTagId = '';
      document.getElementById('modalTagAutocomplete').style.display = 'none';
      return;
    }

    const { tagId, isNew, similar } = await resolveTag(tagName, { createIfNotFound: true });

    if (tagId) {
      addTagToBookmark(tagId);
      input.value = '';
      input.dataset.resolvedTagId = '';
      document.getElementById('modalTagAutocomplete').style.display = 'none';
    }
  } catch (error) {
    console.error('添加标签失败:', error);
    showNotice(`添加失败: ${error.message}`, 'error', 4000);
  }
}

/**
 * 添加标签到当前书签
 */
async function addTagToBookmark(tagId) {
  if (currentEditingTagIds.has(tagId)) {
    showNotice('该标签已添加', 'info', 2000);
    return;
  }

  currentEditingTagIds.add(tagId);

  // 重新渲染当前标签
  await renderCurrentTags();
}

/**
 * 从书签移除标签
 */
async function removeTagFromBookmark(tagId) {
  currentEditingTagIds.delete(tagId);

  // 重新渲染当前标签
  await renderCurrentTags();
}

/**
 * 渲染当前标签
 */
async function renderCurrentTags() {
  const currentTagsContainer = document.getElementById('modalCurrentTags');
  const data = await chrome.storage.local.get('tagsById');
  const tagsById = data.tagsById || {};

  if (currentEditingTagIds.size === 0) {
    currentTagsContainer.innerHTML = '<span style="color: var(--text-muted); font-size: 11px;">暂无标签</span>';
    return;
  }

  currentTagsContainer.innerHTML = Array.from(currentEditingTagIds).map(tagId => {
    const tag = tagsById[tagId];
    if (!tag) return '';
    return `
      <span class="tag" style="display: inline-flex; align-items: center; gap: 4px; background: var(--accent-dim); color: var(--accent); border-color: var(--accent);">
        ${escapeHtml(tag.name)}
        <button class="remove-tag-btn" data-tag-id="${tagId}" style="background: none; border: none; color: inherit; cursor: pointer; font-size: 14px; padding: 0; line-height: 1;">×</button>
      </span>
    `;
  }).join('');

  // 重新绑定移除按钮事件
  currentTagsContainer.querySelectorAll('.remove-tag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tagId = btn.dataset.tagId;
      removeTagFromBookmark(tagId);
    });
  });
}

/**
 * 保存书签标签
 */
async function saveBookmarkTags() {
  if (!currentEditingBookmarkId) {
    showNotice('未选择书签', 'error', 3000);
    return;
  }

  try {
    const data = await chrome.storage.local.get('bookmarkMeta');
    const bookmarkMeta = data.bookmarkMeta || {};

    // 更新书签的标签
    bookmarkMeta[currentEditingBookmarkId] = {
      tagIds: Array.from(currentEditingTagIds),
      updatedAt: Date.now()
    };

    await chrome.storage.local.set({ bookmarkMeta });

    showNotice('标签已保存', 'success', 2000);

    // 关闭弹窗
    closeEditModal();

    // 刷新列表
    const searchInput = document.getElementById('searchInput');
    await searchBookmarks(searchInput.value);
  } catch (error) {
    console.error('保存标签失败:', error);
    showNotice(`保存失败: ${error.message}`, 'error', 4000);
  }
}
