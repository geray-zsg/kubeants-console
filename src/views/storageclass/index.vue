<template>
  <div class="secret-page">
    <div class="filters">
      <span class="filter-label">工作空间：</span>
      <el-select v-model="selectedWorkspace" placeholder="选择 Workspace" @change="onWorkspaceChange">
        <el-option v-for="ws in workspaces" :key="ws.name" :label="ws.name" :value="ws.name" />
      </el-select>

      <el-input
        v-model="searchText"
        placeholder="搜索存储卷"
        style="margin-left: 20px; width: 300px"
        clearable
      />
    </div>

    <el-table :data="filteredstorageclass" border>
      <el-table-column prop="metadata.name" label="名称" width="250" />
      <el-table-column prop="provisioner" label="动态存储插件" width="250" />
      <el-table-column prop="parameters.archiveOnDelete" label="配置参数" width="250" />
      <el-table-column prop="reclaimPolicy" label="回收策略" width="250" />
      <el-table-column prop="volumeBindingMode" label="绑定时机" width="250" />
      <el-table-column prop="metadata.creationTimestamp" label="创建时间" width="220">
        <template v-slot="{ row }">
          {{ formatDate(row.metadata.creationTimestamp) }}
        </template>
      </el-table-column>
      <el-table-column label="操作">
        <template v-slot="{ row }">
          <el-button @click="handleView(row)">详情</el-button>
        </template>
      </el-table-column>

      <template #empty>
        <el-empty description="暂无数据" />
      </template>
    </el-table>

    <!-- YAML 详情弹窗 -->
    <el-dialog :visible.sync="showYamlDialog" title="StorageClass 详情" width="70%" @opened="refreshMonacoEditor">
      <div style="height: 400px; border: 1px solid #dcdfe6; border-radius: 4px">
        <monaco-editor
          ref="yamlEditor"
          v-model="yamlContent"
          language="yaml"
          theme="vs-dark"
          :options="detailEditorOptions"
        />
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'
import yaml from 'js-yaml'
import MonacoEditor from 'vue-monaco-editor'

export default {
  components: { MonacoEditor },
  data() {
    return {
      selectedWorkspace: '',
      selectedNamespace: '',
      searchText: '',
      showYamlDialog: false,
      yamlContent: '',
      detailEditorOptions: {
        readOnly: true,
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: 'on',
        folding: true,
        wordWrap: 'on'
      }
    }
  },
  computed: {
    ...mapGetters('dashboard', ['workspaces']),
    ...mapGetters('workspace', ['namespaces']),
    ...mapGetters('storageclass', ['storageclass']),
    filteredNamespaces() {
      return this.namespaces.filter(ns =>
        ns.metadata.labels?.['kubeants.io/workspace'] === this.selectedWorkspace
      )
    },
    filteredstorageclass() {
      if (!this.searchText) return this.storageclass
      return this.storageclass.filter(sc =>
        sc.metadata.name.includes(this.searchText)
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
    ...mapActions('storageclass', ['getStorageclass', 'getStorageclassDetaile']),

    async onWorkspaceChange() {
      this.selectedNamespace = ''
      await this.getNamespaces(this.selectedWorkspace)
      const filtered = this.filteredNamespaces
      if (filtered.length > 0) {
        this.selectedNamespace = filtered[0].metadata.name
        await this.fetchStorageclass()
      }
    },
    async fetchStorageclass() {
      if (!this.selectedWorkspace) return
      await this.getStorageclass({ wsName: this.selectedWorkspace })
    },
    async handleView(row) {
      if (!this.selectedWorkspace || !row?.metadata?.name) {
        this.$message.error('当前工作空间或命名空间未选中，或数据不完整')
        return
      }
      try {
        const res = await this.getStorageclassDetaile({
          wsName: this.selectedWorkspace,
          scName: row.metadata.name
        })

        this.showYamlDialog = true

        this.$nextTick(() => {
          this.yamlContent = yaml.dump(res || {})
      this.$refs.yamlEditor?.editor?.setValue(this.yamlContent) // 修复这里
      this.refreshMonacoEditor()
        })
      } catch (err) {
        console.error('获取 StorageClass 详情失败', err)
        this.$message.error('获取详情失败')
      }
    },
    refreshMonacoEditor() {
      this.$nextTick(() => {
        this.$refs.yamlEditor?.editor?.layout()
      })
    },
    formatDate(dateStr) {
      return new Date(dateStr).toLocaleString()
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
</style>
