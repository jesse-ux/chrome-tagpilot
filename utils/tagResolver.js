/**
 * 标签解析统一入口（防碎片化的核心）
 *
 * 所有标签创建/查找都必须走这个函数，从源头防止碎片化
 *
 * 使用示例：
 * - 自动分类：const { tagId, similar } = await resolveTag('AI', { createIfNotFound: true });
 * - 用户手动添加：const { tagId, similar } = await resolveTag(userInput, { createIfNotFound: true });
 * - 仅查询：const { tagId } = await resolveTag('AI');
 */

/**
 * 生成 UUID
 * 格式：tag_<timestamp>_<random>
 */
function generateUUID() {
  return 'tag_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * 统一标签解析入口
 *
 * @param {string} tagLabel - 原始标签字符串
 * @param {Object} options - 配置选项
 * @param {boolean} options.createIfNotFound - 如果没找到，是否创建新标签
 * @param {boolean} options.skipSimilarCheck - 是否跳过相似标签检查（迁移时可用）
 * @returns {Promise<Object>} - { tagId: string|null, isNew: boolean, similar: Tag[] }
 */
async function resolveTag(tagLabel, options = {}) {
  const {
    createIfNotFound = false,
    skipSimilarCheck = false
  } = options;

  // 1. 清洗输入
  const cleanedLabel = cleanLabel(tagLabel);
  if (!cleanedLabel) {
    return { tagId: null, isNew: false, similar: [] };
  }

  // 2. 加载现有数据
  const data = await chrome.storage.local.get(['tagsById']);
  const tagsById = data.tagsById || {};
  const index = new TagIndex(tagsById);

  // 3. 精确匹配（最快路径）
  const existingId = index.resolve(cleanedLabel);
  if (existingId) {
    console.log(`[TagPilot] 标签 "${cleanedLabel}" 已存在，ID: ${existingId}`);
    return { tagId: existingId, isNew: false, similar: [] };
  }

  // 4. 查找相似标签
  const similar = skipSimilarCheck ? [] : index.findSimilar(cleanedLabel);

  // 5. 如果不允许创建，返回候选列表
  if (!createIfNotFound) {
    return { tagId: null, isNew: false, similar };
  }

  // 6. 创建新 Tag
  const newTag = {
    id: generateUUID(),
    name: cleanedLabel,
    aliases: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  tagsById[newTag.id] = newTag;
  await chrome.storage.local.set({ tagsById });

  console.log(
    `[TagPilot] 创建新标签 "${cleanedLabel}" (ID: ${newTag.id})` +
    (similar.length > 0 ? `，发现 ${similar.length} 个相似标签` : '')
  );

  return { tagId: newTag.id, isNew: true, similar };
}

/**
 * 批量解析标签（用于批量分类）
 *
 * @param {string[]} tagLabels - 标签数组
 * @param {Object} options - 同 resolveTag
 * @returns {Promise<{tagIds: string[], stats: Object}>}
 */
async function resolveTags(tagLabels, options = {}) {
  const tagIds = [];
  let created = 0;
  let reused = 0;
  const allSimilar = [];

  for (const label of tagLabels) {
    const { tagId, isNew, similar } = await resolveTag(label, options);

    if (tagId) {
      tagIds.push(tagId);
      if (isNew) created++;
      else reused++;
    }

    if (similar && similar.length > 0) {
      allSimilar.push({ label, similar: similar.map(t => t.name) });
    }
  }

  return {
    tagIds,
    stats: {
      total: tagLabels.length,
      created,
      reused,
      similarGroups: allSimilar.length
    },
    similarInfo: allSimilar
  };
}

/**
 * 添加别名到现有标签
 *
 * @param {string} tagId - 目标标签 ID
 * @param {string} alias - 新别名
 * @returns {Promise<boolean>} 是否成功
 */
async function addAliasToTag(tagId, alias) {
  const cleanedAlias = cleanLabel(alias);
  if (!cleanedAlias) return false;

  const data = await chrome.storage.local.get(['tagsById']);
  const tagsById = data.tagsById || {};
  const tag = tagsById[tagId];

  if (!tag) {
    console.error(`[TagPilot] 标签 ${tagId} 不存在`);
    return false;
  }

  // 避免重复
  if (tag.aliases && tag.aliases.includes(cleanedAlias)) {
    return false;
  }

  tag.aliases = tag.aliases || [];
  tag.aliases.push(cleanedAlias);
  tag.updatedAt = Date.now();

  await chrome.storage.local.set({ tagsById });

  console.log(`[TagPilot] 为标签 "${tag.name}" 添加别名: ${cleanedAlias}`);
  return true;
}

/**
 * 重命名标签
 *
 * @param {string} tagId - 目标标签 ID
 * @param {string} newName - 新名称
 * @returns {Promise<boolean>} 是否成功
 */
async function renameTag(tagId, newName) {
  const cleanedName = cleanLabel(newName);
  if (!cleanedName) return false;

  const data = await chrome.storage.local.get(['tagsById']);
  const tagsById = data.tagsById || {};
  const tag = tagsById[tagId];

  if (!tag) {
    console.error(`[TagPilot] 标签 ${tagId} 不存在`);
    return false;
  }

  const oldName = tag.name;
  tag.name = cleanedName;
  tag.updatedAt = Date.now();

  await chrome.storage.local.set({ tagsById });

  console.log(`[TagPilot] 标签重命名: "${oldName}" → "${cleanedName}"`);
  return true;
}
