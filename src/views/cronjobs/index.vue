<template>
  <div class="cronjob-page">
    <div class="filters">
      <span class="filter-label">工作空间：</span>
      <el-select v-model="selectedWorkspace" placeholder="选择工作空间" @change="onWorkspaceChange">
        <el-option v-for="ws in workspaces" :key="ws.name" :label="ws.name" :value="ws.name" />
      </el-select>

      <span class="filter-label">命名空间：</span>
      <el-select v-model="selectedNamespace" placeholder="选择命名空间" style="margin-left: 10px" @change="fetchCronjobs">
        <el-option v-for="ns in filteredNamespaces" :key="ns.metadata.name" :label="ns.metadata.name" :value="ns.metadata.name" />
      </el-select>

      <el-input
        v-model="searchText"
        placeholder="搜索定时任务"
        style="margin-left: 20px; width: 300px"
        clearable
      />
    </div>

    <!-- 操作栏：批量删除 + 类型筛选 -->
    <div class="actions">
      <el-button
        type="danger"
        size="mini"
        :disabled="selectedCronjobs.length === 0"
        @click="handleBatchDelete"
      >
        批量删除
      </el-button>

      <el-select
        v-model="selectedType"
        placeholder="筛选类型"
        clearable
        style="width: 180px"
        @change="handleTypeFilterChange"
      >
        <el-option
          v-for="(count, type) in typeCounts"
          :key="type"
          :label="`${type} (${count})`"
          :value="type"
        />
      </el-select>
    </div>

    <div class="table-container">
      <el-table v-loading="loading" :data="pagedCronjobs || []" border style="flex: 1; overflow: auto" @selection-change="handleSelectionChange">
        <!-- 多选框 -->
        <el-table-column type="selection" width="55" />
        <el-table-column prop="metadata.name" label="名称" width="200" />
        <el-table-column prop="metadata.namespace" label="命名空间" width="200" />
        <el-table-column label="状态" width="100">
          <template v-slot="{ row }">
            <el-tag :type="row.spec.suspend ? 'warning' : 'success'" size="small">
              {{ row.spec.suspend ? '已暂停' : '运行中' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="spec.startingDeadlineSeconds" label="启动超时时间" width="120" />
        <el-table-column prop="spec.successfulJobsHistoryLimit" label="保留成功数" width="120" />
        <el-table-column prop="spec.failedJobsHistoryLimit" label="保留失败数" width="120" />
        <el-table-column prop="spec.schedule" label="计划时间" width="200" />
        <el-table-column prop="metadata.creationTimestamp" label="创建时间" width="180">
          <template v-slot="{ row }">
            {{ formatDate(row.metadata.creationTimestamp) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="200" align="center">
          <template v-slot="{ row }">
            <div class="action-buttons">
              <el-button size="small" text @click="handleView(row)">详情</el-button>
              <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无服务数据" />
        </template>
      </el-table>
      <!-- 分页 -->
      <el-pagination
        background
        layout="total, sizes, prev, pager, next"
        :current-page="currentPage"
        :page-sizes="[10, 20, 50, 100, 500]"
        :page-size="pageSize"
        :total="filteredCronjobsByType.length"
        style="margin-top: 16px; text-align: right"
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </div>

    <el-dialog title="服务详情" :visible.sync="showYamlDialog" width="70%" @opened="refreshMonacoEditor">
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
        readOnly: true,
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: 'on',
        folding: true,
        wordWrap: 'on'
      },
      loading: false,
      selectedCronjobs: [],
      pageSize: 10,
      currentPage: 1,
      selectedType: '',
      currentService: null
    }
  },
  computed: {
    ...mapGetters('dashboard', ['workspaces']),
    ...mapGetters('workspace', ['namespaces']),
    ...mapGetters('cronjobs', ['cronjobs']),
    filteredNamespaces() {
      return this.namespaces.filter(ns => ns.metadata.labels?.['kubeants.io/workspace'] === this.selectedWorkspace)
    },
    filteredCronjobs() {
      return this.searchText
        ? this.cronjobs.filter(s => s.metadata.name.includes(this.searchText))
        : this.cronjobs
    },
    typeCounts() {
      const counts = {}
      this.cronjobs.forEach(cronjob => {
        const type = cronjob.spec?.type || 'Unknown'
        counts[type] = (counts[type] || 0) + 1
      })
      return counts
    },
    filteredCronjobsByType() {
      if (!this.selectedType) return this.filteredCronjobs
      return this.filteredCronjobs.filter(cronjob => cronjob.spec?.type === this.selectedType)
    },
    pagedCronjobs() {
      const start = (this.currentPage - 1) * this.pageSize
      return this.filteredCronjobsByType.slice(start, start + this.pageSize)
    }
  },
  watch: {
    filteredCronjobsByType() {
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
    ...mapActions('cronjobs', [
      'getCronjobs',
      'getCronjobsDetail',
      'deleteCronjobs'
    ]),

    // 新增分页大小改变处理方法
    handleSizeChange(size) {
      this.pageSize = size
      this.currentPage = 1
    },

    async onWorkspaceChange() {
      this.selectedNamespace = ''
      await this.getNamespaces(this.selectedWorkspace)
      const filtered = this.filteredNamespaces
      if (filtered.length > 0) {
        this.selectedNamespace = filtered[0].metadata.name
        this.fetchCronjobs()
      }
    },

    async fetchCronjobs() {
      if (!this.selectedWorkspace || !this.selectedNamespace) return
      this.loading = true
      try {
        await this.getCronjobs({ wsName: this.selectedWorkspace, nsName: this.selectedNamespace })
      } finally {
        this.loading = false
      }
    },

    formatDate(dateStr) {
      if (!dateStr) return '-'
      return new Date(dateStr).toLocaleString()
    },

    async handleDelete(row) {
      this.$confirm(`确认删除服务 [${row.metadata.name}]？`, '提示', { type: 'warning' }).then(async() => {
        await this.deleteCronjobs({
          wsName: this.selectedWorkspace,
          nsName: this.selectedNamespace,
          cjName: row.metadata.name
        })
        this.fetchCronjobs()
        this.$message.success('删除成功')
      })
    },

    async handleView(row) {
      try {
        const res = await this.getCronjobsDetail({
          wsName: this.selectedWorkspace,
          nsName: this.selectedNamespace,
          cjName: row.metadata.name
        })
        this.yamlContent = yaml.dump(res)
        this.showYamlDialog = true

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

    getTypeTagType(type) {
      switch (type) {
        case 'ClusterIP':
          return 'success'
        case 'NodePort':
          return 'warning'
        case 'LoadBalancer':
          return 'primary'
        case 'ExternalName':
          return 'info'
        default:
          return ''
      }
    },

    async handleBatchDelete() {
      if (this.selectedCronjobs.length === 0) {
        this.$message.warning('请先选择要删除的服务')
        return
      }

      this.$confirm(`确认删除选中的 ${this.selectedCronjobs.length} 个服务？`, '提示', { type: 'warning' }).then(async() => {
        const tasks = this.selectedCronjobs.map(cronjob =>
          this.deleteCronjobs({
            wsName: this.selectedWorkspace,
            nsName: this.selectedNamespace,
            cjName: cronjob.metadata.name
          })
        )
        try {
          await Promise.all(tasks)
          this.$message.success('批量删除成功')
          this.fetchCronjobs()
        } catch (err) {
          this.$message.error('删除失败')
          console.error(err)
        }
      })
    },

    handleSelectionChange(val) {
      this.selectedCronjobs = val
    },

    handlePageChange(page) {
      this.currentPage = page
    },

    handleTypeFilterChange(val) {
      this.selectedType = val
      this.currentPage = 1
    },

    getExternalIP(cronjob) {
      if (cronjob.spec.type === 'LoadBalancer') {
        if (cronjob.status?.loadBalancer?.ingress?.length) {
          return cronjob.status.loadBalancer.ingress
            .map(item => item.ip || item.hostname)
            .join(', ')
        }
      }
      return cronjob.spec.externalIPs?.join(', ') || '-'
    },

    formatPorts(ports) {
      if (!ports) return '-'
      return ports.map(p => `${p.port}${p.targetPort ? `:${p.targetPort}` : ''}/${p.protocol || 'TCP'}`).join(', ')
    }
  }
}
</script>

<style scoped>
.cronjob-page {
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
