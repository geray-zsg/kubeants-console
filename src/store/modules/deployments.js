import {
  getDeployment,
  getDeploymentDetail,
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
    const deployList = res.items
    commit('SET_DEPLOYMENTS', deployList)
    return deployList
  },

  async getDeploymentDetail(_, { wsName, nsName, deployName }) {
    console.log('前端传递删除deploy的wsName：', wsName, '获取的ns', nsName, 'deploy名称：', deployName)
    const res = await getDeploymentDetail(wsName, nsName, deployName)
    return res
  },
  async createDeployment(_, { wsName, nsName, deployName, deploy }) {
    const res = await createDeployment(wsName, nsName, deployName, deploy)
    return res
  },
  async updateDeployment(_, { wsName, nsName, deployName, deploy }) {
    const res = await updateDeployment(wsName, nsName, deployName, deploy)
    return res
  },
  async deleteDeployment(_, { wsName, nsName, deployName }) {
    console.log('前端传递删除deploy的wsName：', wsName, '获取的ns', nsName, 'deploy名称：', deployName)
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
