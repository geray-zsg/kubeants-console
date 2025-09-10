<template>
  <div class="pvc-page">
    <!-- 过滤区域 -->
    <div class="filters">
      <span class="filter-label">工作空间：</span>
      <el-select
        v-model="selectedWorkspace"
        placeholder="选择 Workspace"
        @change="onWorkspaceChange"
      >
        <el-option
          v-for="ws in workspaces"
          :key="ws.name"
          :label="ws.name"
          :value="ws.name"
        />
      </el-select>

      <span class="filter-label">命名空间：</span>
      <el-select
        v-model="selectedNamespace"
        placeholder="选择 Namespace"
        style="margin-left: 10px"
        @change="fetchPVCs"
      >
        <el-option
          v-for="ns in filteredNamespaces"
          :key="ns.metadata.name"
          :label="ns.metadata.name"
          :value="ns.metadata.name"
        />
      </el-select>

      <el-input
        v-model="searchText"
        placeholder="搜索持久卷声明"
        style="margin-left: 20px; width: 300px"
        clearable
      />

      <el-button
        type="primary"
        style="margin-left: auto"
        @click="openCreateDialog"
      >
        创建持久卷声明
      </el-button>
    </div>

    <!-- 操作栏 -->
    <div class="actions">
      <el-button
        type="danger"
        size="mini"
        :disabled="selectedPVCs.length === 0"
        @click="handleBatchDelete"
      >
        批量删除
      </el-button>
    </div>

    <!-- 表格 -->
    <div class="table-container">
      <el-table
        v-loading="loading"
        :data="pagedData"
        border
        style="width: 100%"
        @selection-change="handleSelectionChange"
        :header-cell-style="{ background: '#f5f7fa', fontWeight: 'bold' }"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="metadata.name" label="名称" width="200" />
        <el-table-column prop="metadata.namespace" label="命名空间" width="160" />
        <el-table-column label="存储容量" width="120">
          <template v-slot="{ row }">
            {{ row.spec.resources.requests.storage || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="实际容量" width="120">
          <template v-slot="{ row }">
            {{ row.status && row.status.capacity ? row.status.capacity.storage : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="访问模式" width="180">
          <template v-slot="{ row }">
            <div v-if="row.spec.accessModes && row.spec.accessModes.length > 0">
              <el-tag
                v-for="mode in row.spec.accessModes"
                :key="mode"
                size="small"
                type="info"
                style="margin-right: 5px; margin-bottom: 2px"
              >
                {{ mode }}
              </el-tag>
            </div>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="spec.storageClassName" label="存储类" width="200" />
        <el-table-column prop="spec.volumeName" label="持久卷" width="200" />
        <el-table-column label="状态" width="120">
          <template v-slot="{ row }">
            <el-tag :type="getPVCStatusType(row.status.phase)" size="small">
              {{ row.status.phase || 'Unknown' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="metadata.creationTimestamp" label="创建时间" width="180">
          <template v-slot="{ row }">
            {{ formatDate(row.metadata.creationTimestamp) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="220">
          <template v-slot="{ row }">
            <div class="action-buttons">
              <el-button size="small" @click="handleView(row)">详情</el-button>
              <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
            </div>
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
        :total="tableData.length"
        :page-size="pageSize"
        :current-page="currentPage"
        :page-sizes="[10, 20, 50, 100]"
        @size-change="handleSizeChange"
        @current-change="handlePageChange"
        style="margin-top: 16px; text-align: right"
      />
    </div>

    <!-- PVC 详情对话框 -->
    <el-dialog
      title="PVC 详情"
      :visible.sync="showYamlDialog"
      width="70%"
    >
      <div style="height: 400px; border: 1px solid #dcdfe6; border-radius: 4px">
        <monaco-editor
          ref="yamlViewer"
          v-model="yamlContent"
          language="yaml"
          theme="vs-dark"
          :options="detailEditorOptions"
        />
      </div>
      <span slot="footer" class="dialog-footer">
        <el-button @click="showYamlDialog = false">关闭</el-button>
      </span>
    </el-dialog>

    <!-- 创建 PVC 对话框 -->
    <el-dialog
      :title="isEditMode ? '编辑持久卷声明' : '创建持久卷声明'"
      :visible.sync="createDialogVisible"
      width="70%"
      @opened="onCreateDialogOpened"
    >
      <el-tabs v-model="createTab">
        <!-- 表单模式 -->
        <el-tab-pane label="表单模式" name="form">
          <el-form :model="createForm" label-width="120px">
            <el-form-item label="名称" required>
              <el-input v-model="createForm.metadata.name" placeholder="输入PVC名称" />
            </el-form-item>
            <el-form-item label="命名空间">
              <el-select v-model="createForm.metadata.namespace" placeholder="选择命名空间">
                <el-option
                  v-for="ns in filteredNamespaces"
                  :key="ns.metadata.name"
                  :label="ns.metadata.name"
                  :value="ns.metadata.name"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="访问模式" required>
              <el-select v-model="createForm.spec.accessModes" multiple placeholder="选择访问模式">
                <el-option label="ReadWriteOnce" value="ReadWriteOnce" />
                <el-option label="ReadOnlyMany" value="ReadOnlyMany" />
                <el-option label="ReadWriteMany" value="ReadWriteMany" />
              </el-select>
            </el-form-item>
            <el-form-item label="存储类">
              <el-select v-model="createForm.spec.storageClassName" placeholder="请选择 StorageClass">
                <el-option
                  v-for="sc in storageclass"
                  :key="sc.metadata.name"
                  :label="sc.metadata.name"
                  :value="sc.metadata.name"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="请求存储量" required>
              <el-input v-model="createForm.spec.resources.requests.storage" placeholder="如 1Gi" />
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- YAML 模式 -->
        <el-tab-pane label="YAML 模式" name="yaml">
          <div style="height: 400px; border: 1px solid #dcdfe6; border-radius: 4px">
            <monaco-editor
              ref="createEditor"
              v-model="createYamlContent"
              language="yaml"
              theme="vs-dark"
              :options="detailEditorOptions"
            />
          </div>
        </el-tab-pane>
      </el-tabs>

      <div slot="footer" class="dialog-footer">
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">{{ isEditMode ? '更新' : '创建' }}</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'
import MonacoEditor from 'vue-monaco-editor'
import yaml from 'js-yaml'
import paginationMixin from '@/utils/pagination'

export default {
  mixins: [paginationMixin],
  components: { MonacoEditor },
  data() {
    return {
      selectedWorkspace: '',
      selectedNamespace: '',
      searchText: '',
      showYamlDialog: false,
      yamlContent: '',
      createDialogVisible: false,
      createTab: 'form',
      isEditMode: false,
      selectedPVCs: [],
      loading: false,
      createForm: {
        metadata: { 
          name: '',
          namespace: ''
        },
        spec: {
          accessModes: [],
          resources: { requests: { storage: '' } },
          storageClassName: ''
        }
      },
      createYamlContent: '',
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
    ...mapGetters('persistentvolumeclaims', ['persistentvolumeclaims']),
    filteredNamespaces() {
      return this.namespaces.filter(
        ns => ns.metadata.labels?.['kubeants.io/workspace'] === this.selectedWorkspace
      )
    },
    // 这是 mixin 里 pagedData 的输入
    tableData() {
      if (!this.searchText) return this.persistentvolumeclaims || []
      return (this.persistentvolumeclaims || []).filter(pvc =>
        pvc.metadata.name.includes(this.searchText)
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
    ...mapActions('storageclass', ['getStorageclass']),
    ...mapActions('persistentvolumeclaims', [
      'getPersistentVolumeClaims',
      'getPersistentVolumeClaimsDetaile',
      'createPersistentVolumeClaims',
      'deletePersistentVolumeClaims',
      'batchDeletePersistentVolumeClaims'
    ]),

    async onWorkspaceChange() {
      this.selectedNamespace = ''
      await this.getNamespaces(this.selectedWorkspace)
      const filtered = this.filteredNamespaces
      if (filtered.length > 0) {
        this.selectedNamespace = filtered[0].metadata.name
        await this.fetchPVCs()
      }
    },
    
    async fetchPVCs() {
      if (!this.selectedWorkspace || !this.selectedNamespace) return
      this.loading = true
      try {
        await this.getPersistentVolumeClaims({
          wsName: this.selectedWorkspace,
          nsName: this.selectedNamespace
        })
      } catch (error) {
        console.error('获取PVC列表失败:', error)
        this.$message.error('获取PVC列表失败')
      } finally {
        this.loading = false
      }
    },
    
    openCreateDialog() {
      this.isEditMode = false
      this.createForm = {
        metadata: { 
          name: '',
          namespace: this.selectedNamespace
        },
        spec: {
          accessModes: [],
          resources: { requests: { storage: '' } },
          storageClassName: ''
        }
      }
      this.createDialogVisible = true

      if (this.selectedWorkspace) {
        this.getStorageclass({ wsName: this.selectedWorkspace })
      }
    },
    
    generateYamlFromForm() {
      const payload = {
        apiVersion: 'v1',
        kind: 'PersistentVolumeClaim',
        metadata: {
          name: this.createForm.metadata.name,
          namespace: this.createForm.metadata.namespace || this.selectedNamespace
        },
        spec: this.createForm.spec
      }
      this.createYamlContent = yaml.dump(payload)
      if (this.$refs.createEditor && this.$refs.createEditor.editor) {
        this.$refs.createEditor.editor.setValue(this.createYamlContent)
      }
      return this.createYamlContent
    },
    
    parseYamlToForm() {
      try {
        const parsed = yaml.load(this.createYamlContent)
        this.createForm = {
          metadata: { 
            name: parsed.metadata?.name || '',
            namespace: parsed.metadata?.namespace || this.selectedNamespace
          },
          spec: parsed.spec || {}
        }
        this.$message.success('已同步回表单模式')
      } catch (err) {
        this.$message.error('YAML 解析失败：' + err.message)
      }
    },
    
    onCreateDialogOpened() {
      if (this.createTab === 'yaml') {
        this.$nextTick(() => {
          this.generateYamlFromForm()
        })
      }
    },
    
    async handleSubmit() {
      let yamlContent = this.createYamlContent
      // 如果当前是表单模式，我们需要生成YAML
      if (this.createTab === 'form') {
        this.generateYamlFromForm()
        yamlContent = this.createYamlContent
      }

      let parsed
      try {
        parsed = yaml.load(yamlContent)
      } catch (err) {
        this.$message.error('YAML 格式错误: ' + err.message)
        return
      }

      const pvcName = parsed.metadata.name
      const namespace = parsed.metadata.namespace || this.selectedNamespace

      // 验证必填字段
      if (!pvcName) {
        this.$message.error('PVC名称不能为空')
        return
      }

      if (!parsed.spec.accessModes || parsed.spec.accessModes.length === 0) {
        this.$message.error('访问模式不能为空')
        return
      }

      if (!parsed.spec.resources || !parsed.spec.resources.requests || !parsed.spec.resources.requests.storage) {
        this.$message.error('存储请求量不能为空')
        return
      }

      try {
        // 创建PVC
        await this.createPersistentVolumeClaims({
          wsName: this.selectedWorkspace,
          nsName: namespace,
          pvcName: pvcName,
          pvc: parsed
        })

        this.$message.success('创建成功')
        this.createDialogVisible = false
        this.fetchPVCs()
      } catch (err) {
        this.$message.error('创建失败: ' + (err.message || '未知错误'))
        console.error(err)
      }
    },
    
    formatDate(dateStr) {
      if (!dateStr) return '-'
      return new Date(dateStr).toLocaleString()
    },
    
    async handleDelete(row) {
      this.$confirm(`确认删除PVC [${row.metadata.name}]？`, '提示', { type: 'warning' })
        .then(async () => {
          await this.deletePersistentVolumeClaims({
            wsName: this.selectedWorkspace,
            nsName: this.selectedNamespace,
            pvcName: row.metadata.name
          })
          this.fetchPVCs()
          this.$message.success('删除成功')
        })
    },
    
    async handleView(row) {
      try {
        const res = await this.getPersistentVolumeClaimsDetaile({
          wsName: this.selectedWorkspace,
          nsName: this.selectedNamespace,
          pvcName: row.metadata.name
        })
        this.yamlContent = yaml.dump(res)
        this.showYamlDialog = true

        this.$nextTick(() => {
          if (this.$refs.yamlViewer && this.$refs.yamlViewer.editor) {
            this.$refs.yamlViewer.editor.setValue(this.yamlContent)
          }
        })
      } catch (err) {
        this.$message.error('获取 YAML 详情失败')
        console.error(err)
      }
    },
    
    // PVC状态标签类型
    getPVCStatusType(status) {
      switch (status) {
        case 'Bound': return 'success'
        case 'Pending': return 'warning'
        case 'Lost': return 'danger'
        default: return 'info'
      }
    },
    
    // 批量选择处理
    handleSelectionChange(val) {
      this.selectedPVCs = val
    },
    
    // 批量删除
    async handleBatchDelete() {
      if (this.selectedPVCs.length === 0) {
        this.$message.warning('请先选择要删除的PVC')
        return
      }

      this.$confirm(`确认删除选中的 ${this.selectedPVCs.length} 个PVC？`, '提示', { type: 'warning' })
        .then(async () => {
          const tasks = this.selectedPVCs.map(pvc =>
            this.deletePersistentVolumeClaims({
              wsName: this.selectedWorkspace,
              nsName: this.selectedNamespace,
              pvcName: pvc.metadata.name
            })
          )
          try {
            await Promise.all(tasks)
            this.$message.success('批量删除成功')
            this.fetchPVCs()
            this.selectedPVCs = []
          } catch (err) {
            this.$message.error('删除失败')
            console.error(err)
          }
        })
    }
  }
}
</script>

<style scoped>
.pvc-page {
  padding: 20px;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 100px);
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

.actions {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.table-container {
  flex: 1;
  overflow: auto;
}

.action-buttons {
  display: flex;
  gap: 8px;
}
</style>