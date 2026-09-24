<template>
  <div class="flex h-screen">
    <!-- 侧边栏（手机端隐藏） -->
    <aside class="relative hidden w-60 shrink-0 flex-col border-r border-brand-500/15 bg-ink-800 md:flex">
      <SidebarContent @logout="logout" />
    </aside>

    <!-- 手机端抽屉 -->
    <el-drawer v-model="drawerOpen" title="超级管家" direction="ltr" size="260px">
      <div class="flex h-full flex-col">
        <SidebarContent @logout="logout" @navigate="drawerOpen = false" />
      </div>
    </el-drawer>

    <!-- 内容区 -->
    <div class="flex flex-1 flex-col overflow-hidden">
      <header class="flex h-16 shrink-0 items-center gap-3 border-b border-brand-500/15 bg-ink-800/60 px-4 md:px-6">
        <button class="text-brand-100/80 hover:text-white md:hidden" @click="drawerOpen = true">
          <el-icon :size="20"><Menu /></el-icon>
        </button>
        <h1 class="truncate text-base font-medium text-white">{{ $route.meta.title }}</h1>
      </header>
      <main class="flex-1 overflow-y-auto bg-ink-900 p-4 md:p-6">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { api } from '../api.js'
import SidebarContent from '../components/SidebarContent.vue'

const router = useRouter()
const drawerOpen = ref(false)

async function logout() {
  await ElMessageBox.confirm('确定要退出登录吗？', '提示', { type: 'warning' })
  await api.post('/api/auth/logout')
  router.push('/login')
}

onMounted(async () => {
  try {
    const me = await api.get('/api/auth/me')
    if (!me.login) router.replace('/login')
  } catch {
    router.replace('/login')
  }
})
</script>
