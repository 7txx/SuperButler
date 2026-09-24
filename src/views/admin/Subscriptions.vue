<template>
  <el-card>
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <el-input v-model="q" placeholder="搜索名称 / 备注 / 标签" clearable class="w-full sm:w-64" :prefix-icon="Search" @input="load" />
      <el-button type="primary" :icon="Plus" @click="openCreate">增加订阅</el-button>
    </div>

    <el-table :data="list" v-loading="loading" stripe>
      <!-- 名称 + 类型小标签 -->
      <el-table-column label="名称" min-width="150">
        <template #default="{ row }">
          <div class="font-medium text-white">{{ row.name }}</div>
          <div class="mt-1 flex flex-wrap gap-1">
            <el-tag size="small" :type="typeMeta[row.type].tag" effect="plain">
              {{ typeMeta[row.type].label }}
            </el-tag>
            <el-tag v-if="row.is_lunar" size="small" type="warning" effect="plain">农历</el-tag>
            <el-tag v-if="row.pending_renew" size="small" type="danger" effect="plain">待续期</el-tag>
          </div>
        </template>
      </el-table-column>

      <!-- 下次到期 -->
      <el-table-column label="下次到期" min-width="185">
        <template #default="{ row }">
          <div :class="daysClass(row.days_left)" class="font-medium">
            {{ daysText(row.days_left) }}
          </div>
          <div class="mt-0.5 text-xs text-brand-200/55">
            {{ row.is_lunar ? row.target_lunar : row.target_date }}
          </div>
          <div v-if="row.is_lunar" class="text-xs text-brand-200/35">{{ row.target_date }}</div>
        </template>
      </el-table-column>

      <!-- 已运行 -->
      <el-table-column label="已运行" width="100">
        <template #default="{ row }">{{ row.run_days }} 天</template>
      </el-table-column>

      <!-- 上次续期 -->
      <el-table-column label="上次续期" min-width="150">
        <template #default="{ row }">
          <span v-if="!row.last_renew_at" class="text-brand-200/35">—</span>
          <template v-else>
            <div>{{ row.last_renew_at }}</div>
            <div v-if="row.is_lunar" class="text-xs text-brand-200/45">{{ row.last_renew_lunar }}</div>
          </template>
        </template>
      </el-table-column>

      <!-- 周期 -->
      <el-table-column label="周期" width="100">
        <template #default="{ row }">{{ row.period_text }}</template>
      </el-table-column>

      <!-- 操作 -->
      <el-table-column label="操作" width="230">
        <template #default="{ row }">
          <el-switch
            :model-value="row.enabled"
            @change="(v) => toggle(row, v)"
            inline-prompt
            active-text="启"
            inactive-text="停"
          />
          <el-button link type="primary" size="small" @click="renew(row)">续期</el-button>
          <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" size="small" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 编辑弹窗 -->
    <el-dialog v-model="dialog" :title="form.id ? '编辑订阅' : '增加订阅'" width="640px">
      <el-form :model="form" label-width="92px">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="域名/生日" />
        </el-form-item>
        <el-form-item label="类型">
          <el-radio-group v-model="form.type">
            <el-radio-button value="cycle">循环订阅</el-radio-button>
            <el-radio-button value="reset">到期重置</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="农历日期">
          <el-switch v-model="form.is_lunar" active-text="按农历计算（生日等）" />
        </el-form-item>
        <el-form-item label="到期日期" required>
          <el-date-picker
            v-model="form.target_date"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择公历到期日期（农历项选对应公历日即可）"
            class="!w-full"
          />
        </el-form-item>
        <el-form-item label="周期">
          <el-input-number v-model="form.period_value" :min="1" />
          <el-select v-model="form.period_unit" class="ml-2 w-24">
            <el-option label="天" value="day" />
            <el-option label="个月" value="month" />
            <el-option label="年" value="year" />
          </el-select>
        </el-form-item>
        <el-form-item label="提前提醒">
          <el-select v-model="form.remind_days" placeholder="选择开始提醒的时间" class="!w-full">
            <el-option v-for="d in [30, 14, 7, 3, 1, 0]" :key="d" :label="d === 0 ? '到期当天开始' : `提前 ${d} 天开始`" :value="d" />
          </el-select>
          <p class="mt-1 text-xs text-brand-200/40">到达所选时间后每天发送一次通知，直到你点击续期</p>
        </el-form-item>
        <el-form-item label="通知渠道">
          <el-select v-model="form.channel_ids" multiple clearable placeholder="留空则发送到全部已启用渠道" class="!w-full">
            <el-option v-for="ch in channelList" :key="ch.id" :label="ch.name" :value="ch.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="自动续期">
          <el-switch v-model="form.auto_renew" active-text="到期后自动顺延（到期重置类型不受此影响）" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
        </el-form-item>
        <el-collapse class="w-full">
          <el-collapse-item title="更多信息（标签 / 金额 / 备注）" name="more">
            <el-form-item label="标签">
              <el-input v-model="form.tags" placeholder="多个标签用逗号分隔" />
            </el-form-item>
            <el-form-item label="账单金额">
              <el-input-number v-model="form.amount" :min="0" :precision="2" />
              <el-input v-model="form.currency" class="ml-2 w-20" />
            </el-form-item>
            <el-form-item label="备注">
              <el-input v-model="form.remark" type="textarea" :rows="2" />
            </el-form-item>
          </el-collapse-item>
        </el-collapse>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import { api } from '../../api.js'

const typeMeta = {
  cycle: { label: '循环订阅', tag: '' },
  reset: { label: '到期重置', tag: 'success' }
}

const list = ref([])
const channelList = ref([])
const q = ref('')
const loading = ref(false)
const dialog = ref(false)

const emptyForm = () => ({
  id: null,
  name: '',
  type: 'cycle',
  is_lunar: false,
  target_date: '',
  period_value: 1,
  period_unit: 'year',
  remind_days: 7,
  channel_ids: [],
  auto_renew: true,
  enabled: true,
  tags: '',
  amount: 0,
  currency: 'CNY',
  remark: ''
})
const form = ref(emptyForm())

async function load() {
  loading.value = true
  try {
    const query = q.value ? `?q=${encodeURIComponent(q.value)}` : ''
    list.value = await api.get(`/api/admin/subscriptions${query}`)
  } finally {
    loading.value = false
  }
}

function daysText(n) {
  if (n < 0) return `已过期 ${-n} 天`
  if (n === 0) return '今天到期'
  return `剩余 ${n} 天`
}
function daysClass(n) {
  if (n < 0) return 'text-red-400'
  if (n <= 3) return 'text-orange-400'
  return 'text-emerald-400'
}

function openCreate() {
  form.value = emptyForm()
  dialog.value = true
}

function openEdit(row) {
  form.value = {
    ...emptyForm(),
    ...row,
    channel_ids: row.channel_ids || []
  }
  dialog.value = true
}

async function save() {
  if (!form.value.name || !form.value.target_date) {
    return ElMessage.warning('请填写名称和到期日期')
  }
  const payload = { ...form.value }
  if (form.value.id) {
    await api.put(`/api/admin/subscriptions/${form.value.id}`, payload)
  } else {
    delete payload.id
    await api.post('/api/admin/subscriptions', payload)
  }
  ElMessage.success('已保存')
  dialog.value = false
  load()
}

async function toggle(row, v) {
  await api.patch(`/api/admin/subscriptions/${row.id}`, { enabled: v })
  row.enabled = v
}

async function renew(row) {
  const r = await api.post(`/api/admin/subscriptions/${row.id}/renew`)
  ElMessage.success(`已续期，下次到期 ${r.target_date}`)
  load()
}

async function remove(row) {
  await ElMessageBox.confirm(`确定删除「${row.name}」？`, '提示', { type: 'warning' })
  await api.del(`/api/admin/subscriptions/${row.id}`)
  ElMessage.success('已删除')
  load()
}

onMounted(async () => {
  channelList.value = await api.get('/api/admin/channels')
  load()
})
</script>
