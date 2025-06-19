<template>
  <div class="namespace-page">
    <div class="filters">
      <span class="filter-label">工作空间：</span>
      <el-select v-model="selectedWorkspace" placeholder="选择 Workspace" @change="onWorkspaceChange">
        <el-option v-for="ws in workspaces" :key="ws.name" :label="ws.name" :value="ws.name" />
      </el-select>

      <span class="filter-label">命名空间：</span>
      <el-select v-model="selectedNamespace" placeholder="选择 Namespace" style="margin-left: 10px" @change="fetchNamespaceDetail">
        <el-option v-for="ns in filteredNamespaces" :key="ns.metadata.name" :label="ns.metadata.name" :value="ns.metadata.name" />
      </el-select>
    </div>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="角色 (Role)" name="roles">
        <el-table :data="roles" border style="width: 100%">
          <el-table-column prop="metadata.name" label="角色名称" />
          <el-table-column label="创建时间">
            <template v-slot="{ row }">{{ formatDate(row.metadata.creationTimestamp) }}</template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="服务账号 (ServiceAccount)" name="serviceaccounts">
        <el-table :data="serviceaccounts" border style="width: 100%">
          <el-table-column prop="metadata.name" label="账号名称" />
          <el-table-column label="Secrets">
            <template v-slot="{ row }">
              <el-tag v-for="secret in row.secrets" :key="secret.name" type="info" style="margin: 2px">
                {{ secret.name }}
              </el-tag>
              <span v-if="!row.secrets || row.secrets.length === 0">-</span>
            </template>
          </el-table-column>
          <el-table-column label="创建时间">
            <template v-slot="{ row }">{{ formatDate(row.metadata.creationTimestamp) }}</template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="资源配额 (Quota)" name="quotas" disabled />

      <el-tab-pane label="成员 (UserBinding)" name="users" disabled />
    </el-tabs>
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'

export default {
  data() {
    return {
      selectedWorkspace: '',
      selectedNamespace: '',
      namespace: null,
      activeTab: 'roles'
    }
  },
  computed: {
    ...mapGetters('dashboard', ['workspaces']),
    ...mapGetters('workspace', ['namespaces']),
    ...mapGetters('ns', ['roles', 'serviceaccounts']),
    filteredNamespaces() {
      return this.namespaces.filter(ns =>
        ns.metadata.labels?.['kubeants.io/workspace'] === this.selectedWorkspace
      )
    }
  },
  async created() {
    await this.getWorkspaces()

    const { workspaceName, namespaceName } = this.$route.params

    if (workspaceName && this.workspaces.find(ws => ws.name === workspaceName)) {
      this.selectedWorkspace = workspaceName
    } else if (this.workspaces.length > 0) {
      this.selectedWorkspace = this.workspaces[0].name
    }

    await this.onWorkspaceChange(namespaceName)
  },
  methods: {
    ...mapActions('dashboard', ['getWorkspaces']),
    ...mapActions('workspace', ['getNamespaces']),
    ...mapActions('ns', [
      'getNamespaceDetail',
      'getRoles',
      'getServiceAccount'
    ]),
    async onWorkspaceChange(preferredNsName = '') {
      this.selectedNamespace = ''
      await this.getNamespaces(this.selectedWorkspace)

      const filtered = this.filteredNamespaces
      if (filtered.length > 0) {
        const match = filtered.find(ns => ns.metadata.name === preferredNsName)
        this.selectedNamespace = match ? match.metadata.name : filtered[0].metadata.name
        this.fetchNamespaceDetail()
      }
    },
    async fetchNamespaceDetail() {
      if (!this.selectedWorkspace || !this.selectedNamespace) return

      await Promise.all([
        this.getNamespaceDetail(this.selectedNamespace),
        this.getRoles({ wsName: this.selectedWorkspace, nsName: this.selectedNamespace }),
        this.getServiceAccount({ wsName: this.selectedWorkspace, nsName: this.selectedNamespace })
      ])
    },
    formatDate(str) {
      return str ? new Date(str).toLocaleString() : ''
    }
  }
}
</script>

<style scoped>
.namespace-page {
  padding: 20px;
}
.filters {
  display: flex;
  margin-bottom: 20px;
}
.filter-label {
  font-size: 14px;
  color: #606266;
  min-width: 100px;
  text-align: right;
}
</style>
