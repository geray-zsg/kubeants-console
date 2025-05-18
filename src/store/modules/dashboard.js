import { getUserAll, getWorkspaces, getWorkspacesAll, createUser, createUserBinding, getUserBindings, createWorkspace, getWorkspaceDetail, updateWorkspace, deleteWorkspace } from '@/api/dashboard'
import { updateUser as apiUpdateUser } from '@/api/dashboard'
import { deleteUser as apiDeleteUser } from '@/api/dashboard'
import { getUserDetail as getUserDetail, deleteUserBinding as deleteUserBinding } from '@/api/dashboard'

const state = {
  workspaces: [],
  users: [],
  userbindings: [] // 用户存储查看用户角色权限的信息
}

const mutations = {
  SET_WORKSPACES(state, data) {
    console.log('原始数据:', data.items)
    // 过滤并格式化有效工作空间
    state.workspaces = data.items
      .filter(item => item.spec?.scope?.kind === 'Workspace')
      .map(item => ({
        name: item.spec.scope.name,
        role: item.spec.role
        // raw: item // 保留原始数据
      }))
  },
  SET_USERS(state, users) {
    state.users = users // 直接存储用户数组
  },
  SET_USERBINDINGS(state, userbindings) {
    state.userbindings = userbindings // 直接存储用户数组
  }
}

const actions = {
  // 从userbindings中获取用户的workspace
  async getWorkspaces({ commit, rootState }) {
    try {
      const { name, hasClusterRole, userBindings } = rootState.user
      let respData

      if (hasClusterRole) {
        const raw = await getWorkspacesAll()

        // 权限优先级从高到低
        const rolePriority = ['admin', 'edit', 'view']

        // 过滤出所有集群级别的绑定
        const clusterBindings = userBindings?.filter(
          b => b.spec?.scope?.kind === 'Cluster'
        ) || []

        // 找出用户拥有的最高集群角色
        let highestRole = 'view' // 默认最低权限
        for (const role of rolePriority) {
          if (clusterBindings.some(b => b.spec?.role === role)) {
            highestRole = role
            break
          }
        }

        respData = {
          items: raw.items.items.map(ws => ({
            spec: {
              scope: {
                kind: 'Workspace',
                name: ws.metadata.name
              },
              role: highestRole
            }
          }))
        }
      } else {
        // 非集群管理员，调用接口获取该用户绑定的工作空间
        respData = await getWorkspaces(name)
      }

      commit('SET_WORKSPACES', respData)
      return respData
    } catch (error) {
      console.error('[Store] 加载workspace列表失败:', error)
      throw error
    }
  },

  async getUserAll({ commit, rootState }) {
    try {
      const { hasClusterRole } = rootState.user
      if (hasClusterRole) {
        const resp = await getUserAll()
        // 提取用户数组并提交
        commit('SET_USERS', resp.items.items)
        return resp.items.items // 返回用户数组
      }
      return []
    } catch (error) {
      console.error('[Store] 加载用户列表失败:', error)
      throw error
    }
  },

  // 查看workspace详情
  async viewWorkspace(_, name) {
    try {
      const resp = await getWorkspaceDetail(name)
      return resp
    } catch (error) {
      console.error('[Store] 查看workspace失败:', error)
      throw error
    }
  },
  // 编辑workspace
  async updateWorkspace({ dispatch }, { name, alias, description }) {
    try {
      const patch = {
        apiVersion: 'workspace.kubeants.io/v1beta1', // 添加此行
        kind: 'Workspace', // 添加此行
        metadata: {
          annotations: {
            'kubeants.io/alias-name': alias,
            'kubeants.io/description': description
          }
        }
      }
      await updateWorkspace(name, patch)
      await dispatch('getWorkspaces')
    } catch (error) {
      console.error('[Store] 更新workspace失败:', error)
      throw error
    }
  },

  // 删除workspace
  async deleteWorkspace({ dispatch }, name) {
    try {
      await deleteWorkspace(name)
      await dispatch('getWorkspaces')
    } catch (error) {
      console.error('[Store] 删除workspace失败:', error)
      throw error
    }
  },

  // 创建workspace
  async createWorkspace({ dispatch }, workspaceData) {
    try {
      const response = await createWorkspace(workspaceData)
      await dispatch('getWorkspaces') // 创建成功后刷新列表
      return response
    } catch (error) {
      console.error('[Store] 创建工作空间失败:', error)
      throw error
    }
  },

  // 查看用户详情
  async getUserDetail({ commit }, username) {
    try {
      const resp = await getUserDetail(username)
      return resp
    } catch (error) {
      console.error('[Store] 获取用户详情失败:', error)
      throw error
    }
  },
  // 创建user
  async createUserWithBinding({ dispatch }, { user, bindings }) {
    try {
      await createUser(user)
      for (const binding of bindings) {
        await createUserBinding(binding)
      }
      await dispatch('getUserAll') // 创建后刷新用户列表
    } catch (error) {
      console.error('[Store] 创建用户或绑定失败:', error)
      throw error
    }
  },
  // async createUser(_, { user }) {
  //   return await createUser(user)
  // },
  // // 创建userbinding
  // async createUserBinding(_, { userbinding }) {
  //   return await createUserBinding(userbinding)
  // },
  async addUserBinding(_, binding) {
    try {
      return await createUserBinding(binding)
    } catch (error) {
      console.error('[Store] 添加用户绑定失败:', error)
      throw error
    }
  },

  async removeUserBinding({ dispatch }, name) {
    try {
      await deleteUserBinding(name)
      // 删除后可选择是否刷新绑定列表（依赖场景）
      return true
    } catch (error) {
      console.error('[Store] 删除用户绑定失败:', error)
      throw error
    }
  },
  // 获取userbings，用于用户权限查看
  async getUserBindings({ commit }, { username }) {
    try {
      const resp = await getUserBindings(username)
      // 提取用户数组并提交
      commit('SET_USERBINDINGS', resp.items)
      return resp.items
    } catch (error) {
      console.error('[Store] 加载userbindings列表失败:', error)
      throw error
    }
  },
  async updateUser({ dispatch }, { name, patch }) {
    try {
      await apiUpdateUser(name, patch)
      await dispatch('getUserAll') // 更新后刷新列表
    } catch (error) {
      console.error('[Store] 更新用户失败:', error)
      throw error
    }
  },
  async deleteUser({ dispatch }, name) {
    try {
      await apiDeleteUser(name)
      await dispatch('getUserAll')
    } catch (error) {
      console.error('[Store] 删除用户失败:', error)
      throw error
    }
  }
}
const getters = {
  workspaces: state => state.workspaces,
  users: state => state.users,
  userbindings: state => state.userbindings
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
}
