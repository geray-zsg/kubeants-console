import Vue from 'vue'
import Vuex from 'vuex'
import getters from './getters'
import app from './modules/app'
import settings from './modules/settings'
import user from './modules/user'
import tagsView from './modules/tagsView'
import permission from './modules/permission'
import dashboard from './modules/dashboard'
import workspace from './modules/workspace'
import ns from './modules/namespace'
import configmap from './modules/configmap'
import secrets from './modules/secret'
import storageclass from './modules/storageclass'
import persistentvolumes from './modules/persistentvolumes'
import persistentvolumeclaims from './modules/persistentvolumeclaims'
import pods from './modules/pods'
import deployments from './modules/deployments'

Vue.use(Vuex)

const store = new Vuex.Store({
  modules: {
    app,
    settings,
    user,
    tagsView,
    permission,
    dashboard,
    workspace,
    ns,
    configmap,
    secrets,
    storageclass,
    persistentvolumes,
    persistentvolumeclaims,
    pods,
    deployments
  },
  getters
})

export default store
