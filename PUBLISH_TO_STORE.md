# Chrome Web Store 发布指南

本文档说明如何将 TagPilot 发布到 Chrome Web Store。

---

## 📋 发布前检查清单

### ✅ 代码准备

- [x] Manifest V3 格式正确
- [x] Service Worker 配置正确
- [x] 所有图标文件齐全（16x16, 48x48, 128x128）
- [x] 权限声明最小化且合理
- [x] 隐私政策文档已完成
- [x] README 和项目描述完善

### 📦 必需素材

- [ ] **应用图标**:
  - 128x128 px (必需)
  - 48x48 px
  - 16x16 px
  - ✅ 已有（在 `icons/` 目录）

- [ ] **商店截图** (至少 1 张，建议 5 张):
  - 尺寸: 1280x800 px 或 640x400 px
  - 格式: PNG 或 JPG
  - 内容: 展示扩展的主要功能界面
  
- [ ] **宣传图** (可选但推荐):
  - 尺寸: 440x280 px (小) / 920x680 px (大)
  - 用于商店列表页展示

- [ ] **其他素材**:
  - 详细描述（英文 + 中文）
  - 隐私政策 URL（可使用 GitHub Pages）
  - 支持链接（GitHub Issues）

---

## 🎨 准备商店截图

### 方法一：使用 Chrome 截图工具

1. 加载扩展到 Chrome
2. 打开扩展界面
3. 使用 Chrome DevTools 截图:
   ```
   打开 DevTools (F12) → 
   Cmd+Shift+P (Mac) 或 Ctrl+Shift+P (Windows) → 
   输入 "screenshot" → 
   选择 "Capture full size screenshot"
   ```

### 方法二：使用专业截图工具

推荐工具:
- **CleanShot X** (Mac) - 专业截图工具
- **Snagit** - 跨平台截图工具
- **Chrome Extension Screenshot** - 专门用于扩展截图

### 建议截图场景

1. **主界面** - 展示搜索和标签功能
2. **批量整理** - 展示批量处理进度
3. **设置页面** - 展示 API 配置界面
4. **标签浮层** - 展示网页上的标签确认浮层
5. **搜索结果** - 展示搜索和过滤功能

---

## 💰 注册开发者账号

### 步骤

1. 访问 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. 使用 Google 账号登录
3. 支付 **$5 USD** 一次性注册费（通过 Google Payments）
4. 填写开发者信息:
   - 开发者名称
   - 联系邮箱
   - 地址信息（用于税务）

### 注意事项

- 注册费为一次性费用，终身有效
- 需要完成 Google Payments 验证
- 审核通常需要 3-5 个工作日

---

## 📤 打包扩展程序

### 方法一：使用 Chrome 打包

1. 打开 `chrome://extensions/`
2. 启用 **开发者模式**
3. 点击 **打包扩展程序**
4. 选择项目根目录（`chrome-tagpilot/`）
5. Chrome 会生成:
   - `chrome-tagpilot.crx` - 扩展文件
   - `chrome-tagpilot.pem` - **私钥（重要：妥善保管！）**

### 方法二：手动打包（推荐）

```bash
# 在项目根目录
cd chrome-tagpilot
zip -r tagpilot-v1.0.0.zip . -x "*.git*" "*.DS_Store" "*.md"
```

---

## 🚀 上传到 Chrome Web Store

### 步骤

1. **进入开发者控制台**
   - 访问 https://chrome.google.com/webstore/devconsole
   - 点击 **新建项目**

2. **上传 ZIP 文件**
   - 选择打包好的 `.zip` 文件
   - 等待上传和验证

3. **填写商店列表信息**

   **基本信息**:
   - 名称: `TagPilot - AI 智能书签领航员`
   - 简短描述: `AI 自动为书签打标签，智能整理，快速搜索`
   - 详细描述: 使用 README 中的内容
   - 语言: 中文（简体）

   **分类和标签**:
   - 分类: 生产力工具 (Productivity)
   - 标签: 书签管理, AI, 生产力, 搜索

   **隐私和实践**:
   - 隐私政策 URL: 填写你的隐私政策页面地址
   - 可以使用 GitHub Pages 托管 PRIVACY.md

   **图片**:
   - 上传图标、截图、宣传图

   **商店列表**:
   - 详细描述（支持多语言）
   - 链接到支持网站

4. **提交审核**
   - 检查所有必填项
   - 点击 **提交审核**
   - 等待审核结果

---

## 🔐 托管隐私政策

### 方法一：使用 GitHub Pages（推荐）

1. 在 GitHub 仓库启用 Pages:
   - Settings → Pages
   - Source: Deploy from a branch
   - Branch: main /root
   - 保存

2. 访问 `https://jesse-ux.github.io/chrome-tagpilot/PRIVACY.md`

3. 将此 URL 填入商店列表

### 方法二：使用其他托管服务

- **Notion** - 创建隐私政策页面
- **Medium** - 发布隐私政策文章
- **个人博客** - 托管在你的网站

---

## 📝 商店描述模板

### 简短描述（128字符以内）

```
AI 自动为书签打标签，智能整理，快速搜索。支持 OpenAI 及多家国内 LLM 服务。
```

### 详细描述

```
✈️ TagPilot - 让书签管理如飞行般顺畅

🤖 AI 自动打标签
收藏时自动分析标题和页面内容，生成 3-5 个高质量标签

🔍 智能搜索
实时搜索标题、URL 和标签，秒出结果

📦 批量整理
一键为现有书签补全标签，显示实时进度

🏷️ 标签过滤
点击热门标签快速筛选，支持多标签组合查询

⚡ 隐私优先
所有数据存储在本地，API Key 仅保存在浏览器，不经过任何中间服务器

支持的 AI 服务：
• OpenAI (GPT-4o-mini)
• Kimi (月之暗面)
• 智谱 AI (GLM-4)
• 通义千问 (Qwen)
• 火山引擎 (ByteDance)

开源透明：代码完全开源，可自行审查
GitHub: https://github.com/jesse-ux/chrome-tagpilot
```

---

## ⏱️ 审核时间线

### 预期时间

- **初审核**: 3-5 个工作日
- **审核通过后**: 24小时内上架
- **更新发布**: 通常更快（1-2天）

### 审核常见问题

1. **权限过多** → 确保每个权限都有明确说明
2. **隐私政策缺失** → 必须提供隐私政策 URL
3. **描述不准确** → 确保描述与功能一致
4. **截图质量问题** → 使用高质量、清晰的截图

### 如果被拒

1. 仔细阅读拒绝原因
2. 修改代码或素材
3. 重新提交
4. 可以多次提交，无需额外费用

---

## 📊 发布后维护

### 更新流程

1. 修改代码和版本号 (manifest.json)
2. 重新打包
3. 上传到开发者控制台
4. 填写更新说明
5. 提交审核

### 版本号规范

遵循语义化版本 (Semantic Versioning):
- `1.0.0` → `1.0.1` (bug 修复)
- `1.0.0` → `1.1.0` (新功能)
- `1.0.0` → `2.0.0` (重大更新)

### 监控评价和反馈

- 定期查看商店评分和评论
- 回应用户问题
- 在 GitHub Issues 跟踪 bug

---

## 🔗 有用链接

- [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
- [Chrome Extensions Publishing](https://developer.chrome.com/docs/webstore/publish/)
- [Content Security Policy](https://developer.chrome.com/docs/extensions/mv3/content_security_policy/)
- [Best Practices](https://developer.chrome.com/docs/webstore/ux-best-practices/)

---

**祝发布顺利！🎉**
