<template>
  <div class="configmap-page">
    <!-- 顶部筛选和创建按钮 -->
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
        placeholder="搜索配置字典"
        style="margin-left: 20px; width: 300px"
        clearable
      />

      <el-button type="primary" style="margin-left: auto" @click="openCreateDialog">
        创建配置字典
      </el-button>
    </div>

    <!-- ConfigMap 表格 -->
    <el-table :data="filteredConfigmaps" border style="width: 100%">
      <el-table-column prop="metadata.name" label="名称" width="300" />
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
      <el-table-column prop="metadata.namespace" label="命名空间" width="300" />
      <el-table-column prop="metadata.creationTimestamp" label="创建时间" width="200">
        <template v-slot="{ row }">
          {{ formatDate(row.metadata.creationTimestamp) }}
        </template>
      </el-table-column>
      <el-table-column label="操作">
        <template v-slot="{ row }">
          <el-button size="small" :disabled="!selectedWorkspace || !selectedNamespace" @click="handleView(row)">详情</el-button>
          <el-button type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
          <el-button type="danger" size="small" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- YAML 详情对话框 -->
    <el-dialog :visible.sync="showYamlDialog" title="配置字典详情" width="70%" @opened="refreshMonacoEditor">
      <div style="height: 500px; border: 1px solid #dcdfe6; border-radius: 4px">
        <monaco-editor
          ref="viewEditor"
          v-model="yamlContent"
          language="yaml"
          theme="vs-dark"
          :options="detailEditorOptions"
        />
      </div>
    </el-dialog>

    <!-- 创建 ConfigMap 对话框 -->
    <el-dialog
      :title="isEditMode ? '编辑配置字典' : '创建配置字典'"
      :visible.sync="showCreateDialog"
      width="70%"
      @opened="onCreateDialogOpened"
    >
      <el-tabs v-model="createTab" @tab-click="handleTabClick">
        <!-- 表单模式 -->
        <el-tab-pane label="表单模式" name="form">
          <el-form ref="createFormRef" :model="createForm" label-width="100px">
            <el-form-item label="名称" prop="name" :rules="[{ required: true, message: '请输入名称', trigger: 'blur' }]">
              <el-input v-model="createForm.name" />
            </el-form-item>
            <el-form-item label="命名空间">
              <el-input :value="selectedNamespace" disabled />
            </el-form-item>
            <el-form-item label="数据内容">
              <div v-for="(item, index) in createForm.dataItems" :key="index" class="kv-pair">
                <el-input v-model="item.key" placeholder="Key" style="width: 30%; margin-right: 10px" />
                <el-input v-model="item.value" type="textarea" :autosize="{ minRows: 2 }" placeholder="Value" style="width: 60%; margin-right: 10px" />
                <el-button icon="el-icon-delete" type="danger" circle @click="removeDataItem(index)" />
              </div>
              <el-button type="primary" plain icon="el-icon-plus" @click="addDataItem">添加字段</el-button>
            </el-form-item>
            <el-button type="text" @click="generateYamlFromForm">同步到 YAML 模式</el-button>
          </el-form>
        </el-tab-pane>

        <!-- YAML 模式 -->
        <el-tab-pane label="YAML 模式" name="yaml">
          <monaco-editor
            ref="createEditor"
            v-model="createYamlContent"
            language="yaml"
            theme="vs-dark"
            :options="createEditorOptions"
            style="height: 400px; border: 1px solid #dcdfe6; border-radius: 4px"
          />
          <el-button type="text" @click="parseYamlToForm">同步回表单模式</el-button>
        </el-tab-pane>
      </el-tabs>

      <span slot="footer" class="dialog-footer">
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="submitCreate">确定</el-button>
      </span>
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
      showCreateDialog: false,
      isEditMode: false, // true 表示编辑模式
      createTab: 'form', // 当前标签页
      createForm: {
        name: '',
        dataItems: [{ key: '', value: '' }]
      },
      createYamlContent: '',
      createEditorOptions: {
        readOnly: false,
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: 'on',
        folding: true,
        wordWrap: 'on'
      },
      isEdit: false,
      editingConfigMapName: ''
    }
  },
  computed: {
    ...mapGetters('dashboard', ['workspaces']),
    ...mapGetters('workspace', ['namespaces']),
    ...mapGetters('configmap', ['cm']),
    filteredNamespaces() {
      return this.namespaces.filter(ns =>
        ns.metadata.labels?.['kubeants.io/workspace'] === this.selectedWorkspace
      )
    },
    filteredConfigmaps() {
      if (!this.searchText) return this.cm
      return this.cm.filter(cm =>
        cm.metadata.name.includes(this.searchText)
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
    ...mapActions('configmap', ['getConfigmap', 'getConfigmapDetail', 'createConfigmap', 'deleteConfigmap']),

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
    },
    async handleDelete(row) {
      this.$confirm(`确认删除 ConfigMap [${row.metadata.name}]？`, '提示', { type: 'warning' }).then(async() => {
        await this.deleteConfigmap({ wsName: this.selectedWorkspace, nsName: this.selectedNamespace, cmName: row.metadata.name })
        this.fetchConfigmaps()
        this.$message.success('删除成功')
      })
    },
    async handleView(row) {
      if (!this.selectedWorkspace || !this.selectedNamespace || !row?.metadata?.name) {
        this.$message.error('当前工作空间或命名空间未选中，或数据不完整')
        return
      }
      try {
        const res = await this.getConfigmapDetail({
          wsName: this.selectedWorkspace,
          nsName: this.selectedNamespace,
          cmName: row.metadata.name
        })

        // 先打开 dialog，再赋值并刷新编辑器
        this.showYamlDialog = true

        // 等待 dialog 渲染完成
        this.$nextTick(() => {
          this.yamlContent = yaml.dump(res || {})
      this.$refs.viewEditor?.editor?.setValue(this.yamlContent) // 强制写入内容
      this.refreshMonacoEditor()
        })
      } catch (err) {
        console.error('获取 ConfigMap 详情失败', err)
        this.$message.error('获取详情失败')
      }
    },
    refreshMonacoEditor() {
      this.$nextTick(() => {
        this.$refs.viewEditor?.editor?.layout()
      })
    },
    refreshCreateEditor() {
      this.$nextTick(() => {
        this.$refs.createEditor?.editor?.layout()
      })
    },
    formatDate(dateStr) {
      if (!dateStr) return ''
      return new Date(dateStr).toLocaleString()
    },
    previewYaml() {
      const data = {}
      for (const item of this.createForm.dataItems) {
        if (item.key) {
          data[item.key] = item.value || ''
        }
      }
      const yamlContent = yaml.dump({
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: { name: this.createForm.name },
        data
      })
      this.$alert(`<pre>${yamlContent}</pre>`, 'ConfigMap YAML 预览', {
        dangerouslyUseHTMLString: true,
        customClass: 'yaml-preview-dialog',
        confirmButtonText: '关闭'
      })
    },
    openCreateDialog() {
      if (!this.selectedWorkspace || !this.selectedNamespace) {
        this.$message.warning('请先选择工作空间和命名空间')
        return
      }

      this.createForm = {
        name: '',
        dataItems: [{ key: '', value: '' }]
      }
      this.createTab = 'form'
      this.createYamlContent = this.getDefaultYamlTemplate()
      this.showCreateDialog = true
    },

    onCreateDialogOpened() {
      this.$nextTick(() => {
        if (this.createTab === 'yaml') {
      this.$refs.createEditor?.editor?.setValue(this.createYamlContent || this.getDefaultYamlTemplate())
        }
        this.refreshCreateEditor()
      })
    },

    getDefaultYamlTemplate() {
      return yaml.dump({
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: {
          name: '',
          namespace: this.selectedNamespace
        },
        data: {}
      })
    },

    generateYamlFromForm() {
      const data = {}
      for (const item of this.createForm.dataItems) {
        if (item.key) {
          data[item.key] = item.value || ''
        }
      }

      const yamlObject = {
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: {
          name: this.createForm.name || '',
          namespace: this.selectedNamespace
        },
        data
      }

      this.createYamlContent = yaml.dump(yamlObject)
      this.$refs.createEditor?.editor?.setValue(this.createYamlContent) // 🪄 关键补丁
      this.refreshCreateEditor()
      this.$message.success('已同步到 YAML 模式')
    },

    parseYamlToForm() {
      try {
        // 🟡 不能用 this.createYamlContent，改成直接从 Monaco Editor 取值
        const editorValue = this.$refs.createEditor?.editor?.getValue?.()
        const parsed = yaml.load(editorValue)

        if (!parsed || typeof parsed !== 'object') throw new Error('格式非法')

        this.createForm.name = parsed.metadata?.name || ''
        const dataItems = []
        for (const [key, value] of Object.entries(parsed.data || {})) {
          dataItems.push({ key, value })
        }
        this.createForm.dataItems = dataItems.length ? dataItems : [{ key: '', value: '' }]
        this.$message.success('已同步回表单模式')
      } catch (err) {
        this.$message.error('YAML 解析失败：' + err.message)
      }
    },

    addDataItem() {
      this.createForm.dataItems.push({ key: '', value: '' })
    },
    removeDataItem(index) {
      this.createForm.dataItems.splice(index, 1)
    },

    async submitCreate() {
      // 如果当前在表单模式，自动同步一次
      if (this.createTab === 'form') {
        this.generateYamlFromForm()
      }
      let configmap
      try {
        configmap = yaml.load(this.createYamlContent)
        if (!configmap?.metadata?.name) {
          this.$message.error('YAML 中缺少 metadata.name')
          return
        }
      } catch (err) {
        this.$message.error('YAML 格式错误：' + err.message)
        return
      }

      try {
        // await this.createConfigmap({
        //   wsName: this.selectedWorkspace,
        //   nsName: this.selectedNamespace,
        //   configmap
        // })

        if (this.isEdit) {
          await this.$store.dispatch('configmap/updateConfigmap', {
            wsName: this.selectedWorkspace,
            nsName: this.selectedNamespace,
            cmName: this.editingConfigMapName,
            configmap
          })
          this.$message.success('修改成功')
        } else {
          await this.createConfigmap({
            wsName: this.selectedWorkspace,
            nsName: this.selectedNamespace,
            configmap
          })
          this.$message.success('创建成功')
        }
        this.showCreateDialog = false
        this.fetchConfigmaps()

        // 之前的代码
        // this.$message.success('创建成功')
        // this.showCreateDialog = false
        // this.fetchConfigmaps()
      } catch (err) {
        const serverMessage = err?.response?.data?.msg || err?.response?.data?.message
        console.error('创建失败', serverMessage)
        this.$message.error('创建失败：' + (serverMessage || err.message || '未知错误'))
      }
    },
    handleTabClick(tab) {
      if (tab.name === 'yaml') {
        this.$nextTick(() => {
      // 强制更新 YAML 内容（防止为 // code）
      this.$refs.createEditor?.editor?.setValue(this.createYamlContent || this.getDefaultYamlTemplate())
      this.refreshCreateEditor()
        })
      }
    },
    handleEdit(row) {
      this.isEdit = true
      this.isEditMode = true
      this.editingConfigMapName = row.metadata.name
      this.createForm.name = row.metadata.name
      this.createForm.dataItems = Object.entries(row.data || {}).map(([key, value]) => ({ key, value }))
      this.createYamlContent = this.generateYaml(row)
      this.createTab = 'form'
      this.showCreateDialog = true
    },
    generateYaml(row) {
      return require('js-yaml').dump({
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: {
          name: row.metadata.name,
          namespace: row.metadata.namespace
        },
        data: row.data || {}
      })
    },
    async submitUpdate() {
      const configmap = require('js-yaml').load(this.createYamlContent)
      await this.$store.dispatch('configmap/updateConfigmap', {
        wsName: this.selectedWorkspace,
        nsName: this.selectedNamespace,
        configmap
      })
      this.$message.success('修改成功')
      this.showCreateDialog = false
      this.fetchConfigmaps()
    }
  }
}
</script>

<style scoped>
.configmap-page {
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

.configmap-page {
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
