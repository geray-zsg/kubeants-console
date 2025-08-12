<template>
  <div class="sts-page">
    <!-- 筛选区 -->
    <div class="filters">
      <span class="filter-label">工作空间：</span>
      <el-select v-model="selectedWorkspace" placeholder="选择工作空间" @change="onWorkspaceChange">
        <el-option v-for="ws in workspaces" :key="ws.name" :label="ws.name" :value="ws.name" />
      </el-select>

      <span class="filter-label">命名空间：</span>
      <el-select v-model="selectedNamespace" placeholder="选择命名空间" style="margin-left: 10px" @change="fetchStatefulSets">
        <el-option
          v-for="ns in filteredNamespaces"
          :key="ns.metadata.name"
          :label="ns.metadata.name"
          :value="ns.metadata.name"
        />
      </el-select>

      <el-input
        v-model="searchText"
        placeholder="搜索有状态服务"
        style="margin-left: 20px; width: 300px"
        clearable
      />

      <el-button type="primary" style="margin-left: auto" @click="openCreateDialog">
        创建有状态服务
      </el-button>
    </div>

    <!-- 操作栏 -->
    <div class="actions">
      <el-button
        type="danger"
        size="mini"
        :disabled="selectedSts.length === 0"
        @click="handleBatchDelete"
      >
        批量删除
      </el-button>
    </div>

    <!-- 表格 -->
    <div class="table-container">
      <el-table v-loading="loading" :data="pagedStatefulSets" border style="flex: 1; overflow: auto" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" />
        <el-table-column prop="metadata.name" label="名称" width="300" />
        <el-table-column prop="metadata.name" label="状态" width="300" />
        <el-table-column prop="status.replicas" label="副本数" width="100" />
        <el-table-column prop="metadata.creationTimestamp" label="创建时间" width="180">
          <template v-slot="{ row }">
            {{ formatDate(row.metadata.creationTimestamp) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="350" align="center">
          <template v-slot="{ row }">
            <div class="action-buttons">
              <el-button size="small" text @click="handleView(row)">详情</el-button>
              <el-button size="small" type="primary" @click="handleEdit(row)">编辑</el-button>
              <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无有状态服务数据" />
        </template>
      </el-table>

      <!-- 分页 -->
      <el-pagination
        background
        layout="total, sizes, prev, pager, next"
        :current-page="currentPage"
        :page-sizes="[10, 20, 50, 100]"
        :page-size="pageSize"
        :total="filteredSts.length"
        style="margin-top: 16px; text-align: right"
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </div>

    <!-- 详情弹窗 -->
    <el-dialog title="有状态服务详情" :visible.sync="showYamlDialog" width="70%" @opened="refreshMonacoEditor">
      <div style="height: 400px; border: 1px solid #dcdfe6; border-radius: 4px">
        <monaco-editor ref="yamlViewer" v-model="yamlContent" language="yaml" theme="vs-dark" :options="detailEditorOptions" />
      </div>
    </el-dialog>
    <!-- 创建弹窗 -->
    <el-dialog title="创建 StatefulSet" :visible.sync="createDialogVisible" width="60%">
      <el-tabs v-model="createTab">
        <el-tab-pane label="表单" name="form">
          <el-form v-if="createTab === 'form'" :model="createForm" label-width="100px">
            <el-form-item label="名称">
              <el-input v-model="createForm.metadata.name" />
            </el-form-item>
            <el-form-item label="副本数">
              <el-input-number v-model="createForm.spec.replicas" :min="1" />
            </el-form-item>
            <el-form-item label="镜像">
              <el-input v-model="createForm.spec.template.spec.containers[0].image" />
            </el-form-item>
          </el-form>

        </el-tab-pane>
        <el-tab-pane label="YAML" name="yaml">
          <div v-if="createTab === 'yaml'">
            <monaco-editor v-model="createYamlContent" language="yaml" height="400" />
          </div>
        </el-tab-pane>
      </el-tabs>

      <span slot="footer" class="dialog-footer">
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCreate">创建</el-button>
      </span>
    </el-dialog>

  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'
import MonacoEditor from 'vue-monaco-editor'
import yaml from 'js-yaml'
import { joinShellArgs, splitShellArgs, normalizeMountType } from '@/utils/shellArgUtils'
import { safeParseForm } from '@/utils/stsParser'
export default {
  components: { MonacoEditor },
  data() {
    return {
      selectedWorkspace: '',
      selectedNamespace: '',
      searchText: '',
      loading: false,
      selectedSts: [],
      pageSize: 10,
      currentPage: 1,
      showYamlDialog: false,
      yamlContent: '',
      detailEditorOptions: {
        readOnly: false,
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: 'on'
      },
      createTab: 'form',
      createYamlContent: '', // YAML 字符串
      createDialogVisible: false,
      createForm: {
        metadata: { name: '' },
        spec: {
          replicas: 1,
          selector: {
            matchLabels: { app: '' }
          },
          serviceName: '',
          template: {
            metadata: {
              labels: { app: '' }
            },
            spec: {
              containers: [{
                name: 'main',
                image: ''
              }]
            }
          }
        }
      }
    }
  },
  computed: {
    ...mapGetters('dashboard', ['workspaces']),
    ...mapGetters('workspace', ['namespaces']),
    ...mapGetters('statefulsets', ['statefulsets']),
    filteredNamespaces() {
      return this.namespaces.filter(
        ns => ns.metadata.labels?.['kubeants.io/workspace'] === this.selectedWorkspace
      )
    },
    filteredSts() {
      return this.searchText
        ? this.statefulsets.filter(s => s.metadata.name.includes(this.searchText))
        : this.statefulsets
    },
    pagedStatefulSets() {
      const start = (this.currentPage - 1) * this.pageSize
      return this.filteredSts.slice(start, start + this.pageSize)
    }
  },
  watch: {
    createTab(newVal) {
      if (newVal === 'yaml') {
        this.generateYamlFromForm()
      } else if (newVal === 'form') {
        try {
          const parsed = yaml.load(this.createYamlContent)
          this.createForm = safeParseForm(parsed)
        } catch (err) {
          this.$message.error('YAML 格式错误，无法解析到表单')
          this.createTab = 'yaml'
        }
      }
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
    ...mapActions('statefulsets', [
      'getStatefulsets',
      'getStatefulsetsDetail',
      'deleteStatefulsets',
      'createStatefulsets'
    ]),
    async onWorkspaceChange() {
      this.selectedNamespace = ''
      await this.getNamespaces(this.selectedWorkspace)
      const filtered = this.filteredNamespaces
      if (filtered.length > 0) {
        this.selectedNamespace = filtered[0].metadata.name
        this.fetchStatefulSets()
      }
    },
    async fetchStatefulSets() {
      if (!this.selectedWorkspace || !this.selectedNamespace) return
      this.loading = true
      try {
        await this.getStatefulsets({
          wsName: this.selectedWorkspace,
          nsName: this.selectedNamespace
        })
      } finally {
        this.loading = false
      }
    },
    handleSelectionChange(val) {
      this.selectedSts = val
    },
    handlePageChange(page) {
      this.currentPage = page
    },
    handleSizeChange(size) {
      this.pageSize = size
      this.currentPage = 1
    },
    formatDate(dateStr) {
      return dateStr ? new Date(dateStr).toLocaleString() : '-'
    },
    async handleDelete(row) {
      this.$confirm(`确认删除 StatefulSet [${row.metadata.name}]？`, '提示', { type: 'warning' })
        .then(async() => {
          await this.deleteStatefulsets({
            wsName: this.selectedWorkspace,
            nsName: this.selectedNamespace,
            stsName: row.metadata.name
          })
          this.$message.success('删除成功')
          this.fetchStatefulSets()
        })
    },
    async handleBatchDelete() {
      if (this.selectedSts.length === 0) return
      this.$confirm(`确认删除选中的 ${this.selectedSts.length} 个 StatefulSet？`, '提示', { type: 'warning' })
        .then(async() => {
          const tasks = this.selectedSts.map(item =>
            this.deleteStatefulsets({
              wsName: this.selectedWorkspace,
              nsName: this.selectedNamespace,
              stsName: item.metadata.name
            })
          )
          await Promise.all(tasks)
          this.$message.success('批量删除成功')
          this.fetchStatefulSets()
        })
    },
    async handleView(row) {
      const res = await this.getStatefulsetsDetail({
        wsName: this.selectedWorkspace,
        nsName: this.selectedNamespace,
        stsName: row.metadata.name
      })
      this.yamlContent = yaml.dump(res)
      this.showYamlDialog = true
      this.$nextTick(() => {
        this.$refs.yamlViewer?.editor?.setValue(this.yamlContent)
        this.refreshMonacoEditor()
      })
    },
    refreshMonacoEditor() {
      this.$nextTick(() => {
        this.$refs.yamlViewer?.editor?.layout()
      })
    },
    openCreateDialog() {
      this.createForm = {
        metadata: { name: '' },
        spec: {
          replicas: 1,
          selector: { matchLabels: { app: '' }},
          serviceName: '',
          template: {
            metadata: { labels: { app: '' }},
            spec: {
              containers: [{ name: 'main', image: '' }]
            }
          }
        }
      }
      this.createDialogVisible = true
      this.createTab = 'form'
      this.generateYamlFromForm() // 预生成 YAML
    },
    async submitCreate() {
      let finalObj
      if (this.createTab === 'yaml') {
        try {
          finalObj = yaml.load(this.createYamlContent)
        } catch (err) {
          this.$message.error('YAML格式错误: ' + err.message)
          return
        }
      } else {
        finalObj = this.createForm
      }

      const { name } = finalObj.metadata
      finalObj.spec.selector.matchLabels.app = name
      finalObj.spec.template.metadata.labels.app = name
      finalObj.spec.serviceName = name

      try {
        await this.$store.dispatch('statefulsets/createStatefulsets', {
          wsName: this.selectedWorkspace,
          nsName: this.selectedNamespace,
          stsName: name,
          sts: finalObj
        })
        this.$message.success('创建成功')
        this.createDialogVisible = false
        this.fetchStatefulSets()
      } catch (err) {
        console.error(err)
        this.$message.error('创建失败')
      }
    },
    generateYamlFromForm() {
      if (this.isYamlModified) {
        console.warn('跳过 YAML 同步：用户改动了 YAML 不应覆盖')
        return
      }
      const appName = this.createForm.metadata.name
      const volumes = []

      const addResourceUnit = (value, type) => {
        if (!value || typeof value !== 'string') return undefined
        if (type === 'cpu') {
          return value.match(/m$/) ? value : `${value}m`
        } else if (type === 'memory') {
          return value.match(/(Mi|Gi)$/) ? value : `${value}Mi`
        }
        return value
      }

      const processContainer = (container) => {
        const clean = { ...container }
        delete clean.id
        delete clean.type

        clean.command = splitShellArgs(container.command)
        clean.args = splitShellArgs(container.args)

        clean.resources = {
          requests: {
            cpu: addResourceUnit(container.resources?.requests?.cpu, 'cpu'),
            memory: addResourceUnit(container.resources?.requests?.memory, 'memory')
          },
          limits: {
            cpu: addResourceUnit(container.resources?.limits?.cpu, 'cpu'),
            memory: addResourceUnit(container.resources?.limits?.memory, 'memory')
          }
        }

        clean.ports = (container.ports || [])
          .filter(p => p.containerPort)
          .map(p => {
            const portObj = {
              containerPort: p.containerPort,
              protocol: p.protocol || 'TCP'
            }
            if (p.name) portObj.name = p.name
            if (p.hostPort) portObj.hostPort = p.hostPort
            return portObj
          })

        if (clean.ports.length === 0) delete clean.ports

        // 处理挂载卷
        if (Array.isArray(container.volumeMounts)) {
          clean.volumeMounts = []

          container.volumeMounts.forEach(m => {
            const volumeName = `${normalizeMountType(m.mountType)}-${m.pvcName || m.configMapName || m.secretName}`

            // 添加到 volumes 列表（避免重复）
            if (!volumes.find(v => v.name === volumeName)) {
              const volume = { name: volumeName }

              if (m.mountType === 'pvc') {
                volume.persistentVolumeClaim = { claimName: m.pvcName }
              } else if (m.mountType === 'configMap') {
                volume.configMap = {
                  name: m.configMapName
                }
              } else if (m.mountType === 'secret') {
                volume.secret = {
                  secretName: m.secretName
                }
              }

              volumes.push(volume)
            }

            // 区分整卷挂载 vs 精细挂载
            const vm = {
              name: volumeName,
              mountPath: m.mountPath,
              readOnly: m.readOnly
            }

            // 精细挂载：ConfigMap/Secret 且 key 存在
            if ((m.mountType === 'configMap' || m.mountType === 'secret') && m.key) {
              vm.subPath = m.subPath || m.key // 默认子路径使用 key
            }

            clean.volumeMounts.push(vm)
          })
        }

        return clean
      }

      const containers = this.allContainers
        .filter(c => c.type === 'container' && c.name && c.image)
        .map(processContainer)

      const initContainers = this.allContainers
        .filter(c => c.type === 'initContainer' && c.name && c.image)
        .map(processContainer)

      const statefulset = {
        apiVersion: 'apps/v1',
        kind: 'StatefulSet',
        metadata: {
          name: appName,
          namespace: this.selectedNamespace
        },
        spec: {
          replicas: this.createForm.spec.replicas || 1,
          serviceName: appName, // 一般需要配一个 Headless Service
          selector: {
            matchLabels: { app: appName }
          },
          template: {
            metadata: {
              labels: { app: appName }
            },
            spec: {
              containers,
              ...(initContainers.length > 0 ? { initContainers } : {}),
              ...(volumes.length > 0 ? { volumes } : {})
            }
          }
        }
      }

      this.createYamlContent = yaml.dump(statefulset)
      this.$refs.createEditor?.editor?.setValue(this.createYamlContent)
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
  gap: 8px;  /* 按钮间距 */
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
