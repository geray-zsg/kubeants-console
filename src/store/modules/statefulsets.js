import {
  getStatefulsets,
  getStatefulsetsDetail,
  updateStatefulsets,
  createStatefulsets,
  deleteStatefulsets
} from '@/api/statefulsets'

const state = {
  statefulsets: []
}

const mutations = {
  SET_DEPLOYMENTS(state, data) {
    state.statefulsets = data
  }
}

const actions = {
  async getStatefulsets({ commit }, { wsName, nsName }) {
    const res = await getStatefulsets(wsName, nsName)
    const stsList = res.items
    commit('SET_DEPLOYMENTS', stsList)
    return stsList
  },

  async getStatefulsetsDetail(_, { wsName, nsName, stsName }) {
    console.log('前端传递删除deploy的wsName：', wsName, '获取的ns', nsName, 'deploy名称：', stsName)
    const res = await getStatefulsetsDetail(wsName, nsName, stsName)
    return res
  },
  async createStatefulsets(_, { wsName, nsName, stsName, deploy }) {
    const res = await createStatefulsets(wsName, nsName, stsName, deploy)
    return res
  },
  async updateStatefulsets(_, { wsName, nsName, stsName, deploy }) {
    const res = await updateStatefulsets(wsName, nsName, stsName, deploy)
    return res
  },
  async deleteStatefulsets(_, { wsName, nsName, stsName }) {
    console.log('前端传递删除deploy的wsName：', wsName, '获取的ns', nsName, 'deploy名称：', stsName)
    const res = await deleteStatefulsets(wsName, nsName, stsName)
    return res
  }
}

const getters = {
  statefulsets: state => state.statefulsets
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
}
