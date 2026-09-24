<template>
  <div class="max-w-lg">
    <el-card>
      <template #header><span class="font-medium text-white">账户设置</span></template>
      <el-form :model="form" label-width="90px" v-loading="loading">
        <el-form-item label="用户名">
          <el-input v-model="form.username" placeholder="管理员用户名" />
        </el-form-item>

        <el-form-item label="原密码">
          <el-input v-model="form.old_password" type="password" show-password placeholder="仅修改密码时需要" />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="form.new_password" type="password" show-password placeholder="至少 6 位，留空则不修改" />
        </el-form-item>
        <el-form-item label="确认新密码">
          <el-input v-model="form.confirm" type="password" show-password placeholder="再次输入新密码" @keyup.enter="save" />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="saving" @click="save">保存</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { api } from '../../api.js'

const loading = ref(false)
const saving = ref(false)
const form = ref({
  username: '',
  old_password: '',
  new_password: '',
  confirm: ''
})

async function save() {
  const f = form.value
  if (!f.username.trim()) return ElMessage.warning('用户名不能为空')
  const changePwd = f.new_password || f.confirm
  if (changePwd) {
    if (!f.old_password) return ElMessage.warning('修改密码需要填写原密码')
    if (f.new_password.length < 6) return ElMessage.warning('新密码至少 6 位')
    if (f.new_password !== f.confirm) return ElMessage.warning('两次输入的新密码不一致')
  }
  saving.value = true
  try {
    const payload = { username: f.username.trim() }
    if (changePwd) {
      payload.old_password = f.old_password
      payload.new_password = f.new_password
    }
    await api.put('/api/admin/account', payload)
    ElMessage.success(changePwd ? '账户信息与密码已保存' : '账户信息已保存')
    form.value.old_password = ''
    form.value.new_password = ''
    form.value.confirm = ''
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  loading.value = true
  try {
    const me = await api.get('/api/admin/account')
    form.value.username = me.username
  } finally {
    loading.value = false
  }
})
</script>
