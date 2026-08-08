<script setup lang="ts">
import { APP_METADATA } from "@lilia/ui/shell/config";
import "@lilia/ui/styles/page.css";
</script>

<template>
  <div class="card">
    <h2>关于</h2>
    <ul class="kv">
      <li><span>名称</span><span>{{ APP_METADATA.productTitle }}</span></li>
      <li><span>版本</span><span>{{ APP_METADATA.version }}</span></li>
      <li><span>框架</span><span>Tauri 2 + Vue 3 · LiliaUI</span></li>
    </ul>
  </div>
</template>
