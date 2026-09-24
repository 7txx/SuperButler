<template>
  <div class="relative flex min-h-screen items-center justify-center">
    <div class="starfield">
      <span
        v-for="s in stars"
        :key="s.id"
        class="star"
        :style="{
          left: s.x + '%',
          top: s.y + '%',
          width: s.r + 'px',
          height: s.r + 'px',
          '--dur': s.dur + 's',
          '--delay': s.delay + 's'
        }"
      />
    </div>

    <div class="glass relative z-10 w-[calc(100%-2rem)] max-w-sm rounded-2xl p-6 shadow-card sm:p-8">
      <div class="mb-6 text-center">
        <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-800 text-xl shadow-glow">
          <el-icon><Star /></el-icon>
        </div>
        <h1 class="text-lg font-semibold text-white">{{ isSetup ? '初始化管理员' : '后台登录' }}</h1>
        <p class="mt-1 text-xs text-brand-200/50">
          {{ isSetup ? '首次使用，请创建管理员账户' : '超级管家 · 订阅提醒 · 网站监控' }}
        </p>
      </div>

      <el-form label-position="top" @submit.prevent>
        <el-form-item label="用户名">
          <el-input v-model="form.username" size="large" placeholder="管理员用户名" :prefix-icon="User" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" size="large" placeholder="至少 6 位" :prefix-icon="Lock" show-password @keyup.enter="submit" />
        </el-form-item>
        <el-form-item v-if="isSetup" label="确认密码">
          <el-input v-model="form.confirm" type="password" size="large" placeholder="再次输入密码" :prefix-icon="Lock" show-password @keyup.enter="submit" />
        </el-form-item>
      </el-form>

      <el-button type="primary" size="large" class="w-full" :loading="loading" @click="submit">
        {{ isSetup ? '创建并进入' : '登 录' }}
      </el-button>

      <router-link to="/" class="mt-4 block text-center text-xs text-brand-200/50 hover:text-white">
        ← 返回前台
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import { api } from '../../api.js'

const router = useRouter()
const isSetup = ref(false)
const loading = ref(false)
const form = ref({ username: '', password: '', confirm: '' })

const stars = Array.from({ length: 90 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  r: Math.random() * 2 + 0.6,
  dur: Math.random() * 3 + 2,
  delay: Math.random() * 4
}))

async function submit() {
  const { username, password, confirm } = form.value
  if (!username || !password) return ElMessage.warning('请填写用户名和密码')
  if (password.length < 6) return ElMessage.warning('密码至少 6 位')
  if (isSetup.value && password !== confirm) return ElMessage.warning('两次输入的密码不一致')
  loading.value = true
  try {
    if (isSetup.value) {
      await api.post('/api/auth/setup', { username, password })
    } else {
      await api.post('/api/auth/login', { username, password })
    }
    ElMessage.success(isSetup.value ? '创建成功' : '登录成功')
    router.push('/admin/overview')
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    const s = await api.get('/api/auth/status')
    isSetup.value = !s.hasAdmin
  } catch {}
})
</script>
