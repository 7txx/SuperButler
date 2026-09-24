<template>
  <div class="max-w-3xl space-y-5">
    <!-- 基本信息 -->
    <el-card>
      <template #header><span class="font-medium text-white">基本信息</span></template>
      <el-form :model="form" label-width="100px" v-loading="loading">
        <el-form-item label="Logo">
          <div class="flex items-center gap-4">
            <div class="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-brand-500/20 bg-ink-700">
              <img v-if="logoPreview" :src="logoPreview" class="h-full w-full object-cover" />
              <el-icon v-else class="text-2xl text-brand-300/50"><Picture /></el-icon>
            </div>
            <div>
              <el-button :icon="Upload" @click="pickLogo">上传 Logo</el-button>
              <el-button v-if="logoPreview" link type="danger" @click="removeLogo">移除</el-button>
              <p class="mt-1 text-xs text-brand-200/45">支持 PNG/JPG/WebP/SVG，不超过 1MB</p>
            </div>
            <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" class="hidden" @change="onLogoChange" />
          </div>
        </el-form-item>
        <el-form-item label="站点标题">
          <el-input v-model="form.title" />
        </el-form-item>
        <el-form-item label="副标题">
          <el-input v-model="form.subtitle" />
        </el-form-item>
        <el-form-item label="站点描述">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="语言">
          <el-select v-model="form.language" class="w-40">
            <el-option label="简体中文" value="zh-CN" />
            <el-option label="English" value="en-US" />
          </el-select>
        </el-form-item>
        <el-form-item label="站点域名">
          <el-input v-model="form.domain" placeholder="留空则自动使用当前访问域名，如 https://example.com" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="save">保存设置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 备份恢复 -->
    <el-card>
      <template #header><span class="font-medium text-white">备份与恢复</span></template>
      <p class="mb-4 text-sm text-brand-200/55">
        导出全部导航、订阅、监控、渠道与设置为 JSON 文件（不含管理员账号）；导入将覆盖现有数据。
      </p>
      <el-button type="primary" plain :icon="Download" @click="exportBackup">导出备份</el-button>
      <el-button type="warning" plain :icon="Upload" @click="pickRestore">导入备份</el-button>
      <input ref="restoreInput" type="file" accept="application/json,.json" class="hidden" @change="onRestoreChange" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Upload, Download, Picture } from '@element-plus/icons-vue'
import { api } from '../../api.js'

const loading = ref(false)
const form = ref({ title: '', subtitle: '', description: '', language: 'zh-CN', domain: '' })
const logoPreview = ref('')
const fileInput = ref(null)
const restoreInput = ref(null)

function pickLogo() {
  fileInput.value.click()
}

function onLogoChange(e) {
  const file = e.target.files[0]
  e.target.value = ''
  if (!file) return
  if (file.size > 1024 * 1024) return ElMessage.error('图片不能超过 1MB')
  const reader = new FileReader()
  reader.onload = async () => {
    await api.put('/api/admin/settings/logo', { data: reader.result })
    logoPreview.value = `/api/public/logo?v=${Date.now()}`
    ElMessage.success('Logo 已更新')
  }
  reader.readAsDataURL(file)
}

async function removeLogo() {
  await api.del('/api/admin/settings/logo')
  logoPreview.value = ''
  ElMessage.success('Logo 已移除')
}

async function save() {
  await api.put('/api/admin/settings', form.value)
  ElMessage.success('设置已保存')
}

async function exportBackup() {
  const data = await api.get('/api/admin/settings/backup')
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `lover-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function pickRestore() {
  restoreInput.value.click()
}

function onRestoreChange(e) {
  const file = e.target.files[0]
  e.target.value = ''
  if (!file) return
  const reader = new FileReader()
  reader.onload = async () => {
    try {
      const json = JSON.parse(reader.result)
      await ElMessageBox.confirm('导入将覆盖当前全部数据，确定继续？', '危险操作', {
        type: 'warning',
        confirmButtonText: '覆盖导入'
      })
      await api.post('/api/admin/settings/restore', json)
      ElMessage.success('导入成功')
    } catch (err) {
      if (err !== 'cancel') ElMessage.error(err.message || '导入失败：文件格式不正确')
    }
  }
  reader.readAsText(file)
}

onMounted(async () => {
  loading.value = true
  try {
    form.value = await api.get('/api/admin/settings')
    if (form.value.logo_version !== '0') {
      logoPreview.value = `/api/public/logo?v=${form.value.logo_version}`
    }
  } finally {
    loading.value = false
  }
})
</script>
