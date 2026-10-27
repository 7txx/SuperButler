<template>
  <el-card>
    <!-- 标题与统计 -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-2xl font-bold text-white">服务器</h2>
      <div class="flex flex-wrap items-center gap-2 text-xs">
        <span class="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-brand-200/70">
          服务器总数 <b class="ml-1 text-sm text-white">{{ stats.total }}</b>
        </span>
        <span class="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-brand-200/70">
          在线节点 <b class="ml-1 text-sm text-emerald-400">{{ stats.online }}</b>
          <span class="text-brand-200/30">/</span>
          <b class="text-sm text-white">{{ stats.total }}</b>
        </span>
        <span class="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-brand-200/70">
          节点分组 <b class="ml-1 text-sm text-white">{{ stats.groups }}</b>
        </span>
        <span class="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-brand-200/70">
          隐藏节点 <b class="ml-1 text-sm text-white">{{ stats.hidden }}</b>
        </span>
      </div>
    </div>

    <!-- 筛选与操作 -->
    <div class="mt-4 flex flex-wrap items-center gap-2">
      <el-radio-group v-model="filter" size="small">
        <el-radio-button value="">全部</el-radio-button>
        <el-radio-button value="online">在线</el-radio-button>
        <el-radio-button value="offline">离线</el-radio-button>
      </el-radio-group>
      <el-input
        v-model="q"
        placeholder="查找服务器"
        clearable
        size="small"
        :prefix-icon="Search"
        class="w-44"
      />
      <el-button circle size="small" :icon="Refresh" @click="load" />

      <div class="ml-auto flex flex-wrap items-center gap-2">
        <el-select v-model="group" placeholder="全部分组" clearable size="small" class="w-28">
          <el-option v-for="g in groups" :key="g" :label="g" :value="g" />
        </el-select>
        <el-button size="small" :loading="checking" @click="checkNow">手动</el-button>
        <el-select v-model="sortKey" size="small" class="w-24">
          <el-option label="名称" value="name" />
          <el-option label="状态" value="status" />
        </el-select>
        <el-select v-model="sortOrder" size="small" class="w-24">
          <el-option label="升序" value="asc" />
          <el-option label="降序" value="desc" />
        </el-select>
        <el-button type="primary" size="small" :icon="Plus" @click="openCreate">添加服务器</el-button>
      </div>
    </div>

    <!-- 服务器节点 -->
    <div class="mt-5 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
      <div class="mb-3 flex items-center justify-between">
        <div class="text-sm font-medium text-white">服务器节点</div>
        <div class="flex items-center gap-3">
          <div class="text-xs text-brand-200/40">当前 {{ list.length }} 个</div>
          <el-radio-group v-model="view" size="small">
            <el-radio-button value="grid" title="卡片视图">
              <el-icon><Grid /></el-icon>
            </el-radio-button>
            <el-radio-button value="list" title="列表视图">
              <el-icon><List /></el-icon>
            </el-radio-button>
          </el-radio-group>
        </div>
      </div>

      <div
        v-if="view === 'grid'"
        v-loading="loading"
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        <div
          v-for="row in list"
          :key="row.id"
          class="rounded-xl border border-white/10 bg-white/[0.03] p-4"
        >
          <!-- 卡片头部 -->
          <div class="flex items-start justify-between gap-2">
            <div class="flex min-w-0 items-start gap-2">
              <span class="mt-0.5 text-xl leading-none">{{ flagText(row) }}</span>
              <div class="min-w-0">
                <div class="flex min-w-0 items-center gap-2">
                  <span class="truncate font-medium text-white">{{ row.name }}</span>
                  <span
                    class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
                    :class="row.online ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/10 text-brand-200/50'"
                  >
                    {{ row.online ? '在线' : '离线' }}
                  </span>
                  <span v-if="row.hidden" class="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-brand-200/50">隐藏</span>
                </div>
                <div class="truncate text-xs text-brand-200/40">{{ row.region || '—' }}</div>
              </div>
            </div>
            <div class="flex shrink-0 items-center">
              <el-button link size="small" title="编辑" @click="openEdit(row)">
                <el-icon><EditPen /></el-icon>
              </el-button>
              <el-button link size="small" title="复制" @click="duplicate(row)">
                <el-icon><CopyDocument /></el-icon>
              </el-button>
              <el-button link size="small" title="安装命令" @click="openInstall(row)">
                <el-icon><Monitor /></el-icon>
              </el-button>
              <el-button link size="small" type="danger" title="删除" @click="remove(row)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </div>

          <!-- IP 地址 -->
          <div class="mt-3 rounded-lg border border-white/5 bg-ink-800/40 px-3 py-2">
            <div class="text-[11px] text-brand-200/40">IP 地址</div>
            <div class="mt-0.5 flex items-center gap-1.5">
              <span class="truncate text-sm text-white">{{ row.ip || '—' }}</span>
              <button
                v-if="row.ip"
                class="shrink-0 text-brand-200/40 transition hover:text-brand-300"
                title="复制 IP"
                @click="copy(row.ip)"
              >
                <el-icon class="text-xs"><CopyDocument /></el-icon>
              </button>
            </div>
          </div>

          <!-- 基础信息 -->
          <div class="mt-2 grid grid-cols-2 gap-2">
            <div class="rounded-lg border border-white/5 bg-ink-800/40 px-3 py-2">
              <div class="text-[11px] text-brand-200/40">Agent</div>
              <div class="mt-0.5 truncate text-sm text-white">{{ row.agent_version || '—' }}</div>
            </div>
            <div class="rounded-lg border border-white/5 bg-ink-800/40 px-3 py-2">
              <div class="text-[11px] text-brand-200/40">系统</div>
              <div class="mt-0.5 truncate text-sm text-white">{{ systemText(row) }}</div>
            </div>
            <div class="rounded-lg border border-white/5 bg-ink-800/40 px-3 py-2">
              <div class="text-[11px] text-brand-200/40">分组</div>
              <div class="mt-0.5 truncate text-sm text-white">{{ row.group_name || '—' }}</div>
            </div>
            <div class="rounded-lg border border-white/5 bg-ink-800/40 px-3 py-2">
              <div class="text-[11px] text-brand-200/40">账单</div>
              <div class="mt-0.5 truncate text-sm text-white">{{ row.bill || '—' }}</div>
            </div>
          </div>

          <div class="mt-2 text-[11px] text-brand-200/30">
            最后上报：{{ lastSeenText(row) }}
          </div>
        </div>
      </div>

      <!-- 列表视图 -->
      <el-table
        v-else
        v-loading="loading"
        :data="list"
        row-key="id"
        size="small"
        empty-text="暂无服务器"
        class="server-table"
      >
        <el-table-column label="服务器" min-width="200">
          <template #default="{ row }">
            <div class="flex items-center gap-2">
              <span class="text-lg leading-none">{{ flagText(row) }}</span>
              <div class="min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="truncate text-white">{{ row.name }}</span>
                  <span
                    v-if="row.hidden"
                    class="shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-brand-200/50"
                  >
                    隐藏
                  </span>
                </div>
                <div class="truncate text-[11px] text-brand-200/40">{{ row.region || '—' }}</div>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="88">
          <template #default="{ row }">
            <span
              class="rounded-full px-2 py-0.5 text-[11px] font-medium"
              :class="row.online ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/10 text-brand-200/50'"
            >
              {{ row.online ? '在线' : '离线' }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="IP 地址" min-width="160">
          <template #default="{ row }">
            <div class="flex items-center gap-1.5">
              <span class="truncate">{{ row.ip || '—' }}</span>
              <button
                v-if="row.ip"
                class="shrink-0 text-brand-200/40 transition hover:text-brand-300"
                title="复制 IP"
                @click="copy(row.ip)"
              >
                <el-icon class="text-xs"><CopyDocument /></el-icon>
              </button>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="Agent" width="90">
          <template #default="{ row }">{{ row.agent_version || '—' }}</template>
        </el-table-column>

        <el-table-column label="系统" min-width="190">
          <template #default="{ row }">{{ systemText(row) }}</template>
        </el-table-column>

        <el-table-column label="分组" width="110">
          <template #default="{ row }">{{ row.group_name || '—' }}</template>
        </el-table-column>

        <el-table-column label="账单" width="100">
          <template #default="{ row }">{{ row.bill || '—' }}</template>
        </el-table-column>

        <el-table-column label="最后上报" width="150">
          <template #default="{ row }">{{ lastSeenText(row) }}</template>
        </el-table-column>

        <el-table-column label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <el-button link size="small" title="编辑" @click="openEdit(row)">
              <el-icon><EditPen /></el-icon>
            </el-button>
            <el-button link size="small" title="复制" @click="duplicate(row)">
              <el-icon><CopyDocument /></el-icon>
            </el-button>
            <el-button link size="small" title="安装命令" @click="openInstall(row)">
              <el-icon><Monitor /></el-icon>
            </el-button>
            <el-button link size="small" type="danger" title="删除" @click="remove(row)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="view === 'grid' && !loading && !list.length" class="py-12 text-center text-sm text-brand-200/40">
        暂无服务器
      </div>
    </div>

    <!-- 添加 / 编辑 -->
    <el-dialog v-model="dialog" :title="form.id ? '编辑服务器' : '添加服务器'" width="560px">
      <el-form :model="form" label-width="92px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="如：香港" />
        </el-form-item>
        <el-form-item label="地区">
          <el-input v-model="form.region" placeholder="如：Hong Kong, HK" />
        </el-form-item>
        <el-form-item label="国旗">
          <el-input v-model="form.flag" placeholder="两位国家代码，如 HK" maxlength="8" />
        </el-form-item>
        <el-form-item label="IP 地址">
          <el-input v-model="form.ip" placeholder="如：155.103.158.130" />
        </el-form-item>
        <el-form-item label="分组">
          <el-input v-model="form.group_name" placeholder="如：香港节点，可留空" />
        </el-form-item>
        <el-form-item label="账单">
          <el-input v-model="form.bill" placeholder="如：$5/月，可留空" />
        </el-form-item>
        <el-form-item label="到期日期">
          <el-date-picker
            v-model="form.expire_date"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="可留空"
            class="!w-full"
          />
        </el-form-item>
        <el-form-item label="流量重置日">
          <el-input-number v-model="form.traffic_reset_day" :min="1" :max="31" />
          <span class="ml-2 text-sm text-brand-200/50">号</span>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort_order" :min="0" :max="9999" />
        </el-form-item>
        <el-form-item label="隐藏">
          <el-switch v-model="form.hidden" />
        </el-form-item>
        <el-form-item label="告警">
          <el-switch v-model="form.alert_enabled" />
        </el-form-item>
        <el-form-item label="通知渠道">
          <el-select v-model="form.channel_ids" multiple clearable placeholder="不选=所有启用渠道" class="!w-full">
            <el-option v-for="ch in channels" :key="ch.id" :label="ch.name" :value="ch.id" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.alert_enabled" label="告警阈值">
          <div class="flex flex-wrap items-center gap-2 text-sm">
            <span class="text-brand-200/60">CPU</span>
            <el-input-number v-model="form.threshold_cpu" :min="1" :max="100" size="small" class="!w-20" />
            <span class="text-brand-200/40">%</span>
            <span class="ml-2 text-brand-200/60">内存</span>
            <el-input-number v-model="form.threshold_mem" :min="1" :max="100" size="small" class="!w-20" />
            <span class="text-brand-200/40">%</span>
            <span class="ml-2 text-brand-200/60">磁盘</span>
            <el-input-number v-model="form.threshold_disk" :min="1" :max="100" size="small" class="!w-20" />
            <span class="text-brand-200/40">%</span>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <!-- 安装命令 -->
    <el-dialog v-model="installDialog" title="安装 Agent" width="620px">
      <div v-if="installInfo" class="space-y-3 text-sm">
        <div>
          <div class="text-xs text-brand-200/40">上报地址</div>
          <div class="mt-1 break-all rounded-lg bg-white/[0.04] px-3 py-2 text-brand-100/80">{{ installInfo.report_url }}</div>
        </div>
        <div>
          <div class="text-xs text-brand-200/40">服务器 Token</div>
          <div class="mt-1 flex items-center gap-2">
            <span class="min-w-0 flex-1 break-all rounded-lg bg-white/[0.04] px-3 py-2">{{ installInfo.token }}</span>
            <el-button size="small" @click="copy(installInfo.token)">复制</el-button>
          </div>
        </div>
        <div>
          <div class="text-xs text-brand-200/40">在服务器上以 root 执行</div>
          <el-input
            type="textarea"
            :rows="4"
            readonly
            :model-value="installInfo.command"
            class="mt-1"
          />
          <el-button size="small" type="primary" class="mt-2" @click="copy(installInfo.command)">复制安装命令</el-button>
        </div>
        <div class="text-xs text-brand-200/40">
          适用于 Debian / Ubuntu 等带 systemd 的 Linux；Agent 默认每 60 秒上报一次。
        </div>
      </div>
      <template #footer>
        <el-button @click="rotate">重置 Token</el-button>
        <el-button @click="installDialog = false">关闭</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Refresh, EditPen, CopyDocument, Delete, Monitor, Grid, List } from '@element-plus/icons-vue'
import { api } from '../../api.js'

const rawList = ref([])
const channels = ref([])
const q = ref('')
const filter = ref('')
const group = ref('')
const sortKey = ref('name')
const sortOrder = ref('asc')
const view = ref(localStorage.getItem('sb:servers-view') === 'list' ? 'list' : 'grid')
const loading = ref(false)
const checking = ref(false)
const dialog = ref(false)
const installDialog = ref(false)
const installInfo = ref(null)

const stats = computed(() => ({
  total: rawList.value.length,
  online: rawList.value.filter((x) => x.online).length,
  groups: new Set(rawList.value.map((x) => x.group_name).filter(Boolean)).size,
  hidden: rawList.value.filter((x) => x.hidden).length
}))

const groups = computed(() =>
  [...new Set(rawList.value.map((x) => x.group_name).filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b), 'zh-CN')
  )
)

const list = computed(() => {
  const dir = sortOrder.value === 'desc' ? -1 : 1
  return rawList.value
    .filter((row) => {
      if (filter.value === 'online' && !row.online) return false
      if (filter.value === 'offline' && row.online) return false
      if (group.value && row.group_name !== group.value) return false
      if (q.value) {
        const kw = q.value.toLowerCase()
        const text = [row.name, row.ip, row.region, row.group_name].filter(Boolean).join(' ').toLowerCase()
        if (!text.includes(kw)) return false
      }
      return true
    })
    .sort((a, b) => {
      if (sortKey.value === 'status') {
        return ((a.online ? 1 : 0) - (b.online ? 1 : 0)) * dir || a.id - b.id
      }
      return String(a.name).localeCompare(String(b.name), 'zh-CN') * dir
    })
})

const emptyForm = () => ({
  id: null,
  name: '',
  flag: '',
  region: '',
  ip: '',
  group_name: '',
  bill: '',
  expire_date: '',
  traffic_reset_day: 1,
  sort_order: 0,
  hidden: false,
  alert_enabled: true,
  channel_ids: [],
  threshold_cpu: 90,
  threshold_mem: 90,
  threshold_disk: 90
})
const form = ref(emptyForm())

watch(view, (v) => localStorage.setItem('sb:servers-view', v))

function systemText(row) {
  return [row.os, row.arch].filter(Boolean).join(' / ') || '—'
}

function flagText(row) {
  const f = String(row.flag || '').trim()
  if (!f) return '🏳️'
  if (/^[a-zA-Z]{2}$/.test(f)) {
    return String.fromCodePoint(
      ...f
        .toUpperCase()
        .split('')
        .map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
    )
  }
  return f
}

function lastSeenText(row) {
  if (!row.last_seen) return '从未上报'
  const d = new Date(Number(row.last_seen) * 1000)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function load() {
  loading.value = true
  try {
    rawList.value = await api.get('/api/admin/servers')
  } finally {
    loading.value = false
  }
}

async function loadChannels() {
  try {
    channels.value = (await api.get('/api/admin/channels')).filter((c) => c.enabled)
  } catch {
    channels.value = []
  }
}

function openCreate() {
  form.value = emptyForm()
  dialog.value = true
}

function openEdit(row) {
  form.value = {
    ...emptyForm(),
    id: row.id,
    name: row.name,
    flag: row.flag,
    region: row.region,
    ip: row.ip,
    group_name: row.group_name,
    bill: row.bill,
    expire_date: row.expire_date || '',
    traffic_reset_day: row.traffic_reset_day || 1,
    sort_order: row.sort_order || 0,
    hidden: !!row.hidden,
    alert_enabled: !!row.alert_enabled,
    channel_ids: row.channel_ids
      ? String(row.channel_ids)
          .split(',')
          .map(Number)
          .filter(Boolean)
      : [],
    threshold_cpu: row.alert_config?.cpu || 90,
    threshold_mem: row.alert_config?.mem || 90,
    threshold_disk: row.alert_config?.disk || 90
  }
  dialog.value = true
}

async function save() {
  if (!form.value.name.trim()) return ElMessage.warning('请填写服务器名称')
  const payload = {
    name: form.value.name,
    flag: form.value.flag,
    region: form.value.region,
    ip: form.value.ip,
    group_name: form.value.group_name,
    bill: form.value.bill,
    expire_date: form.value.expire_date,
    traffic_reset_day: form.value.traffic_reset_day,
    sort_order: form.value.sort_order,
    hidden: form.value.hidden,
    alert_enabled: form.value.alert_enabled,
    channel_ids: form.value.channel_ids,
    alert_config: {
      cpu: form.value.threshold_cpu,
      mem: form.value.threshold_mem,
      disk: form.value.threshold_disk
    }
  }

  let newId = null
  if (form.value.id) {
    await api.put(`/api/admin/servers/${form.value.id}`, payload)
  } else {
    const r = await api.post('/api/admin/servers', payload)
    newId = r.id
  }
  ElMessage.success('已保存')
  dialog.value = false
  await load()
  if (newId) openInstall(rawList.value.find((x) => x.id === newId) || { id: newId, name: form.value.name })
}

async function duplicate(row) {
  await api.post(`/api/admin/servers/${row.id}/duplicate`)
  ElMessage.success('已复制，请为新节点安装 Agent')
  load()
}

async function remove(row) {
  await ElMessageBox.confirm(`确定删除「${row.name}」？该服务器的历史指标也会被删除。`, '提示', {
    type: 'warning'
  })
  await api.del(`/api/admin/servers/${row.id}`)
  ElMessage.success('已删除')
  load()
}

async function openInstall(row) {
  const data = await api.get(`/api/admin/servers/${row.id}/install`)
  installInfo.value = { ...data, id: row.id, name: row.name }
  installDialog.value = true
}

async function rotate() {
  if (!installInfo.value) return
  await ElMessageBox.confirm('重置后旧 Agent 会立即停止上报，需要重新安装或更新配置，确定继续？', '提示', {
    type: 'warning'
  })
  const r = await api.post(`/api/admin/servers/${installInfo.value.id}/rotate-token`)
  installInfo.value.token = r.token
  installInfo.value.command = installInfo.value.command.replace(
    /--token\s+\S+/,
    `--token ${r.token}`
  )
  ElMessage.success('Token 已重置')
  load()
}

async function checkNow() {
  checking.value = true
  try {
    const r = await api.post('/api/admin/servers/check')
    ElMessage({
      type: r.alerts ? 'warning' : 'success',
      message: `检查完成：在线 ${r.online} 个，离线 ${r.offline} 个，发送告警 ${r.alerts} 条`
    })
    load()
  } finally {
    checking.value = false
  }
}

async function copy(text) {
  const value = String(text || '')
  if (!value) return
  try {
    await navigator.clipboard.writeText(value)
    ElMessage.success('已复制')
  } catch {
    const ta = document.createElement('textarea')
    ta.value = value
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    ElMessage.success('已复制')
  }
}

onMounted(async () => {
  await Promise.all([load(), loadChannels()])
})
</script>
