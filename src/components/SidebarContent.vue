<template>
  <div class="flex h-full w-full flex-col bg-ink-800">
    <div class="flex h-16 shrink-0 items-center gap-2.5 px-5">
      <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-800 shadow-glow">
        <el-icon><Star /></el-icon>
      </div>
      <span class="text-base font-semibold text-white">超级管家</span>
    </div>

    <el-menu
      :default-active="route.path"
      router
      class="flex-1 !min-h-0 overflow-y-auto !border-r-0 bg-transparent"
      @select="() => emit('navigate')"
    >
      <el-menu-item v-for="item in navItems" :key="item.path" :index="item.path">
        <el-icon><component :is="item.icon" /></el-icon><span>{{ item.label }}</span>
      </el-menu-item>
    </el-menu>

    <!-- 左下角固定操作 -->
    <div class="shrink-0 space-y-1 border-t border-brand-500/15 p-3">
      <router-link to="/" class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-brand-100/70 hover:bg-brand-500/15 hover:text-white" @click="emit('navigate')">
        <el-icon><Monitor /></el-icon>返回前台
      </router-link>
      <button class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-brand-100/70 hover:bg-brand-500/15 hover:text-white" @click="emit('logout')">
        <el-icon><SwitchButton /></el-icon>退出登录
      </button>
    </div>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router'

const route = useRoute()
const emit = defineEmits(['navigate', 'logout'])

// 图标均为全局注册的 Element Plus 图标组件
const navItems = [
  { path: '/admin/overview', icon: 'DataAnalysis', label: '概览' },
  { path: '/admin/subscriptions', icon: 'Bell', label: '订阅提醒' },
  { path: '/admin/monitors', icon: 'Monitor', label: '网站监控' },
  { path: '/admin/nav', icon: 'Collection', label: '导航管理' },
  { path: '/admin/channels', icon: 'Promotion', label: '通知渠道' },
  { path: '/admin/settings', icon: 'Setting', label: '系统设置' },
  { path: '/admin/account', icon: 'UserFilled', label: '账户' }
]
</script>
