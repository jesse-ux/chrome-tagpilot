# ✈️ TagPilot - AI 智能书签领航员

让你的书签管理如飞行般顺畅 - 自动为书签打标签、智能整理、快速搜索。

## ✨ 功能特性

- **🤖 AI 自动分类**：添加书签时自动分析内容并生成标签
- **🧩 标签确认浮层**：网页右上角弹出可编辑浮层，手动修正标签
- **🔍 快速搜索**：实时搜索标题、URL 和标签
- **🏷️ 标签过滤**：点击热门标签快速筛选
- **📦 批量整理**：一键为现有书签补全标签
- **⚡️ 离线优先**：规则引擎作为备用，不依赖 API 也能用

## 🎨 设计理念

采用"数字档案室"美学：
- 工业实用主义与复古未来主义的结合
- JetBrains Mono 等宽字体营造技术感
- 荧光绿 (#00ff9d) + 深黑 (#0a0a0a) 配色
- 终端机风格的交互体验

## 📦 安装步骤

### 1. 克隆或下载项目

```bash
cd ~/Documents/mcp/smart-bookmarks
```

### 2. 准备图标

在 `icons/` 目录下放置以下图标：
- `icon16.png` (16x16)
- `icon48.png` (48x48)
- `icon128.png` (128x128)

可以使用以下工具生成：
- https://www.favicon-generator.org/
- 或在 Figma/Canva 创建一个简单的书图标（建议紫色渐变）

### 3. 加载扩展到 Chrome

1. 打开 Chrome，访问 `chrome://extensions/`
2. 右上角开启"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `smart-bookmarks` 文件夹

### 4. 配置 API（支持国内模型）

1. 点击扩展图标打开 popup
2. 点击"系统设置"按钮

**使用国内模型服务**：
- **API 地址**：
  - 智谱 AI：`https://open.bigmodel.cn/api/paas/v4`
  - Kimi（月之暗面）：`https://api.moonshot.cn/v1`
  - 火山引擎（字节）：`https://ark.cn-beijing.volces.com/api/v3`
  - 通义千问：`https://dashscope.aliyuncs.com/compatible-mode/v1`
  - 留空则使用 OpenAI 官方：`https://api.openai.com/v1`

- **API Key**：输入对应服务的 API Key
- **模型**：
  - 智谱：`glm-4-flash` 或 `glm-4-plus`
  - Kimi：`moonshot-v1-8k`
  - 火山：`ep-20241105174816-lwftb`（你的端点 ID）
  - 通义：`qwen-turbo`
  - OpenAI：`gpt-4o-mini`

3. 点击"测试配置"按钮验证配置是否正确
4. 测试成功后点击"保存配置"

**注意**：API Key 仅存储在本地，不会上传到任何服务器。

## 🚀 使用方法

### 自动分类新收藏

正常收藏书签即可，扩展会自动：
1. 分析网页内容和标题
2. 生成 3-5 个相关标签
3. 存储标签到本地
4. 在网页右上角显示可编辑标签浮层（不操作则保留模型标签）

### 批量整理现有书签

1. 打开扩展 popup
2. 点击"批量整理"按钮
3. 等待处理完成（会显示进度）

### 搜索书签

1. 点击扩展图标
2. 在搜索框输入关键词
3. 实时过滤结果，点击即可打开

### 按标签过滤

- 点击搜索框下方的热门标签
- 或在搜索框直接输入标签名

## 🛠️ 技术栈

- **Manifest V3**：Chrome 扩展最新标准
- **OpenAI API**：GPT-4o-mini 用于内容分析
- **Chrome Storage API**：本地存储标签数据
- **Chrome Bookmarks API**：监听和查询书签

## 📋 配置说明

### config.json 结构

```json
{
  "apiEndpoint": "https://api.openai.com/v1",
  "openaiApiKey": "你的 API Key",
  "model": "gpt-4o-mini",
  "autoTag": true,
  "maxRetries": 3,
  "language": "zh-CN",
  "debug": false,
  "debugEvidence": false
}
```

### 支持的模型

**OpenAI 系列**：
- `gpt-4o-mini`（推荐）：便宜、快速
- `gpt-4o`：效果更好，稍贵

**国内模型**（需要配置 apiEndpoint）：
- 智谱：`glm-4-flash`（免费）、`glm-4-plus`
- Kimi：`moonshot-v1-8k`、`moonshot-v1-32k`
- 火山引擎：`ep-*****`（推理端点 ID）
- 通义千问：`qwen-turbo`、`qwen-plus`

## 💡 使用技巧

1. **首次使用**：先点击"批量整理"为现有书签补标签
2. **搜索效率**：优先搜索标签，匹配更精准
3. **API 成本**：
   - OpenAI gpt-4o-mini 约 $0.15/1M tokens，处理 100 个书签订阅 $0.01
   - **推荐使用智谱 glm-4-flash**：完全免费，效果好，速度快
4. **离线使用**：即使不配置 API Key，规则引擎也能生成基础标签

## 🇨🇳 国内模型推荐

**智谱 AI**（强烈推荐）：
- 完全免费，无需担心成本
- 中文理解能力强
- 速度快，响应稳定
- 配置示例：
  - API 地址：`https://open.bigmodel.cn/api/paas/v4`
  - 模型：`glm-4-flash`
  - 获取 API Key：https://open.bigmodel.cn/usercenter/apikeys

## 🔒 隐私说明

- 所有数据存储在本地浏览器（Chrome Storage）
- 不会上传任何书签内容到外部服务器（除了 OpenAI API）
- API Key 仅用于调用 OpenAI，不存储在云端
- 代码开源，可自行审查

## 📝 待办事项

- [ ] 支持标签分组
- [ ] 支持导出书签（含标签）
- [ ] 支持导入带标签的书签
- [ ] 添加图标生成脚本
- [ ] 多语言支持

## 🐛 已知问题

1. 部分网站可能无法通过 CORS 获取内容（会fallback 到规则引擎）
2. 批量处理时可能触发 API 限流（已内置延迟）

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📧 联系方式

如有问题或建议，请提交 GitHub Issue。
