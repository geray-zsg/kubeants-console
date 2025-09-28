// store/modules/permission.js
import { asyncRoutes, constantRoutes } from '@/router'

/**
 * 根据用户角色过滤异步路由
 */
function filterAsyncRoutes(routes, roles) {
  const res = []

  routes.forEach(route => {
    const tmp = { ...route }
    // 如果路由需要权限控制
    if (tmp.meta && tmp.meta.roles) {
      // 检查用户是否有权限
      const hasPermission = roles.some(role => tmp.meta.roles.includes(role))
      if (hasPermission) {
        if (tmp.children) {
          tmp.children = filterAsyncRoutes(tmp.children, roles)
        }
        res.push(tmp)
      }
    } else {
      // 不需要权限控制的路由直接加入
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
  addRoutes: [],
  isGenerated: false, // 添加生成状态标记
  routeGenerationInProgress: false // 添加路由生成进行中状态
}

const mutations = {
  SET_ROUTES: (state, routes) => {
    state.addRoutes = routes || []
    state.routes = constantRoutes.concat(routes || [])
    state.isGenerated = true
    console.log('📌 路由设置完成，标记为已生成，addRoutes长度:', state.addRoutes.length)
  },
  // 添加缺失的 mutation
  SET_ROUTE_GENERATION_STATUS: (state, status) => {
    state.routeGenerationInProgress = status
    console.log('🔄 路由生成状态更新为:', status)
  },
  RESET_GENERATED: (state) => {
    state.isGenerated = false
    state.addRoutes = []
    state.routes = []
    state.routeGenerationInProgress = false
  }
}

const actions = {
  generateRoutes({ commit, state }, roles) {
    return new Promise(resolve => {
      // 确保roles是普通数组
      const normalRoles = Array.isArray(roles) ? [...roles] : []
      console.log('🎯 生成路由，角色:', normalRoles)

      let accessedRoutes = []

      if (normalRoles.includes('admin') || normalRoles.includes('clusterRole')) {
        // admin 或 clusterRole 用户拥有所有路由
        accessedRoutes = [...asyncRoutes]
        console.log('⭐ 用户有高级权限，挂载所有异步路由')
      } else if (normalRoles.length === 0) {
        // 没有角色的用户给予空路由，但确保状态被标记
        accessedRoutes = []
        console.log('⚠️ 用户没有角色，给予空路由')
      } else {
        // 根据角色过滤路由
        accessedRoutes = filterAsyncRoutes(asyncRoutes, normalRoles)
        console.log('🔍 根据角色过滤后的路由:', accessedRoutes)
      }

      commit('SET_ROUTES', accessedRoutes)
      resolve(accessedRoutes)
    })
  }
}

const getters = {
  routes: state => state.routes,
  addRoutes: state => state.addRoutes,
  isGenerated: state => state.isGenerated,
  // 添加缺失的 getter
  routeGenerationInProgress: state => state.routeGenerationInProgress
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
}
