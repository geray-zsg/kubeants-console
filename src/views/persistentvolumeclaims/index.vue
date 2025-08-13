<template>
  <div class="secret-page">
    <div class="filters">
      <span class="filter-label">工作空间：</span>
      <el-select v-model="selectedWorkspace" placeholder="选择 Workspace" @change="onWorkspaceChange">
        <el-option v-for="ws in workspaces" :key="ws.name" :label="ws.name" :value="ws.name" />
      </el-select>

      <span class="filter-label">命名空间：</span>
      <el-select v-model="selectedNamespace" placeholder="选择 Namespace" style="margin-left: 10px" @change="fetchPVCs">
        <el-option v-for="ns in filteredNamespaces" :key="ns.metadata.name" :label="ns.metadata.name" :value="ns.metadata.name" />
      </el-select>

      <el-input
        v-model="searchText"
        placeholder="搜索持久卷申明"
        style="margin-left: 20px; width: 300px"
        clearable
      />

      <el-button type="primary" style="margin-left: auto" @click="openCreateDialog">
        创建持久卷申明
      </el-button>
    </div>
    <div class="table-container">
      <el-table :data="filteredPVCS" border style="flex: 1; overflow: auto">
        <el-table-column prop="metadata.name" label="名称" width="200" />、
        <el-table-column prop="metadata.namespace" label="命名空间" width="160" />
        <el-table-column prop="spec.resources.requests.storage" label="请求存储容量" width="120" />
        <el-table-column prop="status.capacity.storage" label="实际分配容量" width="120" />
        <el-table-column label="访问模式" width="180">
          <template v-slot="{ row }">
            <el-tag v-for="mode in row.spec.accessModes" :key="mode" size="small" type="info" style="margin-right: 5px">
              {{ mode }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="spec.storageClassName" label="存储类" width="200" />
        <el-table-column prop="spec.volumeName" label="持久卷" width="400" />
        <el-table-column prop="status.phase" label="状态" width="200" />
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
          <el-empty description="暂无数据" />
        </template>
      </el-table>
    </div>

    <el-dialog title="PVC 详情 (YAML)" :visible.sync="showYamlDialog" width="70%" @opened="refreshMonacoEditor">
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

    <el-dialog :title="isEditMode ? '编辑持久卷声明' : '创建持久卷声明'" :visible.sync="createDialogVisible" width="70%" @opened="onCreateDialogOpened">
      <el-tabs v-model="createTab" @tab-click="handleTabClick">
        <el-tab-pane label="表单模式" name="form">
          <el-form :model="createForm" label-width="120px">
            <el-form-item label="名称">
              <el-input v-model="createForm.metadata.name" />
            </el-form-item>
            <el-form-item label="访问模式">
              <el-select v-model="createForm.spec.accessModes" multiple placeholder="选择访问模式">
                <el-option label="ReadWriteOnce" value="ReadWriteOnce" />
                <el-option label="ReadOnlyMany" value="ReadOnlyMany" />
                <el-option label="ReadWriteMany" value="ReadWriteMany" />
              </el-select>
            </el-form-item>
            <el-form-item label="存储类">
              <el-select v-model="createForm.spec.storageClassName" placeholder="请选择 StorageClass">
                <el-option v-for="sc in storageclass" :key="sc.metadata.name" :label="sc.metadata.name" :value="sc.metadata.name" />
              </el-select>
            </el-form-item>
            <el-form-item label="请求存储量">
              <el-input v-model="createForm.spec.resources.requests.storage" placeholder="如 1Gi" />
            </el-form-item>
            <el-button type="text" @click="generateYamlFromForm(true)">同步到 YAML 模式</el-button>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="YAML 模式" name="yaml">
          <monaco-editor
            ref="createEditor"
            v-model="createYamlContent"
            language="yaml"
            theme="vs-dark"
            :options="detailEditorOptions"
            style="height: 400px; border: 1px solid #dcdfe6; border-radius: 4px"
          />
          <el-button type="text" @click="parseYamlToForm">同步回表单模式</el-button>
        </el-tab-pane>
      </el-tabs>

      <div slot="footer" class="dialog-footer">
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCreatePVC">创建</el-button>
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
      createDialogVisible: false,
      createTab: 'form',
      isEditMode: false,
      createForm: {
        metadata: { name: '' },
        spec: {
          accessModes: [],
          resources: { requests: { storage: '' }},
          storageClassName: ''
        }
      },
      createYamlContent: '',
      detailEditorOptions: {
        readOnly: false,
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
      return this.namespaces.filter(ns => ns.metadata.labels?.['kubeants.io/workspace'] === this.selectedWorkspace)
    },
    filteredPVCS() {
      if (!this.searchText) return this.persistentvolumeclaims
      return this.persistentvolumeclaims.filter(pvc => pvc.metadata.name.includes(this.searchText))
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
      'createPersistentVolumeClaims',
      'deletePersistentVolumeClaims'
    ]),

    async onWorkspaceChange() {
      this.selectedNamespace = ''
      await this.getNamespaces(this.selectedWorkspace)
      const filtered = this.filteredNamespaces
      if (filtered.length > 0) {
        this.selectedNamespace = filtered[0].metadata.name
        this.fetchPVCs()
      }
    },
    async fetchPVCs() {
      if (!this.selectedWorkspace || !this.selectedNamespace) return
      await this.getPersistentVolumeClaims({ wsName: this.selectedWorkspace, nsName: this.selectedNamespace })
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
        await this.createPersistentVolumeClaims({
          wsName: this.selectedWorkspace,
          nsName: this.selectedNamespace,
          pvcName: pvc.metadata.name,
          pvc
        })
        this.$message.success('创建成功')
        this.createDialogVisible = false
        this.fetchPVCs()
      } catch (err) {
        this.$message.error('创建失败')
        console.error(err)
      }
    },
    formatDate(dateStr) {
      return new Date(dateStr).toLocaleString()
    },
    async handleDelete(row) {
      this.$confirm(`确认删除PVC [${row.metadata.name}]？`, '提示', { type: 'warning' }).then(async() => {
        await this.deletePersistentVolumeClaims({ wsName: this.selectedWorkspace, nsName: this.selectedNamespace, pvcName: row.metadata.name })
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
    }
  }
}
</script>

<style scoped>
.secret-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 20px;
  box-sizing: border-box;
}

.filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 10px;
  flex-shrink: 0;
}
.action-buttons {
  display: flex;
  gap: 1px;
  flex-wrap: wrap; /* 小屏时自动换行 */
}
.filter-label {
  font-size: 14px;
  color: #606266;
  min-width: 100px;
  text-align: right;
  margin-right: 5px;
}

.table-container {
  flex: 1;
  overflow-x: auto;
  overflow-y: auto;
}

.dialog-footer {
  text-align: right;
}
</style>
