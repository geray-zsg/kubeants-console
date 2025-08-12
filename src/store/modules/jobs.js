import {
  getJobs,
  getJobsDetail,
  createJobs,
  updateJobs,
  deleteJobs
} from '@/api/jobs'

const state = {
  jobs: []
}

const mutations = {
  SET_JOB(state, data) {
    state.jobs = data
  }
}

const actions = {
  async getJobs({ commit }, { wsName, nsName }) {
    const res = await getJobs(wsName, nsName)
    // ✅ 正确获取嵌套数组
    const jobList = res.items?.items || []
    commit('SET_JOB', jobList)
    return jobList
  },
  async getJobsDetail(_, { wsName, nsName, jobName }) {
    console.log('接收到的jobName是', jobName)
    const res = await getJobsDetail(wsName, nsName, jobName)
    return res // 直接返回对象
  },
  async createJobs(_, { wsName, nsName, jobObj }) {
    return createJobs(wsName, nsName, jobObj)
  },
  async updateJobs(_, { wsName, nsName, jobName, jobObj }) {
    return updateJobs(wsName, nsName, jobName, jobObj)
  },
  async deleteJobs(_, { wsName, nsName, jobName }) {
    return deleteJobs(wsName, nsName, jobName)
  }
}

const getters = {
  jobs: state => state.jobs
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
}
