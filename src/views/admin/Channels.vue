<template>
  <el-card>
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm text-brand-200/55">
        通知渠道专为订阅到期提醒服务；可添加多个渠道，也可为单个订阅单独绑定。
      </p>
      <el-button type="primary" :icon="Plus" @click="openCreate">添加渠道</el-button>
    </div>

    <el-table :data="list" v-loading="loading" border>
      <el-table-column label="名称" prop="name" min-width="140" />
      <el-table-column label="类型" width="140">
        <template #default="{ row }">{{ typeLabel(row.type) }}</template>
      </el-table-column>
      <el-table-column label="启用" width="90">
        <template #default="{ row }">
          <el-switch :model-value="row.enabled" @change="(v) => toggle(row, v)" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="210">
        <template #default="{ row }">
          <el-button link type="success" size="small" :loading="row._testing" @click="test(row)">发送测试</el-button>
          <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" size="small" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialog" :title="form.id ? '编辑渠道' : '添加渠道'" width="540px">
      <el-form :model="form" label-width="110px">
        <el-form-item label="渠道名称" required>
          <el-input v-model="form.name" placeholder="如：我的微信 / QQ邮箱" />
        </el-form-item>
        <el-form-item label="渠道类型" required>
          <el-radio-group v-model="form.type" :disabled="!!form.id" @change="onTypeChange">
            <el-radio-button v-for="(t, key) in types" :key="key" :value="key">{{ t.label }}</el-radio-button>
          </el-radio-group>
          <p v-if="currentType" class="mt-1 text-xs text-brand-200/45">{{ currentType.desc }}</p>
        </el-form-item>
        <el-form-item
          v-for="f in currentFields"
          :key="f.key"
          :label="f.label"
          :required="f.required"
        >
          <el-input
            v-model="form.config[f.key]"
            :placeholder="f.placeholder || ''"
          />
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
import { Plus } from '@element-plus/icons-vue'
import { api } from '../../api.js'

const list = ref([])
const types = ref({})
const loading = ref(false)
const dialog = ref(false)

const emptyForm = () => ({ id: null, name: '', type: 'pushplus', config: {}, enabled: true })
const form = ref(emptyForm())

const currentType = computed(() => types.value[form.value.type])
const currentFields = computed(() => (currentType.value ? currentType.value.fields : []))

function typeLabel(t) {
  return types.value[t] ? types.value[t].label : t
}

function onTypeChange() {
  // SMTP 渠道默认填 QQ 邮箱服务器，减少输入
  form.value.config = form.value.type === 'smtp' ? { host: 'smtp.qq.com' } : {}
}

async function load() {
  loading.value = true
  try {
    list.value = await api.get('/api/admin/channels')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  form.value = emptyForm()
  dialog.value = true
}

async function openEdit(row) {
  const full = await api.get(`/api/admin/channels/${row.id}`)
  form.value = {
    ...emptyForm(),
    ...full,
    config: JSON.parse(full.config || '{}')
  }
  dialog.value = true
}

async function save() {
  const f = form.value
  if (!f.name) return ElMessage.warning('请填写渠道名称')
  for (const field of currentFields.value) {
    if (field.required && !f.config[field.key]) {
      return ElMessage.warning(`请填写「${field.label}」`)
    }
  }
  if (f.id) {
    await api.put(`/api/admin/channels/${f.id}`, f)
  } else {
    delete f.id
    await api.post('/api/admin/channels', f)
  }
  ElMessage.success('已保存')
  dialog.value = false
  load()
}

async function test(row) {
  row._testing = true
  try {
    await api.post(`/api/admin/channels/${row.id}/test`)
    ElMessage.success('测试消息发送成功，请注意查收')
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    row._testing = false
  }
}

async function toggle(row, v) {
  await api.patch(`/api/admin/channels/${row.id}`, { enabled: v })
  row.enabled = v
}

async function remove(row) {
  await ElMessageBox.confirm(`确定删除渠道「${row.name}」？`, '提示', { type: 'warning' })
  await api.del(`/api/admin/channels/${row.id}`)
  ElMessage.success('已删除')
  load()
}

onMounted(async () => {
  types.value = await api.get('/api/admin/channels/types')
  load()
})
</script>
