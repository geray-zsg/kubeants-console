// src/store/modules/persistentvolumes.js
import {
  getPersistentvolumes,
  getPersistentvolumesDetaile
} from '@/api/persistentvolumes'

const state = {
  persistentvolumes: []
}

const mutations = {
  SET_PVS(state, data) {
    state.persistentvolumes = data
  }
}

const actions = {
  async getPersistentvolumes({ commit }, { wsName }) {
    const res = await getPersistentvolumes(wsName)
    commit('SET_PVS', res.items?.items || [])
  },

  async getPersistentvolumesDetaile(_, { wsName, pvName }) {
    const res = await getPersistentvolumesDetaile(wsName, pvName)
    return res
  }
}

const getters = {
  persistentvolumes: state => state.persistentvolumes
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
}
