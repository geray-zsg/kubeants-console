// src/permission.js - 简化版本
import router from './router'
import store from './store'
import { Message } from 'element-ui'
import NProgress from 'nprogress'
import 'nprogress/nprogress.css'
import { getToken } from '@/utils/auth'
import getPageTitle from '@/utils/get-page-title'

NProgress.configure({ showSpinner: false })

router.beforeEach(async(to, from, next) => {
  if (to.path === '/login') {
    next()
    return
  }

  NProgress.start()
  document.title = getPageTitle(to.meta.title || '')

  const hasToken = getToken()

  if (!hasToken) {
    next(`/login?redirect=${to.path}`)
    NProgress.done()
    return
  }

  try {
    // 如果用户信息未加载，先加载用户信息
    if (!store.getters.name) {
      await store.dispatch('user/getInfo')
    }

    // 如果用户绑定信息未加载，加载绑定信息
    if (!store.getters.userBindings || store.getters.userBindings.length === 0) {
      await store.dispatch('user/getUserbindings')
    }

    // 获取当前角色
    const roles = store.getters.roles || []

    // 检查是否已经生成过路由
    const addRoutes = store.state.permission.addRoutes || []

    if (addRoutes.length === 0) {
      console.log('🔄 需要生成路由')
      // 根据 roles 生成可访问的路由表
      const accessRoutes = await store.dispatch('permission/generateRoutes', roles)

      // 动态添加路由
      if (accessRoutes && accessRoutes.length > 0) {
        router.addRoutes(accessRoutes)
      }

      // 使用 replace 方式跳转，避免循环
      next({ ...to, replace: true })
    } else {
      console.log('✅ 路由已存在，直接放行')
      next()
    }
  } catch (error) {
    console.error('路由守卫错误:', error)
    await store.dispatch('user/resetToken')
    Message.error(error || '系统错误')
    next(`/login?redirect=${to.path}`)
  } finally {
    NProgress.done()
  }
})

router.afterEach(() => {
  NProgress.done()
})
