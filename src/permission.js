import router from './router'
import store from './store'
import { Message } from 'element-ui'
import NProgress from 'nprogress' // progress bar
import 'nprogress/nprogress.css' // progress bar style
import { getToken } from '@/utils/auth' // get token from cookie
import getPageTitle from '@/utils/get-page-title'
// import permission from './store/modules/permission'

NProgress.configure({ showSpinner: false }) // NProgress Configuration

const whiteList = ['/login'] // 白名单

// 路由守卫
router.beforeEach(async(to, from, next) => {
  // 开启加载样式（登陆按钮转圈圈）
  NProgress.start()

  // 设置浏览器标题
  document.title = getPageTitle(to.meta.title)

  // 确定用户是否已登录
  const hasToken = getToken()

  if (hasToken) { // 是否登陆过
    if (to.path === '/login') {
      // 如果已登录，重定向到主页
      next({ path: '/' })
      NProgress.done() // 关闭进度样式（登陆按钮转圈圈）
    } else {
      // 如果登录过则获取用户信息
      const hasGetUserInfo = store.getters.name
      if (hasGetUserInfo) {
        // 登陆过直接放行
        next()
      } else {
        try {
          // 获取用户信息
          await store.dispatch('user/getInfo')

          // 获取角色列表
          const roles = store.getters.roles

          // 通过角色列表roles获取路由列表
          const accessRoutes = await store.dispatch('permission/generateRoutes', roles)
          // 动态添加路由
          router.addRoutes(accessRoutes)

          // 确保addRoutes是完整的，设置replace: true，这样导航将不会留下历史记录
          next({ ...to, replace: true })
          // next()
        } catch (error) {
          console.log('permission.js catch error', error)
          // remove token and go to login page to re-login
          await store.dispatch('user/resetToken')
          Message.error(error || 'Has Error')
          next(`/login?redirect=${to.path}`)
          NProgress.done()
        }
      }
    }
  } else {
    /* has no token*/

    if (whiteList.indexOf(to.path) !== -1) {
      // in the free login whitelist, go directly
      next()
    } else {
      // other pages that do not have permission to access are redirected to the login page.
      next(`/login?redirect=${to.path}`)
      NProgress.done()
    }
  }
})

router.afterEach(() => {
  // finish progress bar
  NProgress.done()
})
