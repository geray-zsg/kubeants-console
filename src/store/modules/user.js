// src/store/modules/user.js
import { login, getInfo, getUserBindings } from '@/api/user'
import { getToken, setToken, removeToken } from '@/utils/auth'
import { resetRouter } from '@/router'
// import user from 'mock/user'

const getDefaultState = () => {
  return {
    token: getToken(),
    name: '',
    email: '',
    userBindings: [], // 所有UserBinding资源
    isClusterAdmin: false, // 是否拥有集群角色
    // avatar: 'https://wpimg.wallstcn.com/f778738c-e4f8-4870-b634-56703b4acafe.gif'
    avatar: require('@/assets/user-avatar.gif'),
    // roles: [],
    menus: []
  }
}

const state = getDefaultState()

const mutations = {
  RESET_STATE: (state) => {
    Object.assign(state, getDefaultState())
  },
  SET_TOKEN: (state, token) => {
    state.token = token
  },
  SET_USERNAME: (state, name) => {
    state.name = name
  },
  SET_EMAIL: (state, email) => {
    state.email = email
  },
  // 设置头像
  SET_AVATAR: (state, avatar) => {
    state.avatar = avatar
  },
  SET_WORKSPACES: (state, workspaces) => {
    state.workspaces = workspaces
  },
  SET_USER_BINDINGS(state, bindings) {
    state.userBindings = bindings
    state.isClusterAdmin = bindings.some(
      b => b.spec?.scope?.kind === 'Cluster' && b.spec?.role === 'admin'
    )
  }
}

const actions = {
  // user login
  login({ commit }, userInfo) {
    const { username, password } = userInfo
    return new Promise((resolve, reject) => {
      login({ username: username.trim(), password: password }).then(response => {
        // 正确写法：response 直接是后端返回的数据对象
        console.log('Login response:', response, 'username', username) // 调试日志，确认数据结构
        commit('SET_TOKEN', response.token)
        commit('SET_USERNAME', username)
        localStorage.setItem('token', response.token) // 存储Token
        localStorage.setItem('username', username) // 存储用户名
        setToken(response.token)
        resolve(response)
      }).catch(error => {
        console.error('Login failed:', error) // 调试日志
        reject(error)
      })
    })
  },

  // get user info (now uses state data directly)
  async getInfo({ commit, state }) {
    try {
      const res = await getInfo(state.name)

      const email = res.data.spec?.email || ''
      commit('SET_EMAIL', email)
      return res
    } catch (error) {
      console.error('获取用户信息失败:', error)
      throw error
    }
  },

  async getUserbindings({ commit, state }) {
    try {
      const res = await getUserBindings(state.name)
      commit('SET_USER_BINDINGS', res.items || [])
      console.log('SET_USER_BINDINGS', res.items)
      return res
    } catch (error) {
      console.error('获取用户信息失败:', error)
      throw error
    }
  },

  // user logout
  logout({ commit, state }) {
    return new Promise((resolve, reject) => {
      removeToken() // 重置，直接通过前端注销不需要给后端发请求
      resetRouter()
      commit('RESET_STATE')
      resolve()
    })
  },

  // remove token
  resetToken({ commit }) {
    return new Promise(resolve => {
      removeToken() // must remove  token  first
      commit('RESET_STATE')
      resolve()
    })
  }
}
// 在模块末尾添加getters配置
const getters = {
  username: state => state.name,
  email: state => state.email,
  avatar: state => state.avatar,
  // roles: state => state.roles,
  isClusterAdmin: state => state.isClusterAdmin,
  userBindings: state => state.userBindings
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
}

