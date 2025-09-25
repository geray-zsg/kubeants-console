<template>
  <div class="secret-page">
    <!-- 顶部筛选和创建按钮 -->
    <div class="filters">
      <span class="filter-label">工作空间：</span>
      <el-select v-model="selectedWorkspace" placeholder="选择 Workspace" @change="onWorkspaceChange">
        <el-option v-for="ws in workspaces" :key="ws.name" :label="ws.name" :value="ws.name" />
      </el-select>

      <span class="filter-label">命名空间：</span>
      <el-select v-model="selectedNamespace" placeholder="选择 Namespace" style="margin-left: 10px" @change="fetchSecrets">
        <el-option v-for="ns in filteredNamespaces" :key="ns.metadata.name" :label="ns.metadata.name" :value="ns.metadata.name" />
      </el-select>

      <el-input
        v-model="searchText"
        placeholder="搜索保密字典"
        style="margin-left: 20px; width: 300px"
        clearable
      />

      <el-button v-if="canCreateButton" type="primary" style="margin-left: auto" @click="openCreateDialog">
        创建保密字典
      </el-button>
    </div>

    <!-- Secrets 表格 -->
    <div class="table-container">
      <el-table
        v-loading="loading"
        :data="filteredSecrets"
        border
        style="width: 100%; overflow: auto"
      >
        <el-table-column prop="metadata.name" label="名称" width="200" fixed="left" />
        <el-table-column prop="type" label="类型" width="150" />
        <el-table-column label="字段名列表" min-width="300">
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
        <el-table-column prop="metadata.namespace" label="命名空间" width="150" />
        <el-table-column prop="metadata.creationTimestamp" label="创建时间" width="180">
          <template v-slot="{ row }">
            {{ formatDate(row.metadata.creationTimestamp) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="220" align="center">
          <template v-slot="{ row }">
            <div class="action-buttons">
              <el-button size="small" @click="handleView(row)">详情</el-button>
              <el-button v-if="canEditButton" size="small" type="primary" @click="handleEdit(row)">编辑</el-button>
              <el-button v-if="canDeleteButton" size="small" type="danger" @click="handleDelete(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无保密字典数据" />
        </template>
      </el-table>
    </div>

    <!-- YAML + 表单 详情对话框 -->
    <el-dialog :visible.sync="showYamlDialog" title="保密字典详情" width="70%" @opened="refreshMonacoEditor">
      <el-tabs v-model="viewTab">
        <el-tab-pane v-if="secretDetail && secretDetail.metadata" label="表单模式" name="form">
          <el-form label-width="100px">
            <el-form-item label="名称">
              <el-input :value="secretDetail.metadata.name" disabled />
            </el-form-item>
            <el-form-item label="命名空间">
              <el-input :value="secretDetail.metadata.namespace" disabled />
            </el-form-item>
            <el-form-item label="类型">
              <el-input :value="secretDetail.type" disabled />
            </el-form-item>
            <el-form-item label="数据内容">
              <div v-for="(v, k) in secretDetail.data" :key="k" style="margin-bottom: 10px">
                <el-row>
                  <el-col :span="4"><strong>{{ k }}</strong></el-col>
                  <el-col :span="16">
                    <el-input
                      :type="showFields[k] ? 'textarea' : 'password'"
                      :value="decodeBase64(v)"
                      readonly
                      :autosize="{ minRows: 1, maxRows: 10 }"
                    />
                  </el-col>
                  <el-col :span="4">
                    <el-button icon="el-icon-view" @click="toggleField(k)" />
                  </el-col>
                </el-row>
              </div>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="YAML" name="yaml">
          <div style="height: 400px; border: 1px solid #dcdfe6; border-radius: 4px">
            <monaco-editor
              ref="viewEditor"
              v-model="yamlContent"
              language="yaml"
              theme="vs-dark"
              :options="detailEditorOptions"
            />
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-dialog>

    <!-- 创建 Secret 对话框 -->
    <el-dialog
      :title="isEditMode ? '编辑保密字典' : '创建保密字典'"
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

            <el-form-item label="类型">
              <el-select v-model="createForm.type" placeholder="请选择类型" @change="onSecretTypeChange">
                <el-option v-for="item in secretTypes" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>

            <!-- 通用型字段 -->
            <el-form-item v-if="createForm.type !== 'kubernetes.io/dockerconfigjson'" label="数据内容">
              <div v-for="(item, index) in createForm.dataItems" :key="index" class="kv-pair">
                <el-input v-model="item.key" placeholder="Key" style="width: 30%; margin-right: 10px" />
                <el-input
                  v-model="item.value"
                  type="textarea"
                  :autosize="{ minRows: 2 }"
                  placeholder="Value"
                  style="width: 60%; margin-right: 10px"
                />
                <el-button icon="el-icon-delete" type="danger" circle @click="removeDataItem(index)" />
              </div>
              <el-button type="primary" plain icon="el-icon-plus" @click="addDataItem">添加字段</el-button>
            </el-form-item>

            <!-- Docker 配置字段 -->
            <template v-if="createForm.type === 'kubernetes.io/dockerconfigjson'">
              <el-form-item label="协议">
                <el-select v-model="dockerForm.protocol" placeholder="请选择协议">
                  <el-option label="https" value="https" />
                  <el-option label="http" value="http" />
                </el-select>
              </el-form-item>
              <el-form-item label="仓库地址">
                <el-input v-model="dockerForm.registry" placeholder="如 registry.cn-hangzhou.aliyuncs.com" />
              </el-form-item>
              <el-form-item label="用户名">
                <el-input v-model="dockerForm.username" placeholder="请输入用户名" />
              </el-form-item>
              <el-form-item label="密码">
                <el-input v-model="dockerForm.password" type="password" placeholder="请输入密码" />
              </el-form-item>
              <el-form-item label="邮箱">
                <el-input v-model="dockerForm.email" placeholder="可选，邮箱地址" />
              </el-form-item>
            </template>

            <el-button type="text" @click="generateYamlFromForm(true)">同步到 YAML 模式</el-button>
          </el-form>
        </el-tab-pane>

        <!-- YAML 模式 -->
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

      <span slot="footer" class="dialog-footer">
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="submitCreate">确定</el-button>
      </span>
    </el-dialog>

  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'
import { hasPermission } from '@/utils/permission'
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
      viewTab: 'yaml',
      secretDetail: {},
      showFields: {},
      loading: false,
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
      createTab: 'form',
      createForm: {
        name: '',
        type: 'Opaque',
        dataItems: [{ key: '', value: '' }]
      },
      createYamlContent: '',
      secretTypes: [
        { label: '通用型（Opaque）', value: 'Opaque' },
        { label: 'Docker 配置 JSON（kubernetes.io/dockerconfigjson）', value: 'kubernetes.io/dockerconfigjson' },
        { label: '基本认证（kubernetes.io/basic-auth）', value: 'kubernetes.io/basic-auth' },
        { label: 'SSH 密钥（kubernetes.io/ssh-auth）', value: 'kubernetes.io/ssh-auth' },
        { label: 'TLS 证书（kubernetes.io/tls）', value: 'kubernetes.io/tls' },
        { label: 'Bootstrap Token（bootstrap.kubernetes.io/token）', value: 'bootstrap.kubernetes.io/token' }
      ],
      secretTemplates: {
        Opaque: [{ key: '', value: '' }],
        'kubernetes.io/dockerconfigjson': [{ key: '.dockerconfigjson', value: '' }],
        'kubernetes.io/basic-auth': [
          { key: 'username', value: '' },
          { key: 'password', value: '' }
        ],
        'kubernetes.io/ssh-auth': [{ key: 'ssh-privatekey', value: '' }],
        'kubernetes.io/tls': [
          { key: 'tls.crt', value: '' },
          { key: 'tls.key', value: '' }
        ],
        'bootstrap.kubernetes.io/token': [
          { key: 'token-id', value: '' },
          { key: 'token-secret', value: '' }
        ]
      },
      dockerForm: {
        protocol: 'https',
        registry: '',
        username: '',
        password: '',
        email: ''
      }
    }
  },
  computed: {
    ...mapGetters('dashboard', ['workspaces']),
    ...mapGetters('workspace', ['namespaces']),
    ...mapGetters('secrets', ['secrets']),
    ...mapGetters('user', ['userBindings']),
    canCreateButton() {
      return hasPermission(this.userBindings, {
        wsName: this.selectedWorkspace,
        nsName: this.selectedNamespace,
        action: 'create'
      })
    },
    canDeleteButton() {
      return hasPermission(this.userBindings, {
        wsName: this.selectedWorkspace,
        nsName: this.selectedNamespace,
        action: 'delete'
      })
    },
    canEditButton() {
      return hasPermission(this.userBindings, {
        wsName: this.selectedWorkspace,
        nsName: this.selectedNamespace,
        action: 'edit'
      })
    },
    filteredNamespaces() {
      return this.namespaces.filter(ns =>
        ns.metadata.labels?.['kubeants.io/workspace'] === this.selectedWorkspace
      )
    },
    filteredSecrets() {
      if (!this.secrets) return []
      if (!this.searchText) return this.secrets
      return this.secrets.filter(secret =>
        secret.metadata.name.includes(this.searchText)
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
    ...mapActions('secrets', ['getSecrets', 'getSecretDetail', 'createSecret', 'deleteSecret', 'updateSecret']),

    async onWorkspaceChange() {
      this.selectedNamespace = ''
      await this.getNamespaces(this.selectedWorkspace)
      const filtered = this.filteredNamespaces
      if (filtered.length > 0) {
        this.selectedNamespace = filtered[0].metadata.name
        this.fetchSecrets()
      }
    },
    async fetchSecrets() {
      if (!this.selectedWorkspace || !this.selectedNamespace) return
      this.loading = true
      try {
        await this.getSecrets({ wsName: this.selectedWorkspace, nsName: this.selectedNamespace })
      } catch (error) {
        console.error('获取Secrets失败:', error)
      } finally {
        this.loading = false
      }
    },
    async handleDelete(row) {
      this.$confirm(`确认删除secret [${row.metadata.name}]？`, '提示', { type: 'warning' }).then(async() => {
        try {
          await this.deleteSecret({ wsName: this.selectedWorkspace, nsName: this.selectedNamespace, secretName: row.metadata.name })
          this.fetchSecrets()
          this.$message.success('删除成功')
        } catch (error) {
          this.$message.error('删除失败: ' + (error.response?.data?.msg || error.message))
        }
      })
    },
    async handleView(row) {
      if (!this.selectedWorkspace || !this.selectedNamespace || !row?.metadata?.name) {
        this.$message.error('当前工作空间或命名空间未选中，或数据不完整')
        return
      }
      try {
        const res = await this.getSecretDetail({
          wsName: this.selectedWorkspace,
          nsName: this.selectedNamespace,
          secretName: row.metadata.name
        })
        this.secretDetail = res
        this.showYamlDialog = true
        this.$nextTick(() => {
          this.yamlContent = yaml.dump(res || {})
          this.$refs.viewEditor?.editor?.setValue(this.yamlContent)
          this.refreshMonacoEditor()
        })
      } catch (err) {
        console.error('获取 secrets 详情失败', err)
        this.$message.error('获取详情失败')
      }
    },
    refreshMonacoEditor() {
      this.$nextTick(() => {
        this.$refs.viewEditor?.editor?.layout()
      })
    },
    decodeBase64(str) {
      try {
        return atob(str)
      } catch {
        return '[base64 解码失败]'
      }
    },
    toggleField(key) {
      this.$set(this.showFields, key, !this.showFields[key])
    },
    formatDate(dateStr) {
      if (!dateStr) return ''
      return new Date(dateStr).toLocaleString()
    },
    onSecretTypeChange(type) {
      // 获取模板
      const template = this.secretTemplates[type] || [{ key: '', value: '' }]
      // 深拷贝初始化字段
      this.createForm.dataItems = JSON.parse(JSON.stringify(template))
    },
    openCreateDialog() {
      if (!this.selectedWorkspace || !this.selectedNamespace) {
        this.$message.warning('请先选择工作空间和命名空间')
        return
      }

      this.isEditMode = false
      this.createTab = 'form'

      // 重置表单内容
      this.createForm = {
        name: '',
        type: 'Opaque',
        dataItems: [{ key: '', value: '' }]
      }
      this.dockerForm = {
        protocol: 'https',
        registry: '',
        username: '',
        password: '',
        email: ''
      }

      // 生成 YAML 模板
      this.generateYamlFromForm()

      // 最后显示弹窗（避免 monaco 触发时机错误）
      this.showCreateDialog = true
    },

    getDefaultYamlTemplate() {
      return yaml.dump({
        apiVersion: 'v1',
        kind: 'Secret',
        type: 'Opaque',
        metadata: {
          name: '',
          namespace: this.selectedNamespace
        },
        data: {}
      })
    },

    addDataItem() {
      this.createForm.dataItems.push({ key: '', value: '' })
    },

    removeDataItem(index) {
      this.createForm.dataItems.splice(index, 1)
    },

    generateYamlFromForm(showMessage = false) {
      const data = {}
      const type = this.createForm.type

      if (type === 'kubernetes.io/dockerconfigjson') {
        const { protocol, registry, username, password, email } = this.dockerForm
        if (!registry || !username || !password) {
          if (showMessage) this.$message.error('Docker 凭据缺少必要字段')
          return
        }

        const auth = btoa(`${username}:${password}`)
        const json = {
          auths: {
            [`${protocol}://${registry}`]: {
              username,
              password,
              email,
              auth
            }
          }
        }

        data['.dockerconfigjson'] = btoa(JSON.stringify(json))
      } else {
        for (const item of this.createForm.dataItems) {
          if (item.key) {
            data[item.key] = btoa(item.value || '')
          }
        }
      }

      const yamlObject = {
        apiVersion: 'v1',
        kind: 'Secret',
        metadata: {
          name: this.createForm.name || '',
          namespace: this.selectedNamespace
        },
        type,
        data
      }

      this.createYamlContent = yaml.dump(yamlObject)
      this.$refs.createEditor?.editor?.setValue(this.createYamlContent)

      if (showMessage) {
        this.$message.success('已同步到 YAML 模式')
      }
    },

    parseYamlToForm() {
      try {
        const editorValue = this.$refs.createEditor?.editor?.getValue?.()
        const parsed = yaml.load(editorValue)

        if (!parsed || typeof parsed !== 'object') throw new Error('格式非法')

        this.createForm.name = parsed.metadata?.name || ''
        this.createForm.type = parsed.type || 'Opaque'

        const dataItems = []
        for (const [key, value] of Object.entries(parsed.data || {})) {
          dataItems.push({ key, value: atob(value || '') })
        }
        this.createForm.dataItems = dataItems.length ? dataItems : [{ key: '', value: '' }]
        this.$message.success('已同步回表单模式')
      } catch (err) {
        this.$message.error('YAML 解析失败：' + err.message)
      }
    },

    onCreateDialogOpened() {
      this.$nextTick(() => {
        if (this.createTab === 'yaml') {
          this.$refs.createEditor?.editor?.setValue(this.createYamlContent || this.getDefaultYamlTemplate())
          this.refreshMonacoEditor()
        }
      })
    },

    handleTabClick(tab) {
      if (tab.name === 'yaml') {
        this.$nextTick(() => {
          this.$refs.createEditor?.editor?.setValue(this.createYamlContent || this.getDefaultYamlTemplate())
          this.refreshMonacoEditor()
        })
      }
    },

    async submitCreate() {
      // 自动同步一次，无提示
      this.generateYamlFromForm(false)

      let secret
      try {
        secret = yaml.load(this.createYamlContent)
        if (!secret?.metadata?.name) {
          this.$message.error('YAML 中缺少 metadata.name')
          return
        }
      } catch (err) {
        this.$message.error('YAML 格式错误：' + err.message)
        return
      }

      try {
        if (this.isEditMode) {
          await this.updateSecret({
            wsName: this.selectedWorkspace,
            nsName: this.selectedNamespace,
            secretName: secret.metadata.name, // 确保传入 secretName
            secret
          })
          this.$message.success('更新成功')
        } else {
          await this.createSecret({
            wsName: this.selectedWorkspace,
            nsName: this.selectedNamespace,
            secret
          })
          this.$message.success('创建成功')
        }
        this.showCreateDialog = false
        this.fetchSecrets()
      } catch (err) {
        console.error(this.isEditMode ? '更新失败' : '创建失败', err)
        this.$message.error((this.isEditMode ? '更新失败' : '创建失败') + '：' + (err.message || '未知错误'))
      }
    },

    async handleEdit(row) {
      try {
        const res = await this.getSecretDetail({
          wsName: this.selectedWorkspace,
          nsName: this.selectedNamespace,
          secretName: row.metadata.name
        })

        this.isEditMode = true
        this.createForm.name = res.metadata.name
        this.createForm.type = res.type || 'Opaque'
        this.createForm.dataItems = Object.entries(res.data || {}).map(([k, v]) => ({
          key: k,
          value: this.decodeBase64(v)
        }))

        // 解析 Docker 类型为表单
        if (res.type === 'kubernetes.io/dockerconfigjson' && res.data['.dockerconfigjson']) {
          try {
            const decoded = atob(res.data['.dockerconfigjson'])
            const json = JSON.parse(decoded)
            const authData = json.auths?.[Object.keys(json.auths)[0]] || {}
            const url = Object.keys(json.auths)[0] || ''
            const [protocol, registry] = url.split('://')
            this.dockerForm = {
              protocol: protocol || 'https',
              registry: registry || '',
              username: authData.username || '',
              password: authData.password || '',
              email: authData.email || ''
            }
          } catch (err) {
            console.warn('Docker JSON解析失败', err)
          }
        }

        this.createYamlContent = yaml.dump(res)
        this.createTab = 'form'
        this.showCreateDialog = true
      } catch (err) {
        console.error('获取编辑数据失败', err)
        this.$message.error('获取数据失败')
      }
    }

  }
}
</script>

<style scoped>
.secret-page {
  padding: 20px;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 100px);
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

.table-container {
  flex: 1;
  overflow: auto;
}

.action-buttons {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.dialog-footer {
  text-align: right;
}

.kv-pair {
  display: flex;
  margin-bottom: 10px;
  align-items: flex-start;
}
</style>
