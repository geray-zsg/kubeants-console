<template>
  <div class="service-page">
    <div class="filters">
      <span class="filter-label">工作空间：</span>
      <el-select v-model="selectedWorkspace" placeholder="选择工作空间" @change="onWorkspaceChange">
        <el-option v-for="ws in workspaces" :key="ws.name" :label="ws.name" :value="ws.name" />
      </el-select>

      <span class="filter-label">命名空间：</span>
      <el-select v-model="selectedNamespace" placeholder="选择命名空间" style="margin-left: 10px" @change="fetchServices">
        <el-option v-for="ns in filteredNamespaces" :key="ns.metadata.name" :label="ns.metadata.name" :value="ns.metadata.name" />
      </el-select>

      <el-input
        v-model="searchText"
        placeholder="搜索服务"
        style="margin-left: 20px; width: 300px"
        clearable
      />
    </div>

    <!-- 操作栏：批量删除 + 类型筛选 -->
    <div class="actions">
      <el-button
        type="danger"
        size="mini"
        :disabled="selectedServices.length === 0"
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
      <el-table v-loading="loading" :data="pagedServices || []" border style="flex: 1; overflow: auto" @selection-change="handleSelectionChange">
        <!-- 多选框 -->
        <el-table-column type="selection" width="55" />
        <el-table-column prop="metadata.name" label="名称" width="400" />
        <el-table-column prop="spec.type" label="类型" width="120">
          <template v-slot="{ row }">
            <el-tag :type="getTypeTagType(row.spec.type)" size="small">
              {{ row.spec.type }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="集群IP" width="160">
          <template v-slot="{ row }">
            {{ row.spec.clusterIP }}
          </template>
        </el-table-column>
        <el-table-column label="外部IP" width="200">
          <template v-slot="{ row }">
            {{ getExternalIP(row) }}
          </template>
        </el-table-column>
        <el-table-column label="端口" width="200">
          <template v-slot="{ row }">
            {{ formatPorts(row.spec.ports) }}
          </template>
        </el-table-column>
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
        :total="filteredServicesByType.length"
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
      selectedServices: [],
      pageSize: 10,
      currentPage: 1,
      selectedType: '',
      currentService: null
    }
  },
  computed: {
    ...mapGetters('dashboard', ['workspaces']),
    ...mapGetters('workspace', ['namespaces']),
    ...mapGetters('services', ['services']),
    filteredNamespaces() {
      return this.namespaces.filter(ns => ns.metadata.labels?.['kubeants.io/workspace'] === this.selectedWorkspace)
    },
    filteredServices() {
      return this.searchText
        ? this.services.filter(s => s.metadata.name.includes(this.searchText))
        : this.services
    },
    typeCounts() {
      const counts = {}
      this.services.forEach(service => {
        const type = service.spec?.type || 'Unknown'
        counts[type] = (counts[type] || 0) + 1
      })
      return counts
    },
    filteredServicesByType() {
      if (!this.selectedType) return this.filteredServices
      return this.filteredServices.filter(service => service.spec?.type === this.selectedType)
    },
    pagedServices() {
      const start = (this.currentPage - 1) * this.pageSize
      return this.filteredServicesByType.slice(start, start + this.pageSize)
    }
  },
  watch: {
    filteredServicesByType() {
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
    ...mapActions('services', [
      'getServices',
      'getServicesDetail',
      'deleteServices'
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
        this.fetchServices()
      }
    },

    async fetchServices() {
      if (!this.selectedWorkspace || !this.selectedNamespace) return
      this.loading = true
      try {
        await this.getServices({ wsName: this.selectedWorkspace, nsName: this.selectedNamespace })
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
        await this.deleteServices({
          wsName: this.selectedWorkspace,
          nsName: this.selectedNamespace,
          svcName: row.metadata.name
        })
        this.fetchServices()
        this.$message.success('删除成功')
      })
    },

    async handleView(row) {
      try {
        const res = await this.getServicesDetail({
          wsName: this.selectedWorkspace,
          nsName: this.selectedNamespace,
          svcName: row.metadata.name
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
      if (this.selectedServices.length === 0) {
        this.$message.warning('请先选择要删除的服务')
        return
      }

      this.$confirm(`确认删除选中的 ${this.selectedServices.length} 个服务？`, '提示', { type: 'warning' }).then(async() => {
        const tasks = this.selectedServices.map(service =>
          this.deleteServices({
            wsName: this.selectedWorkspace,
            nsName: this.selectedNamespace,
            svcName: service.metadata.name
          })
        )
        try {
          await Promise.all(tasks)
          this.$message.success('批量删除成功')
          this.fetchServices()
        } catch (err) {
          this.$message.error('删除失败')
          console.error(err)
        }
      })
    },

    handleSelectionChange(val) {
      this.selectedServices = val
    },

    handlePageChange(page) {
      this.currentPage = page
    },

    handleTypeFilterChange(val) {
      this.selectedType = val
      this.currentPage = 1
    },

    getExternalIP(service) {
      if (service.spec.type === 'LoadBalancer') {
        if (service.status?.loadBalancer?.ingress?.length) {
          return service.status.loadBalancer.ingress
            .map(item => item.ip || item.hostname)
            .join(', ')
        }
      }
      return service.spec.externalIPs?.join(', ') || '-'
    },

    formatPorts(ports) {
      if (!ports) return '-'
      return ports.map(p => `${p.port}${p.targetPort ? `:${p.targetPort}` : ''}/${p.protocol || 'TCP'}`).join(', ')
    }
  }
}
</script>

<style scoped>
.service-page {
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
