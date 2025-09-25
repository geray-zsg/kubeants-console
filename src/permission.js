// src/permission.js
import router from './router'
import store from './store'
import { Message } from 'element-ui'
import NProgress from 'nprogress' // progress bar
import 'nprogress/nprogress.css' // progress bar style
import { getToken } from '@/utils/auth' // get token from cookie
import getPageTitle from '@/utils/get-page-title' // 设置页面标题

NProgress.configure({ showSpinner: false }) // NProgress Configuration

const whiteList = ['/login'] // 不重定向的白名单

router.beforeEach(async(to, from, next) => {
  NProgress.start()
  // 设置页面标题
  document.title = getPageTitle(to.meta.title || '')

  const hasToken = getToken()

  if (hasToken) {
    if (to.path === '/login') {
      // 已登录用户访问 login，直接跳首页
      next({ path: '/' })
      NProgress.done()
      return
    }

    // 是否已有角色
    const hasRoles = store.getters.roles && store.getters.roles.length > 0
    // 是否已经挂载过动态路由
    const hasAddedRoutes =
      store.state.permission &&
      Array.isArray(store.state.permission.addRoutes) &&
      store.state.permission.addRoutes.length > 0

    if (hasRoles && hasAddedRoutes) {
      // 已有角色 + 已挂载路由，直接放行
      next()
    } else {
      try {
        // 如果没有角色信息，拉取一次
        if (!hasRoles) {
          await store.dispatch('user/getInfo')
          await store.dispatch('user/getUserbindings')
        }

        const roles = store.getters.roles || []
        console.log('当前用户 roles:', roles)

        // 根据角色生成可访问路由
        const accessRoutes = await store.dispatch(
          'permission/generateRoutes',
          roles
        )
        console.log('生成的动态路由：', accessRoutes)

        if (!hasAddedRoutes) {
          // 挂载路由，只执行一次
          router.addRoutes(accessRoutes)
          // replace 确保新路由生效
          next({ ...to, replace: true })
        } else {
          next()
        }
      } catch (error) {
        console.error('路由守卫错误:', error)
        await store.dispatch('user/resetToken')
        Message.error(error || 'Has Error')
        next(`/login?redirect=${to.path}`)
        NProgress.done()
      }
    }
  } else {
    // 没有 token
    if (whiteList.indexOf(to.path) !== -1) {
      next()
    } else {
      next(`/login?redirect=${to.path}`)
      NProgress.done()
    }
  }
})

router.afterEach(() => {
  NProgress.done()
})
