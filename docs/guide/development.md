# 开发启动

## 项目定位

当前仓库是 NaNaBigV 的桌面端工程，技术栈为 Tauri 2 + Vue 3 + TypeScript。产品定位为本地单直播间的 AI 观众氛围与直播控场助手，MVP 已围绕工作台、直播中控台、新建直播、AI 观众组、话题库、安全设置和弹幕记录组织。

## 项目结构

```text
NaNaBigV/
├── src/                 # Vue 3 前端：装配层、业务页、运行态
│   ├── app.ts           # createBigVApp 装配入口
│   ├── ui/              # LiliaUI facade（preset / ActiveShell / styles）
│   ├── pages/           # NaNaBigV MVP 业务页面
│   └── features/        # liveConfig / workbench / provider / memory 等
├── src-tauri/           # Tauri 2 Rust 命令、lilia plugin 与本地 store
├── docs/                # VitePress 文档站
├── tests/               # Vitest + Testing Library
├── scripts/             # LiliaUI 依赖切换与 bundle guard
├── lilia.tools.profile.mjs
├── README.md
├── DESIGN.md
└── AGENTS.md
```

关键落点：

- UI 基建依赖 **sena-nana/LiliaUI**（`@lilia/ui` / `build` / `tools` / `config` / `theme` 等，GitHub 同 commit pin）。
- `src/ui/`：应用侧 facade；业务页从本地入口或 `@lilia/*` 导入共享壳层与控件。
- `src/features/liveConfig/`：直播方案、观众组、话题库、安全设置和生成记录。
- `src-tauri/src/live_config.rs`：Tauri 本地配置读写命令。
- `src/features/workbench/`：主播语音、Echo-Live、planner、eventRuntime、provider 和记忆写回的运行态。
- `src/pages/`：NaNaBigV MVP 信息架构页面。

## 本地运行

本仓库固定使用 Node.js 26.5.0、Corepack 0.35.0 和 Yarn 4.17.1。Node.js 26 不再内置 Corepack，建议从仓库根目录执行命令。

```bash
npm install --global corepack@0.35.0
corepack enable
corepack yarn install --immutable
yarn dev
yarn tauri:dev
```

- `yarn dev` / `yarn tauri:dev` 走 `lilia-build`。
- `yarn liliaui:status` 查看 LiliaUI 依赖来源；`yarn liliaui:local` / `yarn liliaui:remote` 可在本地 portal 与远端 pin 之间切换。

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

- `yarn test`：`lilia-build test` 前端单测。
- `yarn build`：`lilia-build build` + UI bundle guard。
- `cargo check --manifest-path src-tauri/Cargo.toml`：Tauri Rust 编译检查（含 `tauri-plugin-lilia`）。
- `yarn docs:build`：文档站构建与链接基础校验。
- `yarn verify`：完整应用验证（含 cargo check）。

按影响范围运行最小必要验证。文档改动至少建议执行 `yarn docs:build`。

## 当前注意事项

- V1 仍固定为本地单机、单直播间、单操作者，不提前扩展多租户、云调度或多直播间并发。
- 主播语音是主输入链路，Echo-Live 与视觉上下文只作为增强源。
- 输出类型仍固定为 `danmaku`、`gift`、`super_chat`、`membership`。
- 安全设置默认要求人工确认，不把 AI 输出包装成真实观众或真实付费行为。
