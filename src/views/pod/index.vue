<template>
  <div class="secret-page">
    <div class="filters">
      <span class="filter-label">工作空间：</span>
      <el-select v-model="selectedWorkspace" placeholder="选择工作空间" @change="onWorkspaceChange">
        <el-option v-for="ws in workspaces" :key="ws.name" :label="ws.name" :value="ws.name" />
      </el-select>

      <span class="filter-label">命名空间：</span>
      <el-select v-model="selectedNamespace" placeholder="选择命名空间" style="margin-left: 10px" @change="fetchPods">
        <el-option v-for="ns in filteredNamespaces" :key="ns.metadata.name" :label="ns.metadata.name" :value="ns.metadata.name" />
      </el-select>

      <el-input
        v-model="searchText"
        placeholder="搜索容器组"
        style="margin-left: 20px; width: 300px"
        clearable
      />
    </div>

    <!-- 操作栏：批量删除 + 状态筛选 -->
    <div class="actions">
      <el-button
        type="danger"
        size="mini"
        :disabled="selectedPods.length === 0"
        @click="handleBatchDelete"
      >
        批量删除
      </el-button>

      <el-select
        v-model="selectedStatus"
        placeholder="筛选状态"
        clearable
        style="width: 180px"
        @change="handleStatusFilterChange"
      >
        <el-option
          v-for="(count, status) in statusCounts"
          :key="status"
          :label="`${status} (${count})`"
          :value="status"
        />
      </el-select>
    </div>

    <div class="table-container">
      <el-table v-loading="loading" :data="pagedPods || []" border style="flex: 1; overflow: auto" @selection-change="handleSelectionChange">
        <!-- 多选框 -->
        <el-table-column type="selection" width="55" />
        <el-table-column prop="metadata.name" label="名称" width="400" />
        <el-table-column prop="status.phase" label="状态" width="120">
          <template v-slot="{ row }">
            <el-tag :type="getStatusTagType(row.status.phase)" size="small">
              {{ row.status.phase }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="spec.nodeName" label="节点" width="200" />
        <el-table-column prop="status.podIP" label="容器组IP" width="160" />
        <el-table-column prop="metadata.creationTimestamp" label="创建时间" width="180">
          <template v-slot="{ row }">
            {{ formatDate(row.metadata.creationTimestamp) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="220">
          <template v-slot="{ row }">
            <div class="action-buttons">
              <el-button size="small" text @click="handleView(row)">详情</el-button>
              <!-- <el-button size="small" type="primary" @click="handleEdit(row)">编辑</el-button> -->
              <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无容器组数据" />
        </template>
      </el-table>
      <!-- 分页 -->
            <!-- 增强的分页组件 -->
            <el-pagination
        background
        layout="total, sizes, prev, pager, next"
        :current-page="currentPage"
        :page-sizes="[10, 20, 50, 100, 500]"
        :page-size="pageSize"
        :total="filteredPodsByStatus.length"
        style="margin-top: 16px; text-align: right"
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </div>

    <el-dialog title="容器组详情" :visible.sync="showYamlDialog" width="70%" @opened="refreshMonacoEditor">
      <div style="height: 400px; border: 1px solid #dcdfe6; border-radius: 4px">
        <monaco-editor
          ref="yamlViewer"
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
import MonacoEditor from 'vue-monaco-editor'
import yaml from 'js-yaml'

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
        readOnly: false,
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: 'on',
        folding: true,
        wordWrap: 'on'
      },
      loading: false,
      selectedPods: [],
      pageSize: 10,
      currentPage: 1,
      selectedStatus: ''
    }
  },
  computed: {
    ...mapGetters('dashboard', ['workspaces']),
    ...mapGetters('workspace', ['namespaces']),
    ...mapGetters('pods', ['pods']),
    filteredNamespaces() {
      return this.namespaces.filter(ns => ns.metadata.labels?.['kubeants.io/workspace'] === this.selectedWorkspace)
    },
    filteredPods() {
      return this.searchText
        ? this.pods.filter(p => p.metadata.name.includes(this.searchText))
        : this.pods
    },
    statusCounts() {
      const counts = {}
      this.pods.forEach(pod => {
        const phase = pod.status?.phase || 'Unknown'
        counts[phase] = (counts[phase] || 0) + 1
      })
      return counts
    },
    filteredPodsByStatus() {
      if (!this.selectedStatus) return this.filteredPods
      return this.filteredPods.filter(pod => pod.status?.phase === this.selectedStatus)
    },
    pagedPods() {
      const start = (this.currentPage - 1) * this.pageSize
      return this.filteredPodsByStatus.slice(start, start + this.pageSize)
    }
  },
  watch: {
    filteredPodsByStatus() {
      this.currentPage = 1
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
    ...mapActions('storageclass', ['getStorageclass']),
    ...mapActions('pods', [
      'getPod',
      'getPodDetail',
      'createPod',
      'deletePod'
    ]),
    // 新增分页大小改变处理方法
    handleSizeChange(size) {
      this.pageSize = size
      this.currentPage = 1 // 重置到第一页
    },
    async onWorkspaceChange() {
      this.selectedNamespace = ''
      await this.getNamespaces(this.selectedWorkspace)
      const filtered = this.filteredNamespaces
      if (filtered.length > 0) {
        this.selectedNamespace = filtered[0].metadata.name
        this.fetchPods()
      }
    },
    async fetchPods() {
      if (!this.selectedWorkspace || !this.selectedNamespace) return
      this.loading = true
      try {
        await this.getPod({ wsName: this.selectedWorkspace, nsName: this.selectedNamespace })
      } finally {
        this.loading = false
      }
    },
    openCreateDialog() {
      this.createForm = {
        metadata: { name: '' },
        spec: {
          accessModes: [],
          resources: { requests: { storage: '' }},
          storageClassName: ''
        }
      }
      this.createDialogVisible = true

      // ✅ 只在打开创建弹窗时加载一次 SC（可根据实际情况判断是否已加载过）
      if (this.selectedWorkspace) {
        this.getStorageclass({ wsName: this.selectedWorkspace })
      }
    },
    generateYamlFromForm(showMessage = false) {
      const payload = {
        apiVersion: 'v1',
        kind: 'PersistentVolumeClaim',
        metadata: {
          name: this.createForm.metadata.name,
          namespace: this.selectedNamespace
        },
        spec: this.createForm.spec
      }
      this.createYamlContent = yaml.dump(payload)
      this.$refs.createEditor?.editor?.setValue(this.createYamlContent)
      if (showMessage) this.$message.success('已同步到 YAML 模式')
      return this.createYamlContent
    },
    parseYamlToForm() {
      try {
        const parsed = yaml.load(this.createYamlContent)
        this.createForm = {
          metadata: { name: parsed.metadata?.name || '' },
          spec: parsed.spec || {}
        }
        this.$message.success('已同步回表单模式')
      } catch (err) {
        this.$message.error('YAML 解析失败：' + err.message)
      }
    },
    onCreateDialogOpened() {
      this.$nextTick(() => {
        if (this.createTab === 'yaml') {
          this.$refs.createEditor?.editor?.setValue(this.createYamlContent)
        }
      })
    },
    handleTabClick(tab) {
      if (tab.name === 'yaml') {
        this.$nextTick(() => {
          this.$refs.createEditor?.editor?.setValue(this.createYamlContent)
        })
      }
    },
    async submitCreatePod() {
      this.generateYamlFromForm(false)
      let pod
      try {
        pod = yaml.load(this.createYamlContent)
      } catch (err) {
        this.$message.error('YAML 格式错误：' + err.message)
        return
      }

      try {
        await this.createPod({
          wsName: this.selectedWorkspace,
          nsName: this.selectedNamespace,
          podName: pod.metadata.name,
          pod
        })
        this.$message.success('创建成功')
        this.createDialogVisible = false
        this.fetchPods()
      } catch (err) {
        this.$message.error('创建失败')
        console.error(err)
      }
    },
    formatDate(dateStr) {
      if (!dateStr) return '-'
      return new Date(dateStr).toLocaleString()
    },
    async handleDelete(row) {
      this.$confirm(`确认删除容器组 [${row.metadata.name}]？`, '提示', { type: 'warning' }).then(async() => {
        await this.deletePod({ wsName: this.selectedWorkspace, nsName: this.selectedNamespace, podName: row.metadata.name })
        this.fetchPods()
        this.$message.success('删除成功')
      })
    },
    async handleView(row) {
      try {
        const res = await this.getPodDetail({
          wsName: this.selectedWorkspace,
          nsName: this.selectedNamespace,
          podName: row.metadata.name
        })
        this.yamlContent = yaml.dump(res)
        this.showYamlDialog = true

        // 等待渲染后刷新编辑器布局
        this.$nextTick(() => {
          this.$refs.yamlViewer?.editor?.setValue(this.yamlContent)
          this.refreshMonacoEditor()
        })
      } catch (err) {
        this.$message.error('获取 YAML 详情失败')
        console.error(err)
      }
    },
    refreshMonacoEditor() {
      this.$nextTick(() => {
    this.$refs.yamlViewer?.editor?.layout()
      })
    },
    getStatusTagType(phase) {
      switch (phase) {
        case 'Running':
          return 'success'
        case 'Pending':
          return 'warning'
        case 'Failed':
          return 'danger'
        case 'Succeeded':
          return 'info'
        default:
          return ''
      }
    },

    async handleBatchDelete() {
      if (this.selectedPods.length === 0) {
        this.$message.warning('请先选择要删除的 Pod')
        return
      }

      this.$confirm(`确认删除选中的 ${this.selectedPods.length} 个 Pod？`, '提示', { type: 'warning' }).then(async() => {
        const tasks = this.selectedPods.map(pod =>
          this.deletePod({
            wsName: this.selectedWorkspace,
            nsName: this.selectedNamespace,
            podName: pod.metadata.name
          })
        )
        try {
          await Promise.all(tasks)
          this.$message.success('批量删除成功')
          this.fetchPods()
        } catch (err) {
          this.$message.error('删除失败')
          console.error(err)
        }
      })
    },
    // 添加分页事件
    handleSelectionChange(val) {
      this.selectedPods = val
    },
    handlePageChange(page) {
      this.currentPage = page
    },
    handleStatusFilterChange(val) {
      this.selectedStatus = val
      this.currentPage = 1
    }
  }
}
</script>

<style scoped>
.secret-page {
  padding: 20px;
  display: flex;
  flex-direction: column;
}
.filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.filter-label {
  font-size: 14px;
  color: #606266;
  min-width: 100px;
  text-align: right;
  margin-right: 5px;
}
.action-buttons {
  display: flex;
  gap: 8px;
}
.table-container {
  flex: 1;
  overflow-x: auto;
}
.actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 12px 0;
}
</style>
