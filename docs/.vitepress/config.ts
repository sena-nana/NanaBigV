import { defineConfig } from "vitepress";

const repository = process.env.GITHUB_REPOSITORY?.split("/")[1];
const isProjectPages = repository && !repository.endsWith(".github.io");
const base = process.env.GITHUB_ACTIONS && isProjectPages ? `/${repository}/` : "/";

export default defineConfig({
  title: "BigV",
  description: "AI audience simulation control console for a single livestream room.",
  base,
  themeConfig: {
    nav: [
      { text: "概览", link: "/" },
      { text: "架构", link: "/architecture" },
      { text: "TODO", link: "/todo" },
      { text: "开发启动", link: "/guide/development" },
    ],
    sidebar: [
      {
        text: "文档",
        items: [
          { text: "概览", link: "/" },
          { text: "架构文档", link: "/architecture" },
          { text: "开发 TODO", link: "/todo" },
          { text: "开发启动", link: "/guide/development" },
        ],
      },
    ],
    socialLinks: [],
  },
});
