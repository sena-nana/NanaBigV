<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import {
  SETTINGS_TABS,
  SETTINGS_SECTIONS,
  normalizeSettingsTab,
} from "../config/appShell";
import "../styles/page.css";

const route = useRoute();
const activeTab = computed(() => normalizeSettingsTab(route.query.tab));
const activeTabSection = computed(() => SETTINGS_SECTIONS[activeTab.value]);
const activeTabLabel = computed(
  () => SETTINGS_TABS.find((tab) => tab.key === activeTab.value)?.label ?? "设置",
);
</script>

<template>
  <section class="settings-page">
    <div class="page-header">
      <h1>{{ activeTabLabel }}</h1>
    </div>

    <component :is="activeTabSection" />
  </section>
</template>
