# 开发启动

## 项目定位

当前仓库是 NaNaBigV 的桌面端工程，技术栈为 Tauri 2 + Vue 3 + TypeScript。产品定位为本地单直播间的 AI 观众氛围与直播控场助手，MVP 已围绕工作台、直播中控台、新建直播、AI 观众组、话题库、安全设置和弹幕记录组织。

## 项目结构

```text
NaNaBigV/
├── src/                 # Vue 3 前端页面、运行态和功能模块
├── src-tauri/           # Tauri 2 Rust 命令与本地 store
├── docs/                # VitePress 文档站
├── tests/               # Vitest + Testing Library
├── scripts/             # 本地开发脚本
├── README.md
├── DESIGN.md
└── AGENTS.md
```

关键落点：

- `src/features/liveConfig/`：直播方案、观众组、话题库、安全设置和生成记录的前端类型、API 与 store。
- `src-tauri/src/live_config.rs`：Tauri 本地配置读写命令。
- `src/features/workbench/`：主播语音、Echo-Live、planner、eventRuntime、provider 和记忆写回的运行态。
- `src/pages/`：NaNaBigV MVP 信息架构页面。

## 本地运行

本仓库通过 Corepack 使用 Yarn 4。建议从仓库根目录执行命令。

```bash
corepack enable
corepack prepare yarn@4.14.1 --activate
yarn install
yarn dev
yarn tauri:dev
```

`yarn tauri:dev` 会自动寻找可用本地端口，再把对应 `devUrl` 传给 Tauri。

## 文档开发

```bash
yarn docs:dev
yarn docs:build
```

文档站用于固定 V1 边界、架构和开发路线。涉及产品边界、架构职责或 TODO 顺序的改动，优先同步文档。

## 验证

```bash
yarn test
yarn build
cargo check --manifest-path src-tauri/Cargo.toml
yarn docs:build
yarn verify
```

- `yarn test`：前端单测。
- `yarn build`：前端构建。
- `cargo check --manifest-path src-tauri/Cargo.toml`：Tauri Rust 编译检查。
- `yarn docs:build`：文档站构建与链接基础校验。
- `yarn verify`：串行运行前端测试、前端构建和 Rust 编译检查。

按影响范围运行最小必要验证。文档改动至少建议执行 `yarn docs:build`。

## 当前注意事项

- V1 仍固定为本地单机、单直播间、单操作者，不提前扩展多租户、云调度或多直播间并发。
- 主播语音是主输入链路，Echo-Live 与视觉上下文只作为增强源。
- 输出类型仍固定为 `danmaku`、`gift`、`super_chat`、`membership`。
- 安全设置默认要求人工确认，不把 AI 输出包装成真实观众或真实付费行为。
