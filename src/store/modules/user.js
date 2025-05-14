// src/store/modules/user.js
import { login, getInfo } from '@/api/user'
import { getToken, setToken, removeToken } from '@/utils/auth'
import { resetRouter } from '@/router'

const getDefaultState = () => {
  return {
    token: getToken(),
    name: '',
    email: '',
    // avatar: 'https://wpimg.wallstcn.com/f778738c-e4f8-4870-b634-56703b4acafe.gif'
    avatar: require('@/assets/user-avatar.gif'),
    roles: [],
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
  // SET_ROLES: (state, roles) => {
  //   state.roles = roles
  // },
  SET_MENUS: (state, menus) => {
    state.menus = menus
  },
  SET_WORKSPACES: (state, workspaces) => {
    state.workspaces = workspaces
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
      const response = await getInfo(state.name)

      const email = response.data.spec?.email || ''
      const displayName = response.data.spec?.name || state.name
      commit('SET_EMAIL', email) // 设置email
      commit('SET_MENUS', displayName)

      console.log('用户信息', displayName, email)
      return response
    } catch (error) {
      console.error('获取用户信息失败:', error)
      throw error
    }
    // return new Promise((resolve) => {
    //   // 直接从 state 中获取用户信息
    //   const userInfo = {
    //     name: state.name,
    //     avatar: state.avatar
    //   }
    //   console.log("getInfo用户信息",userInfo)
    //   resolve(userInfo)
    // })
  },

  // user logout
  logout({ commit, state }) {
    return new Promise((resolve, reject) => {
      // logout(state.token).then(() => { // 给后端发请求注销
      //   removeToken() // 重置
      //   resetRouter()
      //   commit('RESET_STATE')
      //   resolve()
      // }).catch(error => {
      //   reject(error)
      // })
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
  roles: state => state.roles
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
}

