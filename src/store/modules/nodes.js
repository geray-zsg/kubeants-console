import {
  getNodes,
  getNodesDetail,
  updateNodes
} from '@/api/nodes'

const state = {
  nodes: []
}

const mutations = {
  SET_NODE(state, data) {
    state.nodes = data
  }
}

const actions = {
  async getNodes({ commit }, { clusterName }) {
    const res = await getNodes(clusterName)
    // ✅ 正确获取嵌套数组
    const nodeList = res.items?.items || []
    commit('SET_NODE', nodeList)
    return nodeList
  },
  async getNodesDetail(_, { clusterName, nodeName }) {
    console.log('接收到的nodeName是', nodeName)
    const res = await getNodesDetail(clusterName, nodeName)
    return res // 直接返回对象
  },
  async updateNodes(_, { clusterName, nodeName, nodeObj }) {
    return updateNodes(clusterName, nodeName, nodeObj)
  }
}

const getters = {
  nodes: state => state.nodes
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
}
