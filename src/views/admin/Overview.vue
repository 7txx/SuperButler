<template>
  <div>
    <el-card class="mb-5">
      <div class="flex items-center gap-4">
        <div class="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-800 text-2xl shadow-glow">
          <el-icon><Star /></el-icon>
        </div>
        <div>
          <div class="text-lg font-semibold text-white">{{ data.name }}</div>
          <div class="text-sm text-brand-200/50">{{ data.version }}</div>
        </div>
      </div>
    </el-card>

    <div class="grid grid-cols-1 gap-5 sm:grid-cols-3">
      <el-card v-for="card in cards" :key="card.key" shadow="hover" class="cursor-pointer" @click="$router.push(card.to)">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-sm text-brand-200/60">{{ card.label }}</div>
            <div class="mt-2 text-3xl font-semibold text-white">{{ card.value }}</div>
          </div>
          <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/15 text-xl text-brand-300">
            <el-icon><component :is="card.icon" /></el-icon>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { api } from '../../api.js'

const data = ref({ name: '', version: '', counts: {} })

const cards = computed(() => [
  { key: 'subscriptions', label: '订阅总数', value: data.value.counts.subscriptions || 0, icon: 'Bell', to: '/admin/subscriptions' },
  { key: 'monitors', label: '网站监控', value: data.value.counts.monitors || 0, icon: 'Monitor', to: '/admin/monitors' },
  { key: 'bookmarks', label: '导航链接', value: data.value.counts.bookmarks || 0, icon: 'Collection', to: '/admin/nav' }
])

onMounted(async () => {
  data.value = await api.get('/api/admin/overview')
})
</script>
