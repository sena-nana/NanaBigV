# BigV

BigV 是一个面向单机单直播间的本地桌面控制台，用于模拟 AI 观众与主播互动。

系统以主播语音转文本为主输入，结合 Echo-Live 输入和直播画面识别摘要作为增强上下文，请求 OpenAI 兼容格式的 AI provider，生成贴近真实直播间节奏的观众反应，并通过改造 [xfgryujk/blivechat](https://github.com/xfgryujk/blivechat) 前端呈现弹幕互动效果。

## V1 目标

- 围绕一个主播、一个直播间、本地单操作者完成最小闭环。
- 以主播语音为必需输入，支持 Echo-Live 与视觉上下文作为可选增强。
- 支持 4 类互动输出：`danmaku`、`gift`、`super_chat`、`membership`。
- 用结构化长期记忆保存主播设定、历史互动事实、观众画像和场次摘要，持续影响后续生成。
- 在视觉上呈现“像真实直播间”的互动密度，但实现上明确区分输入、编排、生成、投递 4 个阶段。

## 核心能力

- 多源上下文接入：主播语音、Echo-Live 输入、视觉摘要。
- OpenAI 兼容 provider 适配：模型、参数、连通性与响应解析。
- 观众模拟：人设池、同接节奏、互动概率、冷热场调度。
- 结构化长期记忆：主播设定、长期事实、观众画像、场次摘要。
- 前端互动投递：基于 blivechat 改造的弹幕、礼物、SC、舰长渲染。

## 非目标

- 多直播间并发管理。
- 云端编排、多租户或团队协作后台。
- 真实平台运营后台、账号体系或平台级权限管理。
- 房管、抽奖、活动脚本、运营战役编排等复杂活动系统。
- 首版即重度插件化或厂商私有协议适配。

## 当前仓库状态

当前仓库仍保留 Tauri + Vue 初始桌面壳实现，本轮文档先固定 BigV 的产品边界、架构分层和开发路线，不包含业务实现切换。

## 文档

- [架构文档](./docs/architecture.md)
- [开发 TODO](./docs/todo.md)
- [开发启动](./docs/guide/development.md)
- [Agent 协作规范](./AGENTS.md)
- [视觉设计标准](./DESIGN.md)

## 上游项目致谢

### Echo-Live

- 致谢：[sheep-realms/Echo-Live](https://github.com/sheep-realms/Echo-Live) 是一个基于 Echo 的、面向无声系虚拟主播直播的仿视觉小说对话框 OBS 插件；BigV 将其视为可选增强输入源，而不是内置替代物。
- 许可说明：Echo-Live 仓库当前标注为 GPL-3.0，实际接入或二次分发时需要单独遵循其上游许可与文档约束。

### blivechat

- 致谢：[xfgryujk/blivechat](https://github.com/xfgryujk/blivechat) 提供了用于 OBS 的 B 站直播评论栏与前端渲染思路，BigV 的互动展示层基于其前端效果和事件呈现方向进行改造。
- 许可说明：blivechat 仓库当前标注为 MIT，BigV 在引用或改造相关实现时应保留必要的上游归属与许可信息。

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

`yarn verify` 会串行运行前端测试、前端构建和 Tauri Rust 编译检查。当前业务代码仍是初始壳骨架，验证主要用于保证文档与工程骨架没有被破坏。
