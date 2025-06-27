import {
  getSecrets,
  getSecretDetail,
  createSecret,
  updateSecret,
  deleteSecret
} from '@/api/secret'

const state = {
  secrets: []
}

const mutations = {
  SET_SECRETS(state, data) {
    state.secrets = data
  }
}

const actions = {
  async getSecrets({ commit }, { wsName, nsName }) {
    const res = await getSecrets(wsName, nsName)
    commit('SET_SECRETS', res.items?.items || [])
  },
  async getSecretDetail(_, { wsName, nsName, secretName }) {
    const res = await getSecretDetail(wsName, nsName, secretName)
    return res
  },
  async createSecret(_, { wsName, nsName, secret }) {
    return createSecret(wsName, nsName, secret)
  },
  async updateSecret(_, { wsName, nsName, secretName, secret }) {
    return updateSecret(wsName, nsName, secretName, secret)
  },
  async deleteSecret(_, { wsName, nsName, secretName }) {
    return deleteSecret(wsName, nsName, secretName)
  }
}

const getters = {
  secrets: state => state.secrets
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
}
