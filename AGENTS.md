# Repository Guidelines

## Project Structure & Module Organization
- `manifest.json` defines the Chrome extension entry points and permissions.
- `background.js` is the service worker handling bookmark events and messaging.
- `popup.html` and `popup.js` implement the side panel UI and user interactions.
- `content/tagOverlay.js` renders the in-page tag confirmation overlay.
- `utils/` contains shared logic:
  - `utils/storage.js` manages config and bookmark tag persistence.
  - `utils/classifier.js` handles content fetching and tag generation.
- `icons/` holds extension assets (required for Chrome packaging).

## Build, Test, and Development Commands
- This project has no build or test tooling configured. Development is done by loading the folder as an unpacked extension:
  - Open `chrome://extensions`.
  - Enable Developer mode.
  - Click "Load unpacked" and select the repository root.
- If you change `manifest.json`, reload the extension in the extensions page.

## Coding Style & Naming Conventions
- JavaScript is plain ES modules / extension APIs; keep changes minimal and readable.
- Use 2-space indentation and semicolons to match existing files.
- Functions are camelCase (e.g., `searchBookmarksInStorage`), constants are UPPER_SNAKE_CASE.
- Keep UI text short; avoid alert dialogs in favor of in-panel notices.

## Testing Guidelines
- No automated tests are present. Validate changes by:
  - Opening the side panel and checking UI flows.
  - Triggering bookmark create/remove/modify events.
  - Running a batch classify and observing progress updates.

## Commit & Pull Request Guidelines
- No explicit commit conventions were found. Use clear, scoped messages (e.g., `fix: refresh side panel after tag changes`).
- PRs should include a summary, steps to test, and screenshots for UI changes.

## Configuration Tips
- Config and tags are stored in `chrome.storage.local` under `config`, `bookmarkMeta`, and `tagsById` (legacy `bookmarkTags` is still read).
- Host permissions must include any API endpoints used for classification and the in-page overlay runs on `http(s)` pages.
