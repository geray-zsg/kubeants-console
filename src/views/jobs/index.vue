<template>
  <div class="job-page">
    <!-- 筛选区域 -->
    <div class="filters">
      <span class="filter-label">工作空间：</span>
      <el-select v-model="selectedWorkspace" placeholder="选择工作空间" @change="onWorkspaceChange">
        <el-option v-for="ws in workspaces" :key="ws.name" :label="ws.name" :value="ws.name" />
      </el-select>

      <span class="filter-label">命名空间：</span>
      <el-select v-model="selectedNamespace" placeholder="选择命名空间" style="margin-left: 10px" @change="fetchJobs">
        <el-option v-for="ns in filteredNamespaces" :key="ns.metadata.name" :label="ns.metadata.name" :value="ns.metadata.name" />
      </el-select>

      <el-input
        v-model="searchText"
        placeholder="搜索 Job"
        style="margin-left: 20px; width: 300px"
        clearable
      />
    </div>

    <!-- 批量操作栏 -->
    <div class="actions">
      <el-button
        type="danger"
        size="mini"
        :disabled="selectedJobs.length === 0"
        @click="handleBatchDelete"
      >
        批量删除
      </el-button>
    </div>

    <!-- 表格 -->
    <div class="table-container">
      <el-table
        v-loading="loading"
        :data="pagedJobs || []"
        border
        style="flex: 1; overflow: auto"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="metadata.name" label="名称" width="300" />
        <el-table-column prop="metadata.namespace" label="命名空间" width="300" />
        <el-table-column prop="spec.completions" label="状态" width="120" />
        <el-table-column prop="spec.backoffLimit" label="失败重试次数" width="120" />
        <el-table-column prop="spec.completions" label="成功完成次数" width="120" />
        <el-table-column prop="spec.parallelism" label="并行执行数" width="120" />
        <el-table-column label="创建时间" width="180">
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
          <el-empty description="暂无 Job 数据" />
        </template>
      </el-table>

      <!-- 分页 -->
      <el-pagination
        background
        layout="total, sizes, prev, pager, next"
        :current-page="currentPage"
        :page-sizes="[10, 20, 50, 100, 500]"
        :page-size="pageSize"
        :total="filteredJobs.length"
        style="margin-top: 16px; text-align: right"
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </div>

    <!-- 详情弹窗 -->
    <el-dialog title="Job 详情" :visible.sync="showYamlDialog" width="70%" @opened="refreshMonacoEditor">
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
        fontSize: 14
      },
      loading: false,
      selectedJobs: [],
      pageSize: 10,
      currentPage: 1
    }
  },
  computed: {
    ...mapGetters('dashboard', ['workspaces']),
    ...mapGetters('workspace', ['namespaces']),
    ...mapGetters('jobs', ['jobs']),
    filteredNamespaces() {
      return this.namespaces.filter(ns => ns.metadata.labels?.['kubeants.io/workspace'] === this.selectedWorkspace)
    },
    filteredJobs() {
      return this.searchText
        ? this.jobs.filter(j => j.metadata.name.includes(this.searchText))
        : this.jobs
    },
    pagedJobs() {
      const start = (this.currentPage - 1) * this.pageSize
      return this.filteredJobs.slice(start, start + this.pageSize)
    }
  },
  watch: {
    filteredJobs() {
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
    ...mapActions('jobs', ['getJobs', 'getJobsDetail', 'deleteJobs']),

    handleSizeChange(size) {
      this.pageSize = size
      this.currentPage = 1
    },

    async onWorkspaceChange() {
      this.selectedNamespace = ''
      await this.getNamespaces(this.selectedWorkspace)
      if (this.filteredNamespaces.length > 0) {
        this.selectedNamespace = this.filteredNamespaces[0].metadata.name
        this.fetchJobs()
      }
    },

    async fetchJobs() {
      if (!this.selectedWorkspace || !this.selectedNamespace) return
      this.loading = true
      try {
        await this.getJobs({ wsName: this.selectedWorkspace, nsName: this.selectedNamespace })
      } finally {
        this.loading = false
      }
    },

    formatDate(dateStr) {
      if (!dateStr) return '-'
      return new Date(dateStr).toLocaleString()
    },

    async handleDelete(row) {
      this.$confirm(`确认删除 Job [${row.metadata.name}]？`, '提示', { type: 'warning' })
        .then(async() => {
          await this.deleteJobs({
            wsName: this.selectedWorkspace,
            nsName: this.selectedNamespace,
            jobName: row.metadata.name
          })
          this.fetchJobs()
          this.$message.success('删除成功')
        })
    },

    async handleView(row) {
      try {
        const res = await this.getJobsDetail({
          wsName: this.selectedWorkspace,
          nsName: this.selectedNamespace,
          jobName: row.metadata.name
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

    async handleBatchDelete() {
      if (this.selectedJobs.length === 0) {
        this.$message.warning('请先选择要删除的 Job')
        return
      }
      this.$confirm(`确认删除选中的 ${this.selectedJobs.length} 个 Job？`, '提示', { type: 'warning' })
        .then(async() => {
          const tasks = this.selectedJobs.map(job =>
            this.deleteJobs({
              wsName: this.selectedWorkspace,
              nsName: this.selectedNamespace,
              jobName: job.metadata.name
            })
          )
          await Promise.all(tasks)
          this.$message.success('批量删除成功')
          this.fetchJobs()
        })
    },

    handleSelectionChange(val) {
      this.selectedJobs = val
    },

    handlePageChange(page) {
      this.currentPage = page
    }
  }
}
</script>

<style scoped>
.job-page {
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
