import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'home', component: () => import('../views/Home.vue') },
  { path: '/login', name: 'login', component: () => import('../views/admin/Login.vue') },
  {
    path: '/admin',
    component: () => import('../layouts/AdminLayout.vue'),
    redirect: '/admin/overview',
    children: [
      { path: 'overview', name: 'overview', component: () => import('../views/admin/Overview.vue'), meta: { title: '概览' } },
      { path: 'subscriptions', name: 'subscriptions', component: () => import('../views/admin/Subscriptions.vue'), meta: { title: '订阅提醒' } },
      { path: 'monitors', name: 'monitors', component: () => import('../views/admin/Monitors.vue'), meta: { title: '网站监控' } },
      { path: 'nav', name: 'nav', component: () => import('../views/admin/NavManage.vue'), meta: { title: '导航管理' } },
      { path: 'channels', name: 'channels', component: () => import('../views/admin/Channels.vue'), meta: { title: '通知渠道' } },
      { path: 'settings', name: 'settings', component: () => import('../views/admin/Settings.vue'), meta: { title: '系统设置' } },
      { path: 'account', name: 'account', component: () => import('../views/admin/Account.vue'), meta: { title: '账户' } }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 重新部署后旧分包文件可能已被删除，动态加载失败时自动刷新一次拿到新版本
router.onError((err) => {
  if (/Failed to fetch dynamically imported module|error loading dynamically imported module/i.test(String(err?.message || err))) {
    if (!sessionStorage.getItem('chunk_reloaded')) {
      sessionStorage.setItem('chunk_reloaded', '1')
      window.location.reload()
    }
  }
})
router.afterEach(() => sessionStorage.removeItem('chunk_reloaded'))

export default router
