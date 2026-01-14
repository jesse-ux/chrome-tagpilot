/**
 * Tag 标签内存索引
 *
 * 职责：
 * 1. 从 tagsById 构建内存索引（aliasToId 反查映射）
 * 2. 提供 resolve() 方法从标签字符串反查 tagId
 * 3. 提供 findSimilar() 方法找相似标签（P0 轻量版）
 *
 * 设计原则：
 * - 不持久化：每次启动时从 chrome.storage.local 重建
 * - Service Worker 回收也没关系，随用随建
 *
 * 注意：CANONICAL_MAP 在此文件中声明，供 classifier.js 和 tagIndex.js 共享
 */

/**
 * 同义词表（从 classifier.js 迁移 + 扩展）
 *
 * 用于 resolveTag 的第 1 步：CANONICAL_MAP 命中
 */
const CANONICAL_MAP = new Map([
  // AI/ML
  ['人工智能', 'AI'],
  ['ai', 'AI'],
  ['a.i.', 'AI'],
  ['机器学习', 'ML'],
  ['machine learning', 'ML'],
  ['ml', 'ML'],
  ['深度学习', 'DL'],
  ['deep learning', 'DL'],
  ['dl', 'DL'],
  ['llm', 'LLM'],
  ['大语言模型', 'LLM'],
  ['大模型', 'LLM'],

  // 编程语言/框架
  ['node', 'Node.js'],
  ['nodejs', 'Node.js'],
  ['node.js', 'Node.js'],
  ['js', 'JavaScript'],
  ['javascript', 'JavaScript'],
  ['ts', 'TypeScript'],
  ['typescript', 'TypeScript'],
  ['py', 'Python'],
  ['python', 'Python'],
  ['golang', 'Go'],
  ['reactjs', 'React'],
  ['react.js', 'React'],
  ['vuejs', 'Vue'],
  ['vue.js', 'Vue'],
  ['angularjs', 'Angular'],
  ['angular.js', 'Angular'],

  // 工具/平台
  ['github repository', 'GitHub'],
  ['github repo', 'GitHub'],
  ['bilibili', 'bilibili'],
  ['b站', 'bilibili'],
  ['stackoverflow', 'StackOverflow'],
  ['medium', 'Medium'],
  ['dev.to', 'Dev.to'],
]);

/**
 * 编辑距离算法（轻量版）
 *
 * 仅用于英文/数字为主的标签，中文不适合用编辑距离
 */
function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * TagIndex 类
 */
class TagIndex {
  /**
   * @param {Object} tagsById - { [tagId: string]: Tag }
   */
  constructor(tagsById) {
    this.tagsById = tagsById || {};
    this.aliasToId = new Map();
    this.build();
  }

  /**
   * 构建索引：为每个 tag 的 name 和 aliases 生成多条索引记录
   */
  build() {
    this.aliasToId.clear();

    for (const [id, tag] of Object.entries(this.tagsById)) {
      if (!tag) continue;

      // 1. name 本身
      const nameKey = normalizeKey(tag.name);
      if (nameKey) {
        this.aliasToId.set(nameKey, id);
      }

      // 2. 去标点版本（Node.js → nodejs）
      const noPunctKey = normalizeKeyNoPunct(tag.name);
      if (noPunctKey && noPunctKey !== nameKey) {
        this.aliasToId.set(noPunctKey, id);
      }

      // 3. aliases
      (tag.aliases || []).forEach(alias => {
        const aliasKey = normalizeKey(alias);
        if (aliasKey) {
          this.aliasToId.set(aliasKey, id);
        }

        const aliasNoPunct = normalizeKeyNoPunct(alias);
        if (aliasNoPunct && aliasNoPunct !== aliasKey) {
          this.aliasToId.set(aliasNoPunct, id);
        }
      });
    }
  }

  /**
   * 核心方法：从标签字符串反查 tagId
   *
   * @param {string} tagLabel - 原始标签字符串
   * @returns {string|null} tagId 或 null
   */
  resolve(tagLabel) {
    const normalized = normalizeKey(tagLabel);
    return this.aliasToId.get(normalized) || null;
  }

  /**
   * 获取 Tag 对象
   *
   * @param {string} tagId
   * @returns {Tag|null}
   */
  getTag(tagId) {
    return this.tagsById[tagId] || null;
  }

  /**
   * 找相似标签（P0 轻量版）
   *
   * 策略顺序（越靠前越确定）：
   * 1. CANONICAL_MAP 命中
   * 2. 子串/前缀匹配（中文特别有效）
   * 3. 编辑距离（仅对英文/数字为主的标签用）
   *
   * @param {string} tagLabel - 原始标签字符串
   * @param {number} maxResults - 最多返回多少个候选
   * @returns {Tag[]} 相似标签数组
   */
  findSimilar(tagLabel, maxResults = 5) {
    const normalized = normalizeKey(tagLabel);
    const noPunct = normalizeKeyNoPunct(tagLabel);
    const candidates = [];

    // 1. 精确匹配（已命中的不会进入这里）
    if (this.aliasToId.has(normalized) || this.aliasToId.has(noPunct)) {
      return [];
    }

    // 2. CANONICAL_MAP 命中
    const canonical = CANONICAL_MAP.get(normalized);
    if (canonical) {
      const canonicalId = this.aliasToId.get(normalizeKey(canonical));
      if (canonicalId) {
        return [this.tagsById[canonicalId]];
      }
    }

    // 3. 子串/前缀匹配（中文特别有效）
    for (const [id, tag] of Object.entries(this.tagsById)) {
      if (!tag) continue;

      const tagName = normalizeKey(tag.name);
      const tagAliases = (tag.aliases || []).map(a => normalizeKey(a));

      // 双向包含：新标签包含旧标签名 或 旧标签名包含新标签
      if (tagName.includes(normalized) || normalized.includes(tagName)) {
        candidates.push({ tag, score: 0.9, reason: 'substring' });
        continue;
      }

      // 别名匹配
      for (const alias of tagAliases) {
        if (!alias) continue;
        if (alias.includes(normalized) || normalized.includes(alias)) {
          candidates.push({ tag, score: 0.8, reason: 'alias-substring' });
          break;
        }
      }
    }

    // 4. 编辑距离（仅对英文/数字为主的标签）
    if (/^[a-z0-9\s.]+$/.test(normalized)) {
      for (const [id, tag] of Object.entries(this.tagsById)) {
        if (!tag) continue;

        const tagName = normalizeKey(tag.name);
        const distance = levenshteinDistance(normalized, tagName);
        if (distance <= 2 && normalized.length > 3) {
          candidates.push({
            tag,
            score: 1 - (distance / Math.max(normalized.length, tagName.length)),
            reason: 'edit-distance'
          });
        }
      }
    }

    // 去重并排序
    const unique = new Map();
    for (const c of candidates) {
      if (!unique.has(c.tag.id) || unique.get(c.tag.id).score < c.score) {
        unique.set(c.tag.id, c);
      }
    }

    return Array.from(unique.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map(c => c.tag);
  }

  /**
   * 重新构建索引（用于外部更新 tagsById 后刷新）
   */
  rebuild() {
    this.build();
  }
}
