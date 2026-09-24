<template>
  <el-card>
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div class="flex w-full flex-wrap items-center gap-3 sm:w-auto">
        <el-input v-model="q" placeholder="搜索网站名称" clearable class="w-full sm:w-56" :prefix-icon="Search" />
        <el-radio-group v-model="filter">
          <el-radio-button value="">全部</el-radio-button>
          <el-radio-button value="up">正常</el-radio-button>
          <el-radio-button value="down">失效</el-radio-button>
        </el-radio-group>
      </div>
      <div class="flex items-center gap-2">
        <el-button :loading="checkingAll" :icon="Refresh" @click="checkAll">手动检测</el-button>
        <el-button type="primary" :icon="Plus" @click="openCreate">添加网站</el-button>
      </div>
    </div>

    <!-- 汇总 -->
    <div class="mb-5">
      <h2 class="text-2xl font-bold text-white">网站监控</h2>
      <p class="mt-1 text-sm">
        <span class="font-semibold text-emerald-400">{{ stats.up }} 正常</span>
        <span class="mx-1.5 text-brand-200/30">/</span>
        <span class="font-semibold text-red-400">{{ stats.down }} 失效</span>
        <span class="mx-1.5 text-brand-200/30">/</span>
        <span class="text-brand-100/80">{{ stats.total }} 总数</span>
      </p>
    </div>

    <!-- 监控列表 -->
    <div v-loading="loading" class="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02]">
      <div class="divide-y divide-white/5">
        <div
          v-for="row in list"
          :key="row.id"
          class="flex items-center gap-3 px-4 py-4 sm:gap-4 sm:px-5"
        >
          <!-- 可用率胶囊 -->
          <div
            class="w-16 shrink-0 rounded-full py-1.5 text-center text-xs font-semibold sm:w-20 sm:text-sm"
            :class="rateClass(row)"
          >
            {{ uptimeRate(row) === null ? '—' : `${uptimeRate(row)}%` }}
          </div>

          <!-- 名称与状态（网址不在列表显示） -->
          <div class="min-w-0 flex-1">
            <div class="flex min-w-0 items-center gap-1.5">
              <span class="truncate font-medium text-white">{{ row.name }}</span>
              <a
                :href="row.url"
                target="_blank"
                rel="noopener"
                class="shrink-0 text-brand-200/40 transition hover:text-brand-300"
              >
                <el-icon class="text-sm"><TopRight /></el-icon>
              </a>
            </div>
            <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-brand-200/60 sm:text-sm">
              <span :class="statusClass(row)">{{ statusText(row) }}</span>
              <span v-if="row.response_ms != null">{{ row.response_ms }}ms</span>
              <span class="text-brand-200/40">每 {{ Math.round(row.interval_seconds / 60) }} 分钟</span>
              <span v-if="row.last_checked_at" class="text-brand-200/40">{{ row.last_checked_at }}</span>
            </div>
          </div>

          <!-- 操作 -->
          <div class="flex shrink-0 items-center sm:gap-1">
            <el-switch
              :model-value="row.enabled"
              size="small"
              class="mr-1 hidden sm:inline-flex"
              @change="(v) => toggle(row, v)"
            />
            <el-button circle size="small" :loading="row._checking" @click="check(row)">
              <el-icon><Refresh /></el-icon>
            </el-button>
            <el-button circle size="small" @click="openEdit(row)">
              <el-icon><EditPen /></el-icon>
            </el-button>
            <el-button circle size="small" type="danger" @click="remove(row)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>
      </div>
      <div v-if="!loading && !list.length" class="py-14 text-center text-sm text-brand-200/40">
        暂无数据
      </div>
    </div>

    <el-dialog v-model="dialog" :title="form.id ? '编辑网站' : '添加网站'" width="520px">
      <el-form :model="form" label-width="92px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="如：我的博客" />
        </el-form-item>
        <el-form-item label="网址" required>
          <el-input v-model="form.url" placeholder="https://example.com" />
        </el-form-item>
        <el-form-item label="检测间隔">
          <el-input-number v-model="form.interval_minutes" :min="1" :max="1440" />
          <span class="ml-2 text-sm text-brand-200/50">分钟</span>
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Refresh, TopRight, EditPen, Delete } from '@element-plus/icons-vue'
import { api } from '../../api.js'

const rawList = ref([])
const q = ref('')
const filter = ref('')
const loading = ref(false)
const checkingAll = ref(false)
const dialog = ref(false)

const stats = computed(() => ({
  total: rawList.value.length,
  up: rawList.value.filter((x) => x.status === 'up').length,
  down: rawList.value.filter((x) => x.status === 'down').length
}))

const list = computed(() =>
  rawList.value.filter((row) => {
    if (filter.value && row.status !== filter.value) return false
    if (q.value && !row.name.toLowerCase().includes(q.value.toLowerCase())) return false
    return true
  })
)

const emptyForm = () => ({
  id: null,
  name: '',
  url: '',
  interval_minutes: 60,
  enabled: true
})
const form = ref(emptyForm())

async function load() {
  loading.value = true
  try {
    rawList.value = await api.get('/api/admin/monitors')
  } finally {
    loading.value = false
  }
}

/** 历史可用率；从未检测时为 null */
function uptimeRate(row) {
  if (!row.check_count) return null
  return Math.round((row.up_count / row.check_count) * 100)
}
function rateClass(row) {
  const r = uptimeRate(row)
  if (r === null) return 'bg-white/5 text-brand-200/40'
  if (r >= 90) return 'bg-emerald-500/15 text-emerald-400'
  if (r >= 50) return 'bg-orange-500/15 text-orange-400'
  return 'bg-red-500/15 text-red-400'
}

function statusText(row) {
  if (row.status === 'up') return '正常'
  if (row.status === 'down') return '失效'
  return '未检测'
}
function statusClass(row) {
  if (row.status === 'up') return 'text-emerald-400'
  if (row.status === 'down') return 'text-red-400'
  return 'text-brand-200/50'
}

function openCreate() {
  form.value = emptyForm()
  dialog.value = true
}

function openEdit(row) {
  form.value = {
    ...row,
    interval_minutes: Math.round(row.interval_seconds / 60)
  }
  dialog.value = true
}

async function save() {
  const payload = {
    name: form.value.name,
    url: form.value.url,
    interval_seconds: form.value.interval_minutes * 60,
    enabled: form.value.enabled
  }
  if (form.value.id) {
    await api.put(`/api/admin/monitors/${form.value.id}`, payload)
  } else {
    await api.post('/api/admin/monitors', payload)
  }
  ElMessage.success('已保存')
  dialog.value = false
  load()
}

async function checkAll() {
  if (!rawList.value.length) return ElMessage.info('暂无需要检测的网站')
  checkingAll.value = true
  try {
    const r = await api.post('/api/admin/monitors/check-all')
    ElMessage({
      type: r.down ? 'warning' : 'success',
      message: `检测完成：共 ${r.total} 个，正常 ${r.up} 个，失效 ${r.down} 个`
    })
    load()
  } finally {
    checkingAll.value = false
  }
}

async function check(row) {
  row._checking = true
  try {
    await api.post(`/api/admin/monitors/${row.id}/check`)
    await load()
  } finally {
    row._checking = false
  }
}

async function toggle(row, v) {
  await api.put(`/api/admin/monitors/${row.id}`, {
    name: row.name,
    url: row.url,
    interval_seconds: row.interval_seconds,
    enabled: v
  })
  row.enabled = v
}

async function remove(row) {
  await ElMessageBox.confirm(`确定删除「${row.name}」？`, '提示', { type: 'warning' })
  await api.del(`/api/admin/monitors/${row.id}`)
  ElMessage.success('已删除')
  load()
}

onMounted(load)
</script>
