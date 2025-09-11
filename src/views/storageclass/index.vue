<template>
  <div class="secret-page">
    <!-- 过滤区域 -->
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

    <!-- 表格 -->
    <el-table
      :data="pagedData"
      border
      style="width: 100%"
      :header-cell-style="{ background: '#f5f7fa', fontWeight: 'bold' }"
    >
      <el-table-column prop="metadata.name" label="名称" width="250" />
      <el-table-column prop="provisioner" label="动态存储插件" width="250" />
      <el-table-column prop="parameters.archiveOnDelete" label="配置参数" width="250" />
      <el-table-column prop="reclaimPolicy" label="回收策略" width="200" />
      <el-table-column prop="volumeBindingMode" label="绑定时机" width="200" />
      <el-table-column prop="metadata.creationTimestamp" label="创建时间" width="220">
        <template v-slot="{ row }">
          {{ formatDate(row.metadata.creationTimestamp) }}
        </template>
      </el-table-column>

      <!-- 操作列 -->
      <el-table-column label="操作" fixed="right" width="120">
        <template v-slot="{ row }">
          <el-button size="small" text @click="handleView(row)">详情</el-button>
        </template>
      </el-table-column>

      <template #empty>
        <el-empty description="暂无数据" />
      </template>
    </el-table>

    <!-- 分页 -->
    <el-pagination
      background
      layout="total, sizes, prev, pager, next"
      :current-page="currentPage"
      :page-sizes="[10, 20, 50, 100, 500]"
      :page-size="pageSize"
      :total="tableData.length"
      style="margin-top: 16px; text-align: right"
      @current-change="handlePageChange"
      @size-change="handleSizeChange"
    />

    <!-- YAML 详情弹窗 -->
    <el-dialog
      title="StorageClass 详情"
      :visible.sync="showYamlDialog"
      width="70%"
      @opened="refreshMonacoEditor"
    >
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
import paginationMixin from '@/utils/pagination'
import MonacoEditor from 'vue-monaco-editor'

export default {
  components: { MonacoEditor },
  mixins: [paginationMixin],
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
    // ✅ mixin 需要的输入
    tableData() {
      if (!this.searchText) return this.storageclass
      return this.storageclass.filter(sc =>
        sc.metadata.name.includes(this.searchText)
      )
    },
    filteredNamespaces() {
      return this.namespaces.filter(ns =>
        ns.metadata.labels?.['kubeants.io/workspace'] === this.selectedWorkspace
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
      try {
        const res = await this.getStorageclassDetaile({
          wsName: this.selectedWorkspace,
          scName: row.metadata.name
        })
        this.yamlContent = yaml.dump(res || {})
        this.showYamlDialog = true
        this.$nextTick(() => {
          this.$refs.yamlEditor?.editor?.setValue(this.yamlContent)
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
