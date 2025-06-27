<template>
  <div class="secret-page">
    <div class="filters">
      <span class="filter-label">工作空间：</span>
      <el-select v-model="selectedWorkspace" placeholder="选择 Workspace" @change="onWorkspaceChange">
        <el-option v-for="ws in workspaces" :key="ws.name" :label="ws.name" :value="ws.name" />
      </el-select>

      <span class="filter-label">命名空间：</span>
      <el-select v-model="selectedNamespace" placeholder="选择 Namespace" style="margin-left: 10px" @change="fetchConfigmaps">
        <el-option v-for="ns in filteredNamespaces" :key="ns.metadata.name" :label="ns.metadata.name" :value="ns.metadata.name" />
      </el-select>

      <el-input
        v-model="searchText"
        placeholder="搜索保密字典"
        style="margin-left: 20px; width: 300px"
        clearable
      />

      <el-button type="primary" style="margin-left: auto">
        <!-- <el-button type="primary" style="margin-left: auto" @click="openCreateDialog"> -->
        创建保密字典
      </el-button>
    </div>

    <el-table :data="filteredSecrets">
      <el-table-column prop="metadata.name" label="名称" width="200" />
      <el-table-column label="字段名列表">
        <template v-slot="{ row }">
          <el-tag
            v-for="(v, k) in row.data"
            :key="k"
            size="small"
            type="success"
            style="margin: 2px"
          >
            {{ k }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="metadata.namespace" label="命名空间" width="160" />
      <el-table-column prop="metadata.creationTimestamp" label="创建时间" width="180">
        <template v-slot="{ row }">
          {{ formatDate(row.metadata.creationTimestamp) }}
        </template>
      </el-table-column>

      <el-table-column label="操作">
        <template v-slot="{ row }">
          <el-button text>{{ row.id }} - {{ row.name }}</el-button>
          <!-- <el-button text @click="handleView(row)">详情</el-button>
          <el-button text @click="handleEdit(row)">修改</el-button>
          <el-button text @click="handleDelete(row)">删除</el-button> -->
          <el-button text>详情</el-button>
          <el-button text>修改</el-button>
          <el-button text>删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'
// import MonacoEditor from 'vue-monaco-editor'
// import yaml from 'js-yaml'

export default {
  // components: { MonacoEditor },
  data() {
    return {
      selectedWorkspace: '',
      selectedNamespace: ''
    }
  },
  computed: {
    ...mapGetters('dashboard', ['workspaces']),
    ...mapGetters('workspace', ['namespaces']),
    ...mapGetters('secrets', ['secrets']),
    filteredNamespaces() {
      return this.namespaces.filter(ns =>
        ns.metadata.labels?.['kubeants.io/workspace'] === this.selectedWorkspace
      )
    },
    filteredSecrets() {
      if (!this.searchText) return this.secrets
      return this.secrets.filter(secrets =>
        secrets.metadata.name.includes(this.searchText)
      )
    }
  },
  async created() {
    await this.getWorkspaces()
    if (this.workspaces.length > 0) {
      this.selectedWorkspace = this.workspaces[0].name
      await this.onWorkspaceChange()
    }
  },
  methods: {
    ...mapActions('dashboard', ['getWorkspaces']),
    ...mapActions('workspace', ['getNamespaces']),
    ...mapActions('secrets', ['getSecrets', 'getSecretsDetail', 'createSecrets', 'deleteSecrets']),

    async onWorkspaceChange() {
      this.selectedNamespace = ''
      await this.getNamespaces(this.selectedWorkspace)
      const filtered = this.filteredNamespaces
      if (filtered.length > 0) {
        this.selectedNamespace = filtered[0].metadata.name
        this.fetchConfigmaps()
      }
    },
    async fetchConfigmaps() {
      if (!this.selectedWorkspace || !this.selectedNamespace) return
      await this.getConfigmap({ wsName: this.selectedWorkspace, nsName: this.selectedNamespace })
    }

  }
}
</script>

<style scoped>

.secret-page {
  padding: 20px;
}
.filters {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.filter-label {
  font-size: 14px;
  color: #606266;
  min-width: 100px;
  text-align: right;
  margin-right: 5px;
}
.dialog-footer {
  text-align: right;
}
/* 样式增强 */
.kv-pair {
  display: flex;
  margin-bottom: 10px;
}

</style>
