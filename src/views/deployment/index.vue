<template>
  <div class="secret-page">
    <div class="filters">
      <span class="filter-label">工作空间：</span>
      <el-select v-model="selectedWorkspace" placeholder="选择工作空间" @change="onWorkspaceChange">
        <el-option v-for="ws in workspaces" :key="ws.name" :label="ws.name" :value="ws.name" />
      </el-select>

      <span class="filter-label">命名空间：</span>
      <el-select v-model="selectedNamespace" placeholder="选择命名空间" style="margin-left: 10px" @change="fetchdeployments">
        <el-option v-for="ns in filteredNamespaces" :key="ns.metadata.name" :label="ns.metadata.name" :value="ns.metadata.name" />
      </el-select>

      <el-input
        v-model="searchText"
        placeholder="搜索无状态服务"
        style="margin-left: 20px; width: 300px"
        clearable
      />
    </div>

    <!-- 操作栏：批量删除 + 状态筛选 -->
    <div class="actions">
      <el-button
        type="danger"
        size="mini"
        :disabled="selectedDeployments.length === 0"
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
      <!-- 优化后的表格 -->
      <el-table
        v-loading="loading"
        :data="pagedDeployments || []"
        border
        style="flex: 1; overflow: auto"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="metadata.name" label="名称" width="220" />

        <!-- 状态列优化 -->
        <el-table-column label="状态" width="120">
          <template v-slot="{ row }">
            <el-tag :type="getDeploymentStatusTagType(row)" size="small">
              {{ getDeploymentStatus(row) }}
            </el-tag>
          </template>
        </el-table-column>

        <!-- 新增副本数列 -->
        <el-table-column label="副本" width="120">
          <template v-slot="{ row }">
            <span class="replica-count">
              {{ getAvailableReplicas(row) }}/{{ getDesiredReplicas(row) }}
            </span>
          </template>
        </el-table-column>

        <!-- 新增就绪状态列 -->
        <el-table-column label="就绪" width="120">
          <template v-slot="{ row }">
            <span class="ready-count">
              {{ getReadyReplicas(row) }}/{{ getDesiredReplicas(row) }}
            </span>
          </template>
        </el-table-column>

        <!-- 新增镜像信息列 -->
        <el-table-column label="镜像" min-width="200">
          <template v-slot="{ row }">
            <div class="image-info">
              <el-tooltip
                v-for="(container, index) in getContainers(row)"
                :key="index"
                :content="container.image"
              >
                <el-tag size="small" class="image-tag">
                  {{ truncateImageName(container.image) }}
                </el-tag>
              </el-tooltip>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="metadata.creationTimestamp" label="创建时间" width="180">
          <template v-slot="{ row }">
            {{ formatDate(row.metadata.creationTimestamp) }}
          </template>
        </el-table-column>

        <el-table-column label="操作" fixed="right" width="180">
          <template v-slot="{ row }">
            <div class="action-buttons">
              <el-button size="small" text @click="handleView(row)">详情</el-button>
              <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>

        <template #empty>
          <el-empty description="暂无Deployment数据" />
        </template>
      </el-table>

      <!-- 增强的分页组件 -->
      <el-pagination
        background
        layout="total, sizes, prev, pager, next"
        :current-page="currentPage"
        :page-sizes="[10, 20, 50, 100, 500]"
        :page-size="pageSize"
        :total="filteredDeploymentsByStatus.length"
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
          :options="DetailditorOptions"
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
      DetailditorOptions: {
        readOnly: false,
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: 'on',
        folding: true,
        wordWrap: 'on'
      },
      loading: false,
      selectedDeployments: [],
      pageSize: 10,
      currentPage: 1,
      selectedStatus: ''
    }
  },
  computed: {
    ...mapGetters('dashboard', ['workspaces']),
    ...mapGetters('workspace', ['namespaces']),
    ...mapGetters('deployments', ['deployments']),
    filteredNamespaces() {
      return this.namespaces.filter(ns => ns.metadata.labels?.['kubeants.io/workspace'] === this.selectedWorkspace)
    },
    filteredDeployments() {
      return this.searchText
        ? this.deployments.filter(p => p.metadata.name.includes(this.searchText))
        : this.deployments
    },
    filteredDeploymentsByStatus() {
      if (!this.selectedStatus) return this.filteredDeployments
      return this.filteredDeployments.filter(deployment => {
        const status = this.getDeploymentStatus(deployment)
        return status === this.selectedStatus
      })
    },

    pagedDeployments() {
      const start = (this.currentPage - 1) * this.pageSize
      return this.filteredDeploymentsByStatus.slice(start, start + this.pageSize)
    },
    // 优化状态统计
    statusCounts() {
      const counts = {}
      this.filteredDeployments.forEach(deploy => {
        const status = this.getDeploymentStatus(deploy)
        counts[status] = (counts[status] || 0) + 1
      })
      return counts
    }
  },
  watch: {
    filteredDeploymentsByStatus() {
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
    ...mapActions('deployments', [
      'getDeployment',
      'getDeploymentDetail',
      'createDeployment',
      'deleteDeployment'
    ]),

    async onWorkspaceChange() {
      this.selectedNamespace = ''
      await this.getNamespaces(this.selectedWorkspace)
      const filtered = this.filteredNamespaces
      if (filtered.length > 0) {
        this.selectedNamespace = filtered[0].metadata.name
        this.fetchdeployments()
      }
    },
    async fetchdeployments() {
      if (!this.selectedWorkspace || !this.selectedNamespace) return
      this.loading = true
      try {
        await this.getDeployment({ wsName: this.selectedWorkspace, nsName: this.selectedNamespace })
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
    async submitCreatePVC() {
      this.generateYamlFromForm(false)
      let pvc
      try {
        pvc = yaml.load(this.createYamlContent)
      } catch (err) {
        this.$message.error('YAML 格式错误：' + err.message)
        return
      }

      try {
        await this.createDeployment({
          wsName: this.selectedWorkspace,
          nsName: this.selectedNamespace,
          pvcName: pvc.metadata.name,
          pvc
        })
        this.$message.success('创建成功')
        this.createDialogVisible = false
        this.fetchdeployments()
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
        await this.deleteDeployment({ wsName: this.selectedWorkspace, nsName: this.selectedNamespace, deployName: row.metadata.name })
        this.fetchdeployments()
        this.$message.success('删除成功')
      })
    },
    async handleView(row) {
      try {
        const res = await this.getDeploymentDetail({
          wsName: this.selectedWorkspace,
          nsName: this.selectedNamespace,
          deployName: row.metadata.name
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
      if (this.selectedDeployments.length === 0) {
        this.$message.warning('请先选择要删除的 Deployment')
        return
      }

      this.$confirm(`确认删除选中的 ${this.selectedDeployments.length} 个 Deployment？`, '提示', { type: 'warning' }).then(async() => {
        const tasks = this.selectedDeployments.map(Deployment =>
          this.deleteDeployment({
            wsName: this.selectedWorkspace,
            nsName: this.selectedNamespace,
            deployName: Deployment.metadata.name
          })
        )
        try {
          await Promise.all(tasks)
          this.$message.success('批量删除成功')
          this.fetchdeployments()
        } catch (err) {
          this.$message.error('删除失败')
          console.error(err)
        }
      })
    },
    // 添加分页事件
    handleSelectionChange(val) {
      this.selectedDeployments = val
    },
    handlePageChange(page) {
      this.currentPage = page
    },
    handleStatusFilterChange(val) {
      this.selectedStatus = val
      this.currentPage = 1
    },
    // 新增分页大小改变处理方法
    handleSizeChange(size) {
      this.pageSize = size
      this.currentPage = 1 // 重置到第一页
    },
    // 优化Deployment状态获取
    getDeploymentStatus(deployment) {
      if (!deployment.status) return 'Unknown'

      const available = deployment.status.availableReplicas || 0
      const desired = deployment.spec.replicas || 0

      if (deployment.status.conditions?.some(c => c.type === 'Progressing' && c.status === 'False')) {
        return 'Failed'
      }
      if (available === desired) {
        return 'Running'
      }
      if (desired === 0) {
        return 'Stopped'
      }
      return 'Updating'
    },
    // 优化状态标签类型
    getDeploymentStatusTagType(deployment) {
      const status = this.getDeploymentStatus(deployment)
      switch (status) {
        case 'Running': return 'success'
        case 'Stopped': return 'info'
        case 'Updating': return 'warning'
        case 'Failed': return 'danger'
        default: return ''
      }
    },
    // 获取容器信息
    getContainers(deployment) {
      return deployment.spec.template?.spec?.containers || []
    },

    // 获取可用副本数
    getAvailableReplicas(deployment) {
      return deployment.status?.availableReplicas || 0
    },
    // 获取就绪副本数
    getReadyReplicas(deployment) {
      return deployment.status?.readyReplicas || 0
    },

    // 获取期望副本数
    getDesiredReplicas(deployment) {
      return deployment.spec?.replicas || 0
    },

    // 缩短镜像名称显示
    truncateImageName(image) {
      if (!image) return ''

      // 移除仓库地址，只保留镜像名和tag
      const parts = image.split('/')
      const result = parts[parts.length - 1]

      // 截断过长的镜像名
      if (result.length > 30) {
        return result.substring(0, 27) + '...'
      }
      return result
    }

  }
}
</script>

<style scoped>
.deployment-page {
  padding: 20px;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 100px);
}

.table-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 新增样式 */
.replica-count, .ready-count {
  font-weight: bold;
  font-family: 'Courier New', monospace;
}

.image-info {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.image-tag {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
}
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
