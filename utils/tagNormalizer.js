/**
 * 标签规范化工具（双层规范化，不误伤技术标签）
 *
 * 设计原则：
 * 1. Tag 展示名 name 永远保留原样（或轻微清洗零宽字符）
 * 2. 建索引用 normalizeKey()，不暴力删 + # .
 * 3. 提供"去标点版本"专治 Node.js/NodeJS 这类情况
 */

/**
 * 基础规范化：用于索引匹配（保留 + # . 等语义字符）
 *
 * 示例：
 * - "C++" → "c++"
 * - "Node.js" → "node.js"
 * - "v1.6.0" → "v1.6.0"
 * - "深度学习  " → "深度学习"
 */
function normalizeKey(s) {
  return String(s || '')
    .replace(/[\u0000-\u001F\u007F]/g, '')                // 控制字符
    .replace(/[\u200B-\u200F\uFEFF\u2060\u202A-\u202E]/g, '') // 零宽/方向控制
    .trim()
    .replace(/[\s\-_\/]+/g, ' ')                         // 统一分隔符为空格
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * 去标点规范化：专治 Node.js vs NodeJS
 *
 * 示例：
 * - "Node.js" → "nodejs"
 * - "Mermaid Live Editor" → "mermaidliveeditor"
 * - "v1.6.0" → "v160"
 */
function normalizeKeyNoPunct(s) {
  return normalizeKey(s).replace(/[.\s]/g, '');
}

/**
 * 轻量清洗：仅去除零宽字符，保留原始格式用于展示
 *
 * 示例：
 * - "  C++  " → "C++"
 * - "Node\u200B.js" → "Node.js" (移除零宽字符)
 */
function cleanLabel(s) {
  return String(s || '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[\u200B-\u200F\uFEFF\u2060\u202A-\u202E]/g, '')
    .trim();
}

/**
 * 判断字符串是否主要由中文字符组成
 * 用于决定是否使用编辑距离（中文不适合）
 */
function isMostlyCJK(str) {
  if (!str) return false;
  const cjk = (str.match(/[\u4e00-\u9fff]/g) || []).length;
  return cjk / str.length >= 0.5;
}

/**
 * 判断标签长度是否合理
 */
function isLengthOk(tag) {
  const t = cleanLabel(tag);
  if (!t) return false;
  if (isMostlyCJK(t)) return t.length >= 2 && t.length <= 10;
  return t.length >= 2 && t.length <= 24;
}
