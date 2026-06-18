<script setup lang="ts">
import { ref } from "vue";
import { Copy, FolderOpen, MousePointer2, Pencil, Trash2 } from "@lucide/vue";
import Dropdown from "../components/Dropdown.vue";
import ViewTabs from "../components/ViewTabs.vue";
import { APP_SHELL_COPY } from "../config/appShell";
import "../styles/page.css";

const cardMenu = [
  { id: "rename", label: "重命名", icon: Pencil, onSelect: () => {} },
  { id: "duplicate", label: "复制页面", icon: Copy, onSelect: () => {} },
  {
    id: "delete",
    label: "删除",
    icon: Trash2,
    danger: true,
    confirmLabel: "确认删除？再点一次",
    onSelect: () => {},
  },
];

const menuMotionOptions: Array<{
  value: "bottom" | "top";
  label: string;
  hint: string;
}> = [
  { value: "bottom", label: "向下展开", hint: "从按钮点击点展开菜单" },
  { value: "top", label: "向上展开", hint: "用于贴近页面底部的场景" },
];

const menuMotionValue = ref<"bottom" | "top">("bottom");
</script>

<template>
  <section>
    <ViewTabs active="overview" />
    <div class="page-header">
      <div>
        <h1>{{ APP_SHELL_COPY.homeTitle }}</h1>
        <p>{{ APP_SHELL_COPY.homeDescription }}</p>
      </div>
      <button type="button" class="ghost">
        <FolderOpen :size="14" aria-hidden="true" />
        {{ APP_SHELL_COPY.homeActionLabel }}
      </button>
    </div>

    <div class="template-grid">
      <div class="card" v-context-menu="cardMenu">
        <h2>应用外壳</h2>
        <p class="muted">
          已包含自绘标题栏、可拖拽侧栏、暗浅主题和紧凑工作台 UI。
        </p>
      </div>
      <div class="card" v-context-menu="cardMenu">
        <h2>右键菜单接口</h2>
        <p class="muted">
          <MousePointer2 :size="13" aria-hidden="true" />
          组件可以在点击位置声明自己的菜单项。
        </p>
      </div>
      <div class="card">
        <h2>验证脚本</h2>
        <ul class="kv">
          <li><span>前端测试</span><span>yarn test</span></li>
          <li><span>前端构建</span><span>yarn build</span></li>
          <li><span>完整验证</span><span>yarn verify</span></li>
        </ul>
      </div>
      <div class="card">
        <h2>Dropdown 动效</h2>
        <p class="muted">
          模板已抽出与右键菜单一致的锚点缩放过渡，可复用在普通下拉中。
        </p>
        <Dropdown
          v-model="menuMotionValue"
          :options="menuMotionOptions"
          placement="bottom"
          placeholder="选择菜单动效"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.template-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 900px) {
  .template-grid {
    grid-template-columns: 1fr;
  }
}
</style>
