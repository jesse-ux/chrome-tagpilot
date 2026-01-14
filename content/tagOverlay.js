(() => {
  const OVERLAY_ID = 'tagpilot-overlay';
  const STYLE_ID = 'tagpilot-overlay-style';

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${OVERLAY_ID} {
        --bg-primary: #0a0a0a;
        --bg-secondary: #141414;
        --bg-tertiary: #1c1c1c;
        --text-primary: #e8e8e8;
        --text-secondary: #a0a0a0;
        --text-muted: #666666;
        --accent: #00ff9d;
        --accent-dim: rgba(0, 255, 157, 0.1);
        --border: #2a2a2a;
        --border-strong: #333333;

        position: fixed;
        top: 16px;
        right: 16px;
        width: 340px;
        max-width: calc(100vw - 32px);
        background: var(--bg-secondary);
        color: var(--text-primary);
        border: 2px solid var(--border-strong);
        font-family: "JetBrains Mono", "Courier New", monospace;
        z-index: 2147483647;
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
      }

      #${OVERLAY_ID} * {
        box-sizing: border-box;
      }

      #${OVERLAY_ID} .tp-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 18px;
        border-bottom: 2px solid var(--border-strong);
        position: relative;
      }

      #${OVERLAY_ID} .tp-header::after {
        content: '';
        position: absolute;
        bottom: -2px;
        left: 18px;
        right: 18px;
        height: 2px;
        background: var(--accent);
        box-shadow: 0 0 10px rgba(0, 255, 157, 0.3);
      }

      #${OVERLAY_ID} .tp-title {
        font-family: "Archivo Black", sans-serif;
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--text-primary);
      }

      #${OVERLAY_ID} .tp-close {
        background: transparent;
        border: none;
        color: var(--text-secondary);
        font-size: 22px;
        cursor: pointer;
        line-height: 1;
        padding: 2px 6px;
        transition: color 0.15s ease;
      }

      #${OVERLAY_ID} .tp-close:hover {
        color: var(--accent);
      }

      #${OVERLAY_ID} .tp-body {
        padding: 14px 18px 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      #${OVERLAY_ID} .tp-meta {
        background: var(--bg-tertiary);
        border: 1px solid var(--border);
        padding: 10px 12px;
        font-size: 10px;
        color: var(--text-secondary);
      }

      #${OVERLAY_ID} .tp-meta-title {
        color: var(--text-primary);
        font-size: 12px;
        margin-bottom: 6px;
        font-weight: 500;
      }

      #${OVERLAY_ID} .tp-meta-url {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-family: "JetBrains Mono", monospace;
      }

      #${OVERLAY_ID} .tp-section-label {
        font-size: 11px;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 8px;
        font-family: "JetBrains Mono", monospace;
      }

      #${OVERLAY_ID} .tp-tag-list {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        min-height: 40px;
        max-height: 140px;
        overflow-y: auto;
        padding-right: 4px;
        align-items: flex-start;
      }

      #${OVERLAY_ID} .tp-suggest {
        border: 1px solid var(--border);
        background: var(--bg-secondary);
        max-height: 140px;
        overflow-y: auto;
        display: none;
      }

      #${OVERLAY_ID} .tp-suggest-item {
        padding: 8px 10px;
        font-size: 10px;
        color: var(--text-primary);
        cursor: pointer;
        border-bottom: 1px solid var(--border);
      }

      #${OVERLAY_ID} .tp-suggest-item:hover {
        background: var(--bg-tertiary);
      }

      /* Custom scrollbar matching popup.html */
      #${OVERLAY_ID} .tp-tag-list::-webkit-scrollbar {
        width: 8px;
      }

      #${OVERLAY_ID} .tp-tag-list::-webkit-scrollbar-track {
        background: var(--bg-secondary);
      }

      #${OVERLAY_ID} .tp-tag-list::-webkit-scrollbar-thumb {
        background: var(--border-strong);
        border-radius: 0;
      }

      #${OVERLAY_ID} .tp-tag-list::-webkit-scrollbar-thumb:hover {
        background: var(--text-muted);
      }

      #${OVERLAY_ID} .tp-tag {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 8px;
        border: 1px solid var(--accent);
        background: var(--accent-dim);
        color: var(--accent);
        font-size: 10px;
        line-height: 1.1;
        border-radius: 0;
        text-transform: uppercase;
        letter-spacing: 0.4px;
        font-family: "JetBrains Mono", monospace;
      }

      #${OVERLAY_ID} .tp-tag-remove {
        background: none;
        border: none;
        color: inherit;
        cursor: pointer;
        font-size: 14px;
        line-height: 1;
        padding: 0 2px;
        opacity: 0.6;
        transition: opacity 0.15s ease;
      }

      #${OVERLAY_ID} .tp-tag-remove:hover {
        opacity: 1;
        color: var(--text-primary);
      }

      #${OVERLAY_ID} .tp-input-row {
        display: flex;
        gap: 8px;
      }

      #${OVERLAY_ID} .tp-input {
        flex: 1;
        padding: 10px 14px;
        background: var(--bg-tertiary);
        border: 1px solid var(--border-strong);
        color: var(--text-primary);
        font-size: 12px;
        outline: none;
        font-family: "JetBrains Mono", monospace;
        transition: all 0.2s ease;
      }

      #${OVERLAY_ID} .tp-input:focus {
        border-color: var(--accent);
        box-shadow: 0 0 0 3px var(--accent-dim);
      }

      #${OVERLAY_ID} .tp-input::placeholder {
        color: var(--text-muted);
      }

      #${OVERLAY_ID} .tp-btn {
        padding: 10px 14px;
        border: 1px solid var(--border-strong);
        background: var(--bg-tertiary);
        color: var(--text-primary);
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-family: "JetBrains Mono", monospace;
        transition: all 0.15s ease;
        border-radius: 0;
      }

      #${OVERLAY_ID} .tp-btn:hover {
        background: var(--bg-secondary);
        border-color: var(--accent);
        color: var(--accent);
      }

      #${OVERLAY_ID} .tp-btn-primary {
        border-color: var(--accent);
        color: var(--accent);
        background: var(--accent-dim);
      }

      #${OVERLAY_ID} .tp-btn-primary:hover {
        background: var(--accent);
        color: var(--bg-primary);
      }

      #${OVERLAY_ID} .tp-footer {
        display: flex;
        gap: 8px;
        margin-top: 6px;
      }

      #${OVERLAY_ID} .tp-footer .tp-btn {
        flex: 1;
      }

      #${OVERLAY_ID} .tp-hint {
        font-size: 10px;
        color: var(--text-muted);
        font-family: "JetBrains Mono", monospace;
      }
    `;
    document.head.appendChild(style);
  }

  function normalizeTagInput(value) {
    return String(value || '')
      .split(/[,，]/)
      .map(item => item.trim())
      .filter(Boolean);
  }

  function createOverlay({ bookmark, tags }) {
    const existing = document.getElementById(OVERLAY_ID);
    if (existing) {
      existing.remove();
    }

    ensureStyles();

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;

    overlay.innerHTML = `
      <div class="tp-header">
        <div class="tp-title">TagPilot · 标签确认</div>
        <button class="tp-close" aria-label="关闭">×</button>
      </div>
      <div class="tp-body">
        <div class="tp-meta">
          <div class="tp-meta-title">${escapeHtml(bookmark.title || '')}</div>
          <div class="tp-meta-url">${escapeHtml(bookmark.url || '')}</div>
        </div>
        <div class="tp-section-label">当前标签</div>
        <div class="tp-tag-list"></div>
        <div class="tp-section-label">添加标签</div>
        <div class="tp-input-row">
          <input class="tp-input" type="text" placeholder="输入标签，回车添加" />
          <button class="tp-btn" type="button">添加</button>
        </div>
        <div class="tp-suggest"></div>
        <div class="tp-hint">提示：不操作也会保留模型标签</div>
        <div class="tp-footer">
          <button class="tp-btn tp-btn-primary" type="button">保存</button>
          <button class="tp-btn" type="button">关闭</button>
        </div>
      </div>
    `;

    const tagList = overlay.querySelector('.tp-tag-list');
    const input = overlay.querySelector('.tp-input');
    const addBtn = overlay.querySelectorAll('.tp-btn')[0];
    const saveBtn = overlay.querySelectorAll('.tp-btn')[1];
    const closeBtn = overlay.querySelectorAll('.tp-btn')[2];
    const closeIcon = overlay.querySelector('.tp-close');
    const suggest = overlay.querySelector('.tp-suggest');
    let suggestTimer = null;

    let currentTags = Array.from(new Set((tags || []).map(t => t.trim()).filter(Boolean)));

    const renderTags = () => {
      if (!currentTags.length) {
        tagList.innerHTML = '<span class="tp-hint">暂无标签</span>';
        return;
      }
      tagList.innerHTML = currentTags.map(tag => `
        <span class="tp-tag">
          ${escapeHtml(tag)}
          <button class="tp-tag-remove" data-tag="${escapeHtml(tag)}">×</button>
        </span>
      `).join('');
      tagList.querySelectorAll('.tp-tag-remove').forEach(btn => {
        btn.addEventListener('click', () => {
          const tag = btn.dataset.tag;
          currentTags = currentTags.filter(item => item !== tag);
          renderTags();
        });
      });
    };

    const addTagsFromInput = () => {
      const values = normalizeTagInput(input.value);
      if (!values.length) return;
      values.forEach(tag => {
        if (!currentTags.includes(tag)) currentTags.push(tag);
      });
      input.value = '';
      renderTags();
    };

    addBtn.addEventListener('click', addTagsFromInput);
    input.addEventListener('input', () => {
      if (suggestTimer) clearTimeout(suggestTimer);
      const value = input.value.trim();
      if (!value) {
        suggest.style.display = 'none';
        suggest.innerHTML = '';
        return;
      }
      suggestTimer = setTimeout(async () => {
        try {
          const response = await chrome.runtime.sendMessage({
            action: 'suggestTags',
            query: value
          });
          renderSuggestions(response);
        } catch (error) {
          suggest.style.display = 'none';
          suggest.innerHTML = '';
        }
      }, 150);
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        addTagsFromInput();
      } else if (event.key === 'Escape') {
        input.value = '';
        suggest.style.display = 'none';
        suggest.innerHTML = '';
      }
    });

    saveBtn.addEventListener('click', async () => {
      const payload = {
        action: 'updateBookmarkTags',
        bookmarkId: bookmark.id,
        tags: currentTags
      };
      try {
        await chrome.runtime.sendMessage(payload);
        overlay.remove();
      } catch (error) {
        overlay.remove();
      }
    });

    const close = () => overlay.remove();
    closeBtn.addEventListener('click', close);
    closeIcon.addEventListener('click', close);

    renderTags();
    document.body.appendChild(overlay);

    function renderSuggestions(response) {
      const exact = response?.exact || null;
      const similar = Array.isArray(response?.similar) ? response.similar : [];
      const items = [];

      if (exact) {
        items.push(`
          <div class="tp-suggest-item" data-tag="${escapeHtml(exact)}">
            已存在：${escapeHtml(exact)} <span style="color: var(--text-muted);">点击添加</span>
          </div>
        `);
      }

      similar.forEach((name) => {
        items.push(`
          <div class="tp-suggest-item" data-tag="${escapeHtml(name)}">
            相似：${escapeHtml(name)} <span style="color: var(--text-muted);">点击添加</span>
          </div>
        `);
      });

      if (!items.length) {
        suggest.style.display = 'none';
        suggest.innerHTML = '';
        return;
      }

      suggest.innerHTML = items.join('');
      suggest.style.display = 'block';
      suggest.querySelectorAll('.tp-suggest-item').forEach((item) => {
        item.addEventListener('click', () => {
          const tag = item.dataset.tag;
          if (tag && !currentTags.includes(tag)) {
            currentTags.push(tag);
            renderTags();
          }
          input.value = '';
          suggest.style.display = 'none';
          suggest.innerHTML = '';
        });
      });
    }
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

  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'showTagOverlay') {
      createOverlay(request.payload || {});
    }
  });
})();
