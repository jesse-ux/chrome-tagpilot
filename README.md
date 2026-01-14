# ✈️ TagPilot - AI 智能书签领航员

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green?logo=google-chrome)](https://chrome.google.com/webstore)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> 让书签管理像飞行一样顺畅：**自动打标签、批量整理、快速搜索**

支持 OpenAI 与多家国内 LLM 服务（Kimi / 智谱 / 通义 / 火山等），API Key **仅保存在本地**。

## 📖 目录

- [功能特性](#-功能特性)
- [设计理念](#-设计理念)
- [安装步骤](#-安装步骤)
- [配置 API](#-配置-api)
- [使用方法](#-使用方法)
- [技术栈](#-技术栈)
- [使用建议](#-使用建议)
- [隐私说明](#-隐私说明)
- [已知问题](#-已知问题)
- [贡献指南](#-贡献指南)

---

## ✨ 功能特性

### 🤖 AI 自动打标签
收藏时自动分析标题/页面摘要，生成 3–5 个高质量标签（宁缺毋滥）

### 🧩 标签确认浮层
网页右上角弹出可编辑浮层，支持一键修正/删除/补充

### 🔍 快速搜索
实时搜索标题、URL 与标签，秒开结果

### 🏷️ 标签过滤
点击热门标签快速筛选；也支持在搜索框输入标签名

### 📦 批量整理
一键为现有书签补全标签（显示进度）

### ⚡ 离线可用
未配置 API Key 时启用规则兜底（基础标签/类型推断），核心搜索与筛选仍可用

> **说明**：AI 打标签需要联网调用模型；**搜索、过滤、已保存标签的展示**不依赖联网。

---

## 🎨 设计理念

**"数字档案室"美学**

- 工业实用主义 × 复古未来主义
- JetBrains Mono 等宽字体营造技术感
- 荧光绿 `#00ff9d` + 深黑 `#0a0a0a` 的高对比配色
- 终端风交互：更专注、更高效

---

## 📦 安装步骤

### 方法一：开发者模式安装

#### 1. 克隆项目

```bash
git clone https://github.com/jesse-ux/chrome-tagpilot.git
cd chrome-tagpilot
```

#### 2. 准备图标

在 `icons/` 目录下已有以下文件：
- `icon16.png` (16×16)
- `icon48.png` (48×48)
- `icon128.png` (128×128)

如需自定义，可使用：
- [Favicon Generator](https://favicon.io/)（在线生成）
- Figma / Canva 设计统一风格图标

#### 3. 加载扩展到 Chrome

1. 打开 `chrome://extensions/`
2. 右上角开启 **开发者模式**
3. 点击 **加载已解压的扩展程序**
4. 选择项目根目录（`chrome-tagpilot/`）

### 方法二：从 Chrome Web Store 安装

> 即将上线...

---

## 🔧 配置 API

### 配置步骤

1. 点击扩展图标打开侧边栏
2. 进入 **系统设置**
3. 填写配置并点击 **测试配置** → **保存**

### 支持的 LLM 服务

| 服务商 | API 地址 | 推荐模型 |
|--------|---------|---------|
| **OpenAI** | `https://api.openai.com/v1` | `gpt-4o-mini` |
| **Kimi** | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` |
| **智谱 AI** | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-flash` / `glm-4-plus` |
| **火山引擎** | `https://ark.cn-beijing.volces.com/api/v3` | `ep-*****` (推理端点 ID) |
| **通义千问** | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-turbo` / `qwen-plus` |

> **提示**：留空 `apiEndpoint` 则默认使用 OpenAI 官方地址。

### 配置示例

```json
{
  "apiEndpoint": "https://api.openai.com/v1",
  "openaiApiKey": "YOUR_API_KEY",
  "model": "gpt-4o-mini",
  "autoTag": true,
  "maxRetries": 3,
  "language": "zh-CN"
}
```

---

## 🚀 使用方法

### 📌 自动为新书签打标签

正常收藏书签即可，TagPilot 会：

1. 抓取页面摘要（失败则退化为仅使用标题与 URL）
2. 生成 3–5 个标签
3. 保存到本地
4. 在网页右上角展示可编辑浮层

### 📦 批量整理已有书签

1. 打开扩展界面
2. 点击 **批量整理**
3. 等待进度完成（处理过程中会自动节流，避免限流）

### 🔍 搜索书签

1. 点击扩展图标
2. 在搜索框输入关键词
3. 结果实时过滤，点击即可打开

### 🏷️ 按标签过滤

- 点击热门标签快速筛选
- 或在搜索框输入标签名（可配合多个关键词）

---

## 🛠️ 技术栈

- **Manifest V3** - Chrome 扩展最新标准
- **OpenAI-compatible API** - 用于内容分析与标签生成
- **Chrome Storage API** - 本地存储标签与配置
- **Chrome Bookmarks API** - 监听与查询书签
- **Jina.ai Proxy** - CORS 代理获取网页内容
- **规则引擎** - 无 API 时兜底生成基础标签

---

## 💡 使用建议

### 提高效率

- **首次使用**：先运行一次"批量整理"，让旧书签快速可检索
- **搜索技巧**：优先用标签关键词（例如 "TTS / 工作流 / 论文 / 文档"）
- **降低成本**：先用更轻量模型（如 `gpt-4o-mini` / `glm-4-flash`），需要更高质量再上更强模型

### 常见问题

**Q: 部分网站无法抓取摘要？**
A: 这很常见。部分站点反爬或动态渲染导致摘要获取失败，此时会自动退化为"标题+URL"打标（仍可用）。

**Q: 批量处理触发限流？**
A: 已内置延迟与重试机制，但仍建议分批运行大量书签。

---

## 🔒 隐私说明

- **数据存储**：书签标签与配置均存储在本地浏览器（Chrome Storage）
- **网络请求**：当开启 AI 自动打标签时，会把必要信息（标题/URL/页面摘要）发送到你配置的模型服务
- **开源透明**：代码开源，可自行审查与二次开发
- **无服务器**：无中间服务器，直接连接到你配置的 LLM 服务

---

## 🐛 已知问题

- 部分网站可能无法抓取摘要（CORS/反爬/Cloudflare），会自动回退到标题与 URL
- 批量处理可能触发模型限流：已内置延迟与重试机制（仍建议分批运行）

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 开发流程

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

---

## 📧 联系方式

- **GitHub Issues**: [提交问题](https://github.com/jesse-ux/chrome-tagpilot/issues)
- **Author**: Jesse

---

<p align="center">
  <b>让书签管理如飞行般顺畅 ✈️</b>
</p>