import {
  getDeployment,
  getDeploymentDetaile,
  updateDeployment,
  createDeployment,
  deleteDeployment
} from '@/api/deployments'

const state = {
  deployments: []
}

const mutations = {
  SET_DEPLOYMENTS(state, data) {
    state.deployments = data
  }
}

const actions = {
  async getDeployment({ commit }, { wsName, nsName }) {
    const res = await getDeployment(wsName, nsName)
    commit('SET_DEPLOYMENTS', res.items)
  },

  async getDeploymentDetaile(_, { wsName, nsName, deployName }) {
    const res = await getDeploymentDetaile(wsName, nsName, deployName)
    return res
  },
  async createDeployment(_, { wsName, nsName, deployName, pvc }) {
    const res = await createDeployment(wsName, nsName, deployName, pvc)
    return res
  },
  async updateDeployment(_, { wsName, nsName, deployName, pvc }) {
    const res = await updateDeployment(wsName, nsName, deployName, pvc)
    return res
  },
  async deleteDeployment(_, { wsName, nsName, deployName }) {
    console.log('前端传递删除pvc的wsName：', wsName, '获取的ns', nsName, 'deploy名称：', deployName)
    const res = await deleteDeployment(wsName, nsName, deployName)
    return res
  }
}

const getters = {
  deployments: state => state.deployments
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
}
