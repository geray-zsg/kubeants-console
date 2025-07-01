import {
  getStorageclass,
  getStorageclassDetaile
} from '@/api/storageclass'

const state = {
  storageclass: []
}

const mutations = {
  SET_SC(state, data) {
    state.storageclass = data
  }
}

const actions = {
  async getStorageclass({ commit }, { wsName }) {
    const res = await getStorageclass(wsName)
    commit('SET_SC', res.items?.items || [])
  },

  async getStorageclassDetaile(_, { wsName, scName }) {
    const res = await getStorageclassDetaile(wsName, scName)
    return res // 返回用于详情展示
  }
}

const getters = {
  storageclass: state => state.storageclass
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
}
