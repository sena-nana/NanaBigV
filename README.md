# NaNaBigV

NaNaBigV 是一个面向主播的本地直播辅助产品，用于直播演练、冷场救场、弹幕灵感、互动节奏控制和控场提词。

系统以主播语音转文本为主输入，结合 Echo-Live 输入和直播画面识别摘要作为增强上下文，请求 OpenAI 兼容格式的 AI provider，生成可审核的观众互动候选，并通过改造 [xfgryujk/blivechat](https://github.com/xfgryujk/blivechat) 前端呈现本地弹幕互动效果。

## V1 目标

- 围绕一个主播、一个直播间、本地单操作者完成最小闭环。
- 以主播语音为必需输入，支持 Echo-Live 与视觉上下文作为可选增强。
- 支持 4 类互动输出：`danmaku`、`gift`、`super_chat`、`membership`。
- 用结构化长期记忆保存主播设定、历史互动事实、观众画像和场次摘要，持续影响后续生成。
- 将主界面定位为直播节奏控制台，而不是伪造真实观众的聊天机器人。

## MVP 页面

- 工作台：快速开始、继续配置、状态检查和最近复盘摘要。
- 新建直播：4 步向导配置直播类型、主题、主播状态、观众氛围和输出模式。
- 直播中控台：展示直播状态、弹幕候选、主播提词、冷场救急按钮和本地 blivechat 投递。
- AI 观众：管理观众组、语言风格、频率、行为概率、边界规则和记忆范围。
- 话题库：维护今日大纲、话题卡和梗库，所有话题都标注使用阶段。
- 安全设置：管理输出模式、安全规则、质量过滤和频率限制。
- 弹幕记录：查看生成、采用、忽略、改写、拦截和投递协议记录。

## 非目标

- 多直播间并发管理。
- 云端编排、多租户或团队协作后台。
- 真实平台运营后台、账号体系或平台级权限管理。
- OBS / VTube Studio 深度集成、模板市场、素材库和完整直播复盘时间线。
- 首版即重度插件化或厂商私有协议适配。

## 文档

- [架构文档](./docs/architecture.md)
- [开发 TODO](./docs/todo.md)
- [开发启动](./docs/guide/development.md)
- [Agent 协作规范](./AGENTS.md)
- [视觉设计标准](./DESIGN.md)

## 上游项目致谢

### Echo-Live

- 致谢：[sheep-realms/Echo-Live](https://github.com/sheep-realms/Echo-Live) 是一个基于 Echo 的、面向无声系虚拟主播直播的仿视觉小说对话框 OBS 插件；NaNaBigV 将其视为可选增强输入源，而不是内置替代物。
- 许可说明：Echo-Live 仓库当前标注为 GPL-3.0，实际接入或二次分发时需要单独遵循其上游许可与文档约束。

### blivechat

- 致谢：[xfgryujk/blivechat](https://github.com/xfgryujk/blivechat) 提供了用于 OBS 的 B 站直播评论栏与前端渲染思路，NaNaBigV 的互动展示层基于其前端效果和事件呈现方向进行改造。
- 许可说明：blivechat 仓库当前标注为 MIT，NaNaBigV 在引用或改造相关实现时应保留必要的上游归属与许可信息。

## 本地命令

```bash
corepack enable
yarn install
yarn dev
yarn tauri:dev
yarn docs:dev
yarn docs:build
```

如需完整验证，可执行：

```bash
yarn verify
```

`yarn verify` 会串行运行前端测试、前端构建和 Tauri Rust 编译检查。
