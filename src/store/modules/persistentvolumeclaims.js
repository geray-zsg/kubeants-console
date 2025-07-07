import {
  getPersistentVolumeClaims,
  getPersistentVolumeClaimsDetaile,
  updatePersistentVolumeClaims,
  createPersistentVolumeClaims,
  deletePersistentVolumeClaims
} from '@/api/persistentvolumeclaims'

const state = {
  persistentvolumeclaims: []
}

const mutations = {
  SET_PVS(state, data) {
    state.persistentvolumeclaims = data
  }
}

const actions = {
  async getPersistentVolumeClaims({ commit }, { wsName, nsName }) {
    const res = await getPersistentVolumeClaims(wsName, nsName)
    commit('SET_PVS', res.items?.items || [])
  },

  async getPersistentVolumeClaimsDetaile(_, { wsName, nsName, pvcName }) {
    const res = await getPersistentVolumeClaimsDetaile(wsName, nsName, pvcName)
    return res
  },
  async createPersistentVolumeClaims(_, { wsName, nsName, pvcName, pvc }) {
    const res = await createPersistentVolumeClaims(wsName, nsName, pvcName, pvc)
    return res
  },
  async updatePersistentVolumeClaims(_, { wsName, nsName, pvcName, pvc }) {
    const res = await updatePersistentVolumeClaims(wsName, nsName, pvcName, pvc)
    return res
  },
  async deletePersistentVolumeClaims(_, { wsName, nsName, pvcName }) {
    console.log('前端传递删除pvc的wsName：', wsName, '获取的ns',nsName, 'pvc名称：',pvcName )
    const res = await deletePersistentVolumeClaims(wsName, nsName, pvcName)
    return res
  }
}

const getters = {
  persistentvolumeclaims: state => state.persistentvolumeclaims
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
}
