<script setup lang="ts">
import type { Component } from "vue";
import { RouterView } from "vue-router";
import type { UIPolicy } from "./ui/contract";

defineProps<{
  provider?: Component;
  policy: UIPolicy;
  hosts?: Component;
}>();
</script>

<template>
  <component :is="provider" v-if="provider" :policy="policy">
    <RouterView />
    <component :is="hosts" v-if="hosts" />
  </component>
  <template v-else>
    <RouterView />
    <component :is="hosts" v-if="hosts" />
  </template>
</template>
