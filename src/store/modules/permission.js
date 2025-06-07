import { asyncRoutes, constantRoutes } from '@/router'
// import store from '@/store'
// import Layout from '@/layout'

/**
 * Use meta.role to determine if the current user has permission
 * @param roles
 * @param route
 */
function hasPermission(roles, route) {
  if (route.meta && route.meta.roles) {
    return roles.some(role => route.meta.roles.includes(role))
  } else {
    return true
  }
}

/**
 * Filter asynchronous routing tables by recursion
 * @param routes asyncRoutes
 * @param roles
 */
export function filterAsyncRoutes(routes, roles) {
  const res = []

  routes.forEach(route => {
    const tmp = { ...route }
    if (hasPermission(roles, tmp)) {
      if (tmp.children) {
        tmp.children = filterAsyncRoutes(tmp.children, roles)
      }
      res.push(tmp)
    }
  })

  return res
}

const state = {
  routes: [],
  addRoutes: []
}

const mutations = {
  SET_ROUTES: (state, routes) => {
    state.addRoutes = routes
    state.routes = constantRoutes.concat(routes)
  }
}

const actions = {
  // 获取路由
  generateRoutes({ commit }, roles) {
    return new Promise(resolve => {
      // let accessedRoutes
      // let asyncRoutes = [] // 动态路由数据（从后端服务器获取）

      // // 从store中获取动态路由
      // const menus = store.getters.menus
      // console.log('获取到的动态路由信息menus:', menus)

      // // 处理后端的动态路由数据
      // const menusList = []
      // if (menus && menus.length > 0) {
      //   for (let i = 0; i < menus.length; i++) {
      //     const obj = {}
      //     obj.name = menus[i].name
      //     obj.path = menus[i].path
      //     obj.redirect = menus[i].redirect
      //     obj.meta = menus[i].meta
      //     // 处理组件
      //     if (menus[i].component === 'Layout') {
      //       obj.component = Layout
      //     } else {
      //       const component = menus[i].component
      //       obj.component = () => require([`@/views/${component}`], resolve)
      //     }

      //     // 子路由

      //     menusList.push(obj)
      //   }
      // }

      // // 将后端的路由数据直接复制给asyncRoutes
      // asyncRoutes = menusList
      // if (roles.includes('admin')) {
      //   accessedRoutes = asyncRoutes || []
      // } else {
      //   accessedRoutes = filterAsyncRoutes(asyncRoutes, roles)
      // }
      // commit('SET_ROUTES', accessedRoutes)
      // resolve(accessedRoutes)
      let accessedRoutes
      if (roles.includes('admin')) {
        accessedRoutes = asyncRoutes || []
      } else {
        accessedRoutes = filterAsyncRoutes(asyncRoutes, roles)
      }
      commit('SET_ROUTES', accessedRoutes)
      resolve(accessedRoutes)
    })
  }
}

export default {
  namespaced: true,
  state,
  mutations,
  actions
}
