<template>
  <el-tabs v-model="tab" class="min-h-[60vh]">
    <!-- ============ 分类管理 ============ -->
    <el-tab-pane label="分类管理" name="categories">
      <div class="mb-4 flex justify-end">
        <el-button type="primary" :icon="Plus" @click="openCategory()">新增分类</el-button>
      </div>
      <el-table :data="categoryRows" row-key="id" border default-expand-all :tree-props="{ children: '_children' }">
        <el-table-column label="名称" prop="name" min-width="200" />
        <el-table-column label="排序" prop="sort_order" width="90" />
        <el-table-column label="默认推荐" width="110">
          <template #default="{ row }">
            <el-tag v-if="row.is_default" type="warning">推荐</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="170">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openCategory(row)">编辑</el-button>
            <el-button link type="primary" size="small" @click="openCategory(null, row.id)">加子级</el-button>
            <el-button link type="danger" size="small" @click="removeCategory(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-dialog v-model="categoryDialog" :title="categoryForm.id ? '编辑分类' : '新增分类'" width="460px">
        <el-form :model="categoryForm" label-width="80px">
          <el-form-item label="名称" required>
            <el-input v-model="categoryForm.name" />
          </el-form-item>
          <el-form-item label="上级分类">
            <el-select v-model="categoryForm.parent_id" class="!w-full">
              <el-option label="顶级分类" :value="0" />
              <el-option
                v-for="c in categoryOptions"
                :key="c.id"
                :label="c.label"
                :value="c.id"
                :disabled="categoryForm.id === c.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="排序">
            <el-input-number v-model="categoryForm.sort_order" :min="0" />
          </el-form-item>
          <el-form-item label="默认推荐">
            <el-switch v-model="categoryForm.is_default" active-text="打开网站默认显示该分类" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="categoryDialog = false">取消</el-button>
          <el-button type="primary" @click="saveCategory">保存</el-button>
        </template>
      </el-dialog>
    </el-tab-pane>

    <!-- ============ 书签管理 ============ -->
    <el-tab-pane label="书签管理" name="bookmarks">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <el-select v-model="bookmarkFilter" placeholder="按分类筛选" clearable class="w-full sm:w-56" @change="loadBookmarks">
          <el-option v-for="c in categoryOptions" :key="c.id" :label="c.label" :value="c.id" />
        </el-select>
        <el-button type="primary" :icon="Plus" @click="openBookmark()">新增网站</el-button>
      </div>
      <el-table :data="bookmarkRows" border>
        <el-table-column label="图标" width="64">
          <template #default="{ row }">
            <div class="flex h-8 w-8 items-center justify-center overflow-hidden rounded bg-ink-600">
              <img v-if="row.icon" :src="row.icon" class="h-6 w-6 object-contain" />
              <span v-else class="text-xs text-brand-300">{{ row.name.slice(0, 1) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="名称" prop="name" min-width="130" />
        <el-table-column label="所属分类" min-width="130">
          <template #default="{ row }">{{ categoryName(row.category_id) }}</template>
        </el-table-column>
        <el-table-column label="网址" prop="url" min-width="200" show-overflow-tooltip />
        <el-table-column label="描述" prop="description" min-width="160" show-overflow-tooltip />
        <el-table-column label="操作" width="140">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openBookmark(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="removeBookmark(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-dialog v-model="bookmarkDialog" :title="bookmarkForm.id ? '编辑网站' : '新增网站'" width="520px">
        <el-form :model="bookmarkForm" label-width="80px">
          <el-form-item label="名称" required>
            <el-input v-model="bookmarkForm.name" />
          </el-form-item>
          <el-form-item label="分类" required>
            <el-select v-model="bookmarkForm.category_id" class="!w-full">
              <el-option v-for="c in categoryOptions" :key="c.id" :label="c.label" :value="c.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="网址" required>
            <el-input v-model="bookmarkForm.url" placeholder="https://" />
          </el-form-item>
          <el-form-item label="图标">
            <el-input v-model="bookmarkForm.icon" placeholder="图标图片地址（留空显示首字母）" />
          </el-form-item>
          <el-form-item label="描述">
            <el-input v-model="bookmarkForm.description" type="textarea" :rows="2" />
          </el-form-item>
          <el-form-item label="排序">
            <el-input-number v-model="bookmarkForm.sort_order" :min="0" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="bookmarkDialog = false">取消</el-button>
          <el-button type="primary" @click="saveBookmark">保存</el-button>
        </template>
      </el-dialog>
    </el-tab-pane>

    <!-- ============ 搜索引擎 ============ -->
    <el-tab-pane label="搜索引擎" name="engines">
      <div class="mb-4 flex justify-end">
        <el-button type="primary" :icon="Plus" @click="openEngine()">新增引擎</el-button>
      </div>
      <el-table :data="engineRows" border>
        <el-table-column label="名称" prop="name" min-width="130" />
        <el-table-column label="搜索地址（{q} 为关键词）" prop="url_template" min-width="280" show-overflow-tooltip />
        <el-table-column label="站内" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.is_internal" size="small">站内</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="排序" prop="sort_order" width="80" />
        <el-table-column label="启用" width="80">
          <template #default="{ row }">
            <el-switch
              :model-value="row.is_active"
              :disabled="row.is_internal"
              @change="(v) => toggleEngine(row, v)"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEngine(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="removeEngine(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-dialog v-model="engineDialog" :title="engineForm.id ? '编辑引擎' : '新增引擎'" width="500px">
        <el-form :model="engineForm" label-width="92px">
          <el-form-item label="名称" required>
            <el-input v-model="engineForm.name" />
          </el-form-item>
          <el-form-item label="站内搜索">
            <el-switch v-model="engineForm.is_internal" active-text="站内搜索无需填写地址" />
          </el-form-item>
          <el-form-item v-if="!engineForm.is_internal" label="搜索地址" required>
            <el-input v-model="engineForm.url_template" placeholder="https://www.google.com/search?q={q}" />
          </el-form-item>
          <el-form-item label="图标">
            <el-input v-model="engineForm.icon" placeholder="可选" />
          </el-form-item>
          <el-form-item label="排序">
            <el-input-number v-model="engineForm.sort_order" :min="0" />
          </el-form-item>
          <el-form-item label="启用">
            <el-switch v-model="engineForm.is_active" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="engineDialog = false">取消</el-button>
          <el-button type="primary" @click="saveEngine">保存</el-button>
        </template>
      </el-dialog>
    </el-tab-pane>
  </el-tabs>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { api } from '../../api.js'

const tab = ref('categories')

// ---------------- 数据 ----------------

const categories = ref([])
const bookmarkRows = ref([])
const engineRows = ref([])
const bookmarkFilter = ref(null)

// 分类树（给表格）
const categoryRows = computed(() => {
  const map = new Map()
  for (const c of categories.value) map.set(c.id, { ...c, _children: [] })
  const roots = []
  for (const c of map.values()) {
    if (c.parent_id && map.has(c.parent_id)) map.get(c.parent_id)._children.push(c)
    else roots.push(c)
  }
  return roots
})

// 带缩进的分类选项（给 select）
const categoryOptions = computed(() => {
  const out = []
  const walk = (pid, depth) => {
    for (const c of categories.value.filter((x) => x.parent_id === pid)) {
      out.push({ id: c.id, label: '　'.repeat(depth) + c.name })
      walk(c.id, depth + 1)
    }
  }
  walk(0, 0)
  return out
})

function categoryName(id) {
  const c = categories.value.find((x) => x.id === id)
  return c ? c.name : '—'
}

// ---------------- 分类 CRUD ----------------

const categoryDialog = ref(false)
const emptyCategory = () => ({ id: null, name: '', parent_id: 0, sort_order: 0, is_default: false })
const categoryForm = ref(emptyCategory())

function openCategory(row = null, childOf = null) {
  categoryForm.value = row ? { ...row } : emptyCategory()
  if (childOf) categoryForm.value.parent_id = childOf
  categoryDialog.value = true
}

async function saveCategory() {
  if (!categoryForm.value.name) return ElMessage.warning('请填写名称')
  const payload = { ...categoryForm.value }
  if (payload.id) {
    await api.put(`/api/admin/nav/categories/${payload.id}`, payload)
  } else {
    delete payload.id
    await api.post('/api/admin/nav/categories', payload)
  }
  ElMessage.success('已保存')
  categoryDialog.value = false
  await loadCategories()
}

async function removeCategory(row) {
  await ElMessageBox.confirm(`确定删除分类「${row.name}」？`, '提示', { type: 'warning' })
  try {
    await api.del(`/api/admin/nav/categories/${row.id}`)
    ElMessage.success('已删除')
    loadCategories()
  } catch (e) {
    ElMessage.error(e.message)
  }
}

// ---------------- 书签 CRUD ----------------

const bookmarkDialog = ref(false)
const emptyBookmark = () => ({
  id: null,
  name: '',
  category_id: null,
  url: '',
  icon: '',
  description: '',
  sort_order: 0
})
const bookmarkForm = ref(emptyBookmark())

async function loadBookmarks() {
  const qs = bookmarkFilter.value ? `?category_id=${bookmarkFilter.value}` : ''
  bookmarkRows.value = await api.get(`/api/admin/nav/bookmarks${qs}`)
}

function openBookmark(row = null) {
  bookmarkForm.value = row ? { ...row } : emptyBookmark()
  if (!row && bookmarkFilter.value) bookmarkForm.value.category_id = bookmarkFilter.value
  bookmarkDialog.value = true
}

async function saveBookmark() {
  const f = bookmarkForm.value
  if (!f.name || !f.url || !f.category_id) return ElMessage.warning('请填写名称、网址并选择分类')
  if (f.id) {
    await api.put(`/api/admin/nav/bookmarks/${f.id}`, f)
  } else {
    delete f.id
    await api.post('/api/admin/nav/bookmarks', f)
  }
  ElMessage.success('已保存')
  bookmarkDialog.value = false
  loadBookmarks()
}

async function removeBookmark(row) {
  await ElMessageBox.confirm(`确定删除「${row.name}」？`, '提示', { type: 'warning' })
  await api.del(`/api/admin/nav/bookmarks/${row.id}`)
  ElMessage.success('已删除')
  loadBookmarks()
}

// ---------------- 引擎 CRUD ----------------

const engineDialog = ref(false)
const emptyEngine = () => ({
  id: null,
  name: '',
  url_template: '',
  icon: '',
  sort_order: 0,
  is_active: true,
  is_internal: false
})
const engineForm = ref(emptyEngine())

function openEngine(row = null) {
  engineForm.value = row ? { ...row } : emptyEngine()
  engineDialog.value = true
}

async function saveEngine() {
  const f = engineForm.value
  if (f.id) {
    await api.put(`/api/admin/nav/engines/${f.id}`, f)
  } else {
    delete f.id
    await api.post('/api/admin/nav/engines', f)
  }
  ElMessage.success('已保存')
  engineDialog.value = false
  loadEngines()
}

async function toggleEngine(row, v) {
  await api.put(`/api/admin/nav/engines/${row.id}`, { ...row, is_active: v })
  row.is_active = v
}

async function removeEngine(row) {
  await ElMessageBox.confirm(`确定删除引擎「${row.name}」？`, '提示', { type: 'warning' })
  try {
    await api.del(`/api/admin/nav/engines/${row.id}`)
    ElMessage.success('已删除')
    loadEngines()
  } catch (e) {
    ElMessage.error(e.message)
  }
}

// ---------------- 加载 ----------------

async function loadCategories() {
  categories.value = await api.get('/api/admin/nav/categories')
}
async function loadEngines() {
  engineRows.value = await api.get('/api/admin/nav/engines')
}

onMounted(async () => {
  await loadCategories()
  await Promise.all([loadBookmarks(), loadEngines()])
})
</script>
