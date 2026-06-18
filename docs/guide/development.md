# 开发启动

## 项目定位

当前仓库是 BigV 的桌面端工程骨架，技术栈为 Tauri 2 + Vue 3 + TypeScript。现阶段业务实现仍基于初始桌面壳，本仓库首先承载文档、工程工具链和后续业务接入边界。

## 项目结构

```text
BigV/
├── src/                 # Vue 3 前端壳层与页面骨架
├── src-tauri/           # Tauri 2 Rust 端
├── docs/                # VitePress 文档站
├── tests/               # Vitest + Testing Library
├── scripts/             # 本地开发脚本
├── README.md
├── DESIGN.md
└── AGENTS.md
```

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

- 首页、扩展页和应用文案仍是初始占位，不代表 BigV 的最终产品实现。
- 若开始接入业务能力，先对齐 `docs/architecture.md` 与 `docs/todo.md`，再决定代码落点。
