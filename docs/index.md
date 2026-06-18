# BigV 文档

BigV 是一个用于模拟 AI 观众与主播互动的本地桌面控制台。本文档站用于固定 V1 边界、架构分层、开发路线和协作规范。

## 文档导航

- [项目概览（README 镜像）](./project-overview.md)
- [架构文档](./architecture.md)
- [开发 TODO](./todo.md)
- [开发启动](./guide/development.md)

## V1 固定边界

- 部署形态：本地单机、单直播间、单操作者。
- 输入优先级：主播语音主链路 > Echo-Live 增强 > 视觉上下文增强。
- 输出类型：`danmaku`、`gift`、`super_chat`、`membership`。
- Provider：仅承诺 OpenAI 兼容 HTTP 接口。
- 记忆层次：主播设定、长期互动事实、观众画像、场次摘要。

## 阅读顺序

1. 先读 [项目概览（README 镜像）](./project-overview.md) 了解目标和非目标。
2. 再读 [架构文档](./architecture.md) 确认模块边界和数据流。
3. 接着看 [开发 TODO](./todo.md) 拆分实现阶段。
4. 动手前补读 [开发启动](./guide/development.md)，并回看仓库根目录的 `AGENTS.md` 与 `DESIGN.md`。
