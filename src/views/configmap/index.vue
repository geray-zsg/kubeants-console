<template>
  <div class="configmap-page">
    <!-- 顶部筛选器 -->
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
      <el-button type="primary" icon="el-icon-plus" style="margin-left: auto" @click="showCreateDialog = true">
        新建配置字典
      </el-button>
    </div>

    <!-- ConfigMap 表格 -->
    <el-table :data="filteredConfigmaps" border style="width: 100%">
      <el-table-column prop="metadata.name" label="名称" width="200" />

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

      <el-table-column prop="metadata.namespace" label="命名空间" width="160" />

      <el-table-column prop="metadata.creationTimestamp" label="创建时间" width="180">
        <template v-slot="{ row }">
          {{ formatDate(row.metadata.creationTimestamp) }}
        </template>
      </el-table-column>

      <el-table-column label="操作" width="140">
        <template v-slot="{ row }">
          <el-button type="text" size="small" :disabled="!selectedWorkspace || !selectedNamespace" @click="handleView(row)">详情</el-button>
          <el-button type="text" size="small" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- YAML 详情对话框 -->
    <el-dialog :visible.sync="showYamlDialog" title="ConfigMap YAML 详情" width="60%">
      <el-input v-model="yamlContent" type="textarea" :rows="20" readonly style="font-family: monospace" />
    </el-dialog>

    <!-- 创建 ConfigMap 对话框 -->
    <el-dialog title="创建 ConfigMap" :visible.sync="showCreateDialog" width="60%">
      <el-tabs v-model="createTab" @tab-click="handleTabSwitch">
        <el-tab-pane label="表单模式" name="form">
          <el-form ref="form" :model="newConfigmap" label-width="100px">
            <el-form-item
              label="名称"
              prop="metadata.name"
              :rules="[
                { required: true, message: '名称不能为空' },
                { pattern: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/, message: '仅小写字母、数字、-，不能以 - 开头/结尾' }
              ]"
            >
              <el-input v-model="newConfigmap.metadata.name" />
            </el-form-item>
            <el-form-item label="字段">
              <div v-for="(item, index) in formFields" :key="index" style="margin-bottom: 8px; display: flex">
                <el-input v-model.trim="item.key" placeholder="Key (不能含空格)" style="width: 40%; margin-right: 10px" />
                <el-input
                  v-model="item.value"
                  type="textarea"
                  :rows="3"
                  placeholder="支持 YAML/JSON 多行格式"
                  style="width: 50%; margin-right: 10px"
                />
                <el-button type="danger" icon="el-icon-delete" circle @click="formFields.splice(index, 1)" />
              </div>
              <el-button type="primary" plain icon="el-icon-plus" @click="formFields.push({ key: '', value: '' })">添加字段</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="YAML 模式" name="yaml">
          <monaco-editor
            v-model="yamlInput"
            language="yaml"
            theme="vs-dark"
            height="400"
          />
        </el-tab-pane>
      </el-tabs>

      <div slot="footer">
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="handleCreate">创建</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'
import yaml from 'js-yaml'

export default {
  data() {
    return {
      selectedWorkspace: '',
      selectedNamespace: '',
      searchText: '',
      showYamlDialog: false,
      cmDetail: null,
      yamlContent: '',
      showCreateDialog: false,
      createTab: 'form',
      formFields: [{ key: '', value: '' }],
      yamlInput: '',
      newConfigmap: {
        metadata: { name: '' },
        data: {}
      }
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
    ...mapActions('configmap', ['getConfigmap', 'deleteConfigmap', 'getConfigmapDetail', 'createConfigmap']),

    handleTabSwitch(tab) {
      if (tab.name === 'yaml' && !this.yamlInput.trim()) {
        this.yamlInput = yaml.dump({
          apiVersion: 'v1',
          kind: 'ConfigMap',
          metadata: {
            name: '',
            namespace: this.selectedNamespace || '',
            labels: {}
          },
          data: {}
        })
      }

      if (tab.name === 'yaml' && this.createTab === 'form') {
        const data = {}
        this.formFields.forEach(f => {
          if (f.key) data[f.key] = f.value
        })
        const payload = {
          apiVersion: 'v1',
          kind: 'ConfigMap',
          metadata: {
            name: this.newConfigmap.metadata.name,
            namespace: this.selectedNamespace,
            labels: {}
          },
          data
        }
        this.yamlInput = yaml.dump(payload)
      }

      if (tab.name === 'form' && this.createTab === 'yaml') {
        try {
          const parsed = yaml.load(this.yamlInput)
          this.newConfigmap.metadata.name = parsed.metadata?.name || ''
          this.formFields = Object.entries(parsed.data || {}).map(([k, v]) => ({ key: k, value: v }))
        } catch (e) {
          this.$message.error('YAML 格式不合法，无法转为表单')
        }
      }

      this.createTab = tab.name
    },

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
        this.$message.success('删除成功')
        this.fetchConfigmaps()
      })
    },

    async handleView(row) {
      if (!this.selectedWorkspace || !this.selectedNamespace || !row?.metadata?.name) {
        this.$message.error('当前工作空间或命名空间未选中，或数据不完整')
        return
      }
      this.getConfigmapDetail({
        wsName: this.selectedWorkspace,
        nsName: this.selectedNamespace,
        cmName: row.metadata.name
      }).then(res => {
        this.yamlContent = yaml.dump(res)
        this.showYamlDialog = true
      }).catch(err => {
        console.error('获取 ConfigMap 详情失败', err)
        this.$message.error('获取详情失败')
      })
    },

    async handleCreate() {
      this.$refs.form?.validate(async valid => {
        if (!valid && this.createTab === 'form') return

        let payload = {}

        if (this.createTab === 'form') {
          const data = {}
          this.formFields.forEach(f => {
            if (f.key) data[f.key] = f.value
          })

          payload = {
            apiVersion: 'v1',
            kind: 'ConfigMap',
            metadata: {
              name: this.newConfigmap.metadata.name,
              namespace: this.selectedNamespace
            },
            data
          }
        } else {
          try {
            payload = yaml.load(this.yamlInput)
          } catch (err) {
            this.$message.error('YAML 解析失败，请检查格式')
            return
          }
        }

        try {
          await this.createConfigmap({
            wsName: this.selectedWorkspace,
            nsName: this.selectedNamespace,
            configmap: payload
          })
          this.$message.success('创建成功')
          this.showCreateDialog = false
          this.fetchConfigmaps()
        } catch (err) {
          console.error('创建失败:', err)
          this.$message.error('创建失败')
        }
      })
    },

    formatDate(dateStr) {
      if (!dateStr) return ''
      return new Date(dateStr).toLocaleString()
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
</style>
