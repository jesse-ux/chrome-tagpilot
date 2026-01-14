# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TagPilot is a Chrome Extension (Manifest V3) that uses AI to automatically tag and organize bookmarks. It supports OpenAI-compatible APIs including Chinese LLM providers (智谱 AI, Kimi, 火山引擎, 通义千问).

## Installation & Development

### Load Extension in Chrome
```bash
# 1. Navigate to project directory
cd ~/Documents/mcp/smart-bookmarks

# 2. Generate icons (if needed)
open icons/create_icons.html  # Open in browser and click "Generate Icons"

# 3. Load in Chrome
# - Open chrome://extensions/
# - Enable "Developer mode" (top right)
# - Click "Load unpacked"
# - Select the smart-bookmarks folder
```

### Reload Changes
After modifying files, go to `chrome://extensions/` and click the refresh icon on TagPilot card. For background.js changes, also click "Service worker" → "Restart" in the extension details.

## Architecture

### Core Components

**background.js** (Service Worker)
- Runs persistently in the background
- Listens to Chrome bookmarks events: `onCreated`, `onRemoved`, `onChanged`
- Handles batch processing for existing bookmarks
- Manages message passing between components
- **Key pattern**: Uses `importScripts()` to load utilities (no bundler)
- Sends real-time progress updates to popup during batch operations via `chrome.runtime.sendMessage()`

**popup.js** (User Interface)
- Main search and management interface
- Directly calls chrome.bookmarks API (doesn't route through background for search)
- Handles configuration testing/saving
- **Important**: Search function (`searchBookmarksInStorage`) duplicates logic from storage.js due to popup context limitations
- Message listener handles: `searchBookmarks`, `refreshResults`, `updateProgress`

**utils/classifier.js** (AI Classification Engine)
- `classifyBookmark()`: Main entry point for generating tags
- `fetchPageContent()`: Uses Jina.ai CORS proxy (`https://r.jina.ai/http://...`) to extract webpage content
- `analyzeWithOpenAI()`: Calls LLM API with custom endpoint support
- `generateRuleBasedTags()`: Fallback rule engine for when AI fails
- **Error handling**: `fetchPageContent` returns `null` on failure (doesn't throw), allowing classification to continue with URL+title only

**utils/storage.js** (Data Layer)
- All data persisted in `chrome.storage.local`
- Two main data structures:
  - `config`: API configuration (endpoint, key, model, language)
  - `bookmarkTags`: Object mapping `bookmarkId -> tags[]`
- Provides bookmark tree traversal utilities used by both background and popup

### Data Flow

**Bookmark Creation Flow:**
1. User adds bookmark in Chrome
2. `background.js` receives `onCreated` event
3. Calls `classifyBookmark()` which:
   - Fetches page content via Jina.ai proxy (or fails gracefully)
   - Calls LLM API with custom endpoint support
   - Falls back to rule-based tagging if AI fails
4. Tags stored in `chrome.storage.local.bookmarkTags`
5. Notification displayed to user

**Batch Processing Flow:**
1. Popup sends `batchClassify` message to background
2. Background iterates all bookmarks via `getAllBookmarks()`
3. Each bookmark classified (skips already-tagged)
4. After each successful classification: sends `updateProgress` message to popup
5. Popup updates stats display in real-time via `updateStatsDisplay()`
6. After completion: sends `refreshResults` message to popup to refresh list

**Search Flow:**
1. Popup calls `searchBookmarksInStorage(query)` directly
2. Fetches tags from storage
3. Traverses entire bookmark tree via `chrome.bookmarks.getTree()`
4. Matches against: title, URL, tags (case-insensitive substring match)
5. Returns sorted results (title matches prioritized)

### Message Passing Protocol

Messages sent between components follow this structure:
```javascript
// Background → Popup
{
  action: 'updateProgress',      // During batch processing
  processed: number,
  tagged: number,
  total: number
}

{
  action: 'refreshResults'       // After batch complete
}

// Popup → Background
{
  action: 'batchClassify'        // Start batch processing
}

{
  action: 'getConfig' | 'saveConfig' | 'testConfig'
  config?: { apiEndpoint, openaiApiKey, model, ... }
}
```

### Chinese LLM Provider Support

The extension supports custom API endpoints via `apiEndpoint` config:

- **智谱 AI**: `https://open.bigmodel.cn/api/paas/v4` (model: `glm-4-flash` or `glm-4-plus`)
- **Kimi**: `https://api.moonshot.cn/v1` (model: `moonshot-v1-8k`)
- **火山引擎**: `https://ark.cn-beijing.volces.com/api/v3` (model: endpoint ID like `ep-*****`)
- **通义千问**: `https://dashscope.aliyuncs.com/compatible-mode/v1` (model: `qwen-turbo`)
- **OpenAI**: Leave `apiEndpoint` empty or use `https://api.openai.com/v1` (model: `gpt-4o-mini`)

The API call in `analyzeWithOpenAI()` constructs the full URL as:
```javascript
const baseUrl = apiEndpoint || 'https://api.openai.com/v1';
const apiUrl = `${baseUrl}/chat/completions`;
```

## Key Implementation Details

### Import System (No Bundler)
This project uses vanilla Chrome Extension patterns with no build system:
- `background.js` uses `importScripts('utils/storage.js')` to load utilities
- `popup.html` uses `<script src="popup.js"></script>` (no imports in popup.js)
- Utilities are plain JavaScript files with top-level function declarations
- All utilities must be loaded before `background.js` executes

### CORS Proxy for Webpage Content
The extension uses Jina.ai as a CORS proxy to fetch webpage content:
```javascript
const response = await fetch(`https://r.jina.ai/http://${url.replace(/^https?:\/\//, '')}`);
```
This is necessary because direct fetch requests to arbitrary domains would be blocked by CORS. If this fails (returns null), classification continues with just URL and title.

### Storage Schema
```javascript
// chrome.storage.local
{
  config: {
    apiEndpoint: string,      // Custom API base URL
    openaiApiKey: string,     // LLM API key
    model: string,            // Model name
    autoTag: boolean,
    maxRetries: number,
    language: string          // 'zh-CN' for Chinese
  },
  bookmarkTags: {
    [bookmarkId: string]: string[]  // Array of tag strings
  }
}
```

### UI Design System
The popup uses a "Digital Archive Room" aesthetic:
- **Colors**: `--bg-primary: #0a0a0a`, `--accent: #00ff9d` (neon green)
- **Typography**: JetBrains Mono (monospace) for terminal aesthetic
- **Fonts**: Google Fonts (JetBrains Mono + Archivo Black)
- **Layout**: Fixed width (520px), max-height results with custom scrollbar
- **States**: Loading pulse animation, hover glow effects, active tag highlighting

## Debugging

### Console Logs
All logs are prefixed with `[TagPilot]` for easy filtering:
```javascript
console.log('[TagPilot] 开始分类:', bookmark.title);
console.log('[TagPilot] AI 返回标签:', aiTags);
```

### Service Worker Debugging
1. Go to `chrome://extensions/`
2. Find TagPilot → click "Service worker" link
3. Opens DevTools for background.js
4. View logs, network requests, etc.

### Popup Debugging
1. Right-click the extension popup
2. Select "Inspect"
3. Opens DevTools for popup context

### Common Issues

**"No bookmarks found" despite classification working:**
- Check if `chrome.bookmarks.getTree()` is returning data
- Verify search query isn't filtering out results
- Look for console logs showing bookmark tree structure

**CORS errors when fetching page content:**
- This is expected for some sites
- Extension will fallback to URL+title only classification
- Check Jina.ai proxy status if failing consistently

**API configuration test failing:**
- Verify `apiEndpoint` format (should include `/v1` or `/v4` path)
- Check that API key has proper permissions
- Ensure model name matches provider's expected format
- Use browser DevTools Network tab to see actual API response

## File Structure

```
smart-bookmarks/
├── manifest.json           # Chrome Extension V3 config
├── popup.html             # Main UI (includes inline styles)
├── popup.js               # UI logic + search implementation
├── background.js          # Service worker (event listeners + batch processing)
├── utils/
│   ├── storage.js         # Chrome storage wrapper + bookmark traversal
│   └── classifier.js      # AI classification engine + rule-based fallback
├── icons/
│   ├── create_icons.html  # Icon generation tool (SVG → Canvas)
│   └── *.png              # Generated extension icons
├── config.example.json    # Configuration template
└── README.md              # User documentation
```

## Testing API Configuration

The "Test Configuration" button in popup sends a minimal request:
```javascript
{
  model: config.model,
  messages: [{ role: 'user', content: 'Hi' }],
  max_tokens: 10
}
```

Expected success response:
```javascript
{
  success: true,
  model: string,      // Actual model name from API
  latency: number     // Response time in ms
}
```

If this fails, check:
- Network request URL (should be `apiEndpoint + /chat/completions`)
- Request headers (Authorization format)
- Response body (error message from provider)
