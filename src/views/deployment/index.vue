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
      <el-button type="primary" style="margin-left: auto" @click="openCreateDialog">
        创建无状态服务
      </el-button>
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

    <el-dialog title="无状态服务详情" :visible.sync="showYamlDialog" width="70%" @opened="refreshMonacoEditor">
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

    <!-- 创建对话框 -->
    <el-dialog
      title="创建无状态服务"
      :visible.sync="createDialogVisible"
      width="70%"
      @opened="onCreateDialogOpened"
    >
      <el-tabs v-model="createTab" @tab-click="handleTabClick">
        <el-tab-pane label="表单模式" name="form">
          <el-form :model="createForm" label-width="120px">
            <!-- 基础信息 -->
            <el-form-item label="名称" required>
              <el-input v-model="createForm.metadata.name" placeholder="输入服务名称" />
            </el-form-item>
            <el-form-item label="副本数">
              <el-input-number v-model="createForm.spec.replicas" :min="0" />
            </el-form-item>

            <!-- 容器管理 -->
            <div class="container-management">
              <el-tabs v-model="containerTab" class="container-tabs">
                <el-tab-pane name="container">
                  <template #label>
                    <span>工作容器 ({{ containerCounts.container }})</span>
                  </template>
                </el-tab-pane>
                <el-tab-pane name="initContainer">
                  <template #label>
                    <span>初始化容器 ({{ containerCounts.initContainer }})</span>
                  </template>
                </el-tab-pane>
              </el-tabs>

              <div class="container-actions">
                <el-button
                  type="primary"
                  size="small"
                  @click="addContainer(containerTab)"
                >
                  + 添加{{ containerTab === 'container' ? '工作容器' : '初始化容器' }}
                </el-button>
              </div>
            </div>

            <!-- 容器列表 -->
            <div
              v-for="(container, index) in currentContainers"
              :key="container.id"
              class="container-card"
            >
              <el-card>
                <div slot="header" class="container-header">
                  <span>{{ container.type === 'container' ? '工作容器' : '初始化容器' }} #{{ index + 1 }}</span>
                  <el-button
                    type="text"
                    icon="el-icon-delete"
                    style="float:right; color: #F56C6C"
                    @click="removeContainer(container.id)"
                  />
                </div>

                <el-form-item label="容器名称" required>
                  <el-input v-model="container.name" placeholder="输入容器名称" />
                </el-form-item>
                <el-form-item label="镜像" required>
                  <el-input v-model="container.image" placeholder="输入镜像地址" />
                </el-form-item>
                <!-- 端口配置（可添加多个） -->
                <el-form-item label="端口配置">
                  <div v-if="container.ports.length > 0">
                    <div style="display: flex; font-weight: bold; margin-bottom: 6px;">
                      <span style="width: 100px;">协议</span>
                      <span style="width: 140px;">名称</span>
                      <span style="width: 120px;">容器端口</span>
                      <!-- <span style="width: 120px;">主机端口</span> -->
                      <span style="flex: 1" />
                    </div>

                    <div
                      v-for="(port, pIndex) in container.ports"
                      :key="pIndex"
                      style="display: flex; align-items: center; margin-bottom: 10px"
                    >
                      <el-select
                        v-model="port.protocol"
                        placeholder="协议"
                        style="width: 100px"
                        @change="onProtocolChange(container, pIndex)"
                      >
                        <el-option label="TCP" value="TCP" />
                        <el-option label="UDP" value="UDP" />
                      </el-select>

                      <el-input
                        v-model="port.name"
                        placeholder="名称"
                        style="width: 140px; margin-left: 10px"
                        clearable
                      />

                      <el-input-number
                        v-model="port.containerPort"
                        :min="1"
                        :max="65535"
                        placeholder="容器端口"
                        style="width: 120px; margin-left: 10px"
                      />
                      <!--
                      <el-input-number
                        v-model="port.hostPort"
                        :min="1"
                        :max="65535"
                        placeholder="主机端口"
                        style="width: 120px; margin-left: 10px"
                      /> -->

                      <el-button
                        type="text"
                        icon="el-icon-delete"
                        style="color: #F56C6C; margin-left: 10px"
                        @click="removePort(container, pIndex)"
                      />
                    </div>
                  </div>

                  <el-button
                    size="mini"
                    type="primary"
                    icon="el-icon-plus"
                    @click="addPort(container)"
                  >
                    添加端口
                  </el-button>
                </el-form-item>
                <el-form-item label="资源配额">
                  <div style="display: flex; flex-wrap: wrap; gap: 10px">
                    <!-- 第一行 -->
                    <div style="display: flex; gap: 10px; width: 100%">
                      <el-form-item label="CPU请求" label-width="80px">
                        <el-input v-model="container.resources.requests.cpu" placeholder="100m" style="width: 150px" />
                      </el-form-item>
                      <el-form-item label="内存请求" label-width="80px">
                        <el-input v-model="container.resources.requests.memory" placeholder="128Mi" style="width: 150px" />
                      </el-form-item>
                    </div>
                    <!-- 第二行 -->
                    <div style="display: flex; gap: 10px; width: 100%">
                      <el-form-item label="CPU上限" label-width="80px">
                        <el-input v-model="container.resources.limits.cpu" placeholder="500m" style="width: 150px" />
                      </el-form-item>
                      <el-form-item label="内存上限" label-width="80px">
                        <el-input v-model="container.resources.limits.memory" placeholder="512Mi" style="width: 150px" />
                      </el-form-item>
                    </div>
                  </div>
                </el-form-item>
                <el-form-item label="镜像拉取策略">
                  <el-select
                    v-model="container.imagePullPolicy"
                    placeholder="选择策略"
                    style="width: 200px"
                  >
                    <el-option label="Always" value="Always" />
                    <el-option label="IfNotPresent" value="IfNotPresent" />
                    <el-option label="Never" value="Never" />
                  </el-select>
                </el-form-item>
                <el-form-item label="启动命令（command）">
                  <el-input
                    v-model="container.command"
                    type="textarea"
                    placeholder="每行一条命令参数，例如：/bin/sh"
                    :autosize="{ minRows: 2, maxRows: 6 }"
                  />
                </el-form-item>

                <el-form-item label="启动参数（args）">
                  <el-input
                    v-model="container.args"
                    type="textarea"
                    placeholder="每行一个参数，例如：-c\nwhile true; do echo hello; sleep 10; done"
                    :autosize="{ minRows: 2, maxRows: 6 }"
                  />
                </el-form-item>

                <el-form-item label="挂载卷（PVC）">
                  <div v-for="(mount, index) in container.volumeMounts" :key="index" style="margin-bottom: 10px;">
                    <el-select v-model="mount.pvcName" placeholder="选择 PVC" style="width: 200px; margin-right: 10px">
                      <el-option
                        v-for="pvc in pvcList"
                        :key="pvc.metadata.name"
                        :label="pvc.metadata.name"
                        :value="pvc.metadata.name"
                      />
                    </el-select>
                    <el-input v-model="mount.mountPath" placeholder="挂载路径" style="width: 200px; margin-right: 10px" />
                    <el-select v-model="mount.readOnly" placeholder="挂载模式" style="width: 140px">
                      <el-option label="读写" :value="false" />
                      <el-option label="只读" :value="true" />
                    </el-select>
                    <el-button icon="el-icon-delete" type="text" @click="removeMount(container, index)" />
                  </div>
                  <el-button type="primary" size="mini" @click="addMount(container)">+ 添加挂载</el-button>
                </el-form-item>
              </el-card>
            </div>

            <!-- 无容器提示 -->
            <div v-if="currentContainers.length === 0" class="no-container">
              <el-alert
                type="info"
                :closable="false"
                title="请添加至少一个容器"
              />
            </div>
          </el-form>
        </el-tab-pane>

        <!-- YAML模式 -->
        <el-tab-pane label="YAML 模式" name="yaml">
          <div style="height: 400px; border: 1px solid #dcdfe6; border-radius: 4px">
            <monaco-editor
              ref="createEditor"
              v-model="createYamlContent"
              language="yaml"
              theme="vs-dark"
              :options="DetailditorOptions"
            />
          </div>
        </el-tab-pane>
      </el-tabs>

      <span slot="footer" class="dialog-footer">
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCreateDeployment">创建</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'
import MonacoEditor from 'vue-monaco-editor'
import yaml from 'js-yaml'
import { joinShellArgs } from '@/utils/shellArgUtils'

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
      selectedStatus: '',
      createDialogVisible: false,
      createTab: 'form',
      createForm: {
        metadata: { name: '' },
        spec: {
          replicas: 1,
          selector: { matchLabels: { app: '' }},
          template: {
            metadata: { labels: { app: '' }},
            spec: {
              // 不再需要初始容器定义
            }
          }
        }
      },
      allContainers: [],
      createYamlContent: '',
      containerTab: 'container',
      containerIdCounter: 0,
      pvcList: []
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
    currentContainers() {
      return this.allContainers.filter(c => c.type === this.containerTab)
    },
    containerCounts() {
      return {
        container: this.allContainers.filter(c => c.type === 'container').length,
        initContainer: this.allContainers.filter(c => c.type === 'initContainer').length
      }
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
    ...mapActions('persistentvolumeclaims', ['getPersistentVolumeClaims']),
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

    // 确保在打开创建对话框时获取PVC列表
    openCreateDialog() {
      this.createForm = {
        metadata: { name: '' },
        spec: {
          replicas: 1
        }
      }
      this.allContainers = [this.createContainer('container')]
      this.containerTab = 'container'
      this.createDialogVisible = true

      // 添加PVC列表获取
      this.fetchPVCs()
    },

    // 创建容器对象
    createContainer(type) {
      return {
        id: ++this.containerIdCounter,
        type,
        name: '',
        image: '',
        ports: [],
        resources: {
          requests: { cpu: '100', memory: '128' }, // 默认值
          limits: { cpu: '500', memory: '512' } // 默认值
        },
        imagePullPolicy: 'IfNotPresent',
        command: '',
        args: '',
        volumeMounts: []
      }
    },

    // 添加容器
    addContainer(type) {
      this.allContainers.push(this.createContainer(type))
    },

    // 删除容器
    removeContainer(id) {
      const index = this.allContainers.findIndex(c => c.id === id)
      if (index !== -1) {
        this.allContainers.splice(index, 1)
      }
    },

    // 生成YAML
    generateYamlFromForm() {
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

        clean.command = splitShellArgs(rest.command)
clean.args = splitShellArgs(rest.args)

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

        // 处理 PVC 挂载
        if (Array.isArray(container.volumeMounts)) {
          clean.volumeMounts = container.volumeMounts.map(m => {
            const volumeName = `pvc-${m.pvcName}`
            if (!volumes.find(v => v.name === volumeName)) {
              volumes.push({
                name: volumeName,
                persistentVolumeClaim: {
                  claimName: m.pvcName
                }
              })
            }

            return {
              name: volumeName,
              mountPath: m.mountPath,
              readOnly: m.readOnly
            }
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

      const deployment = {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
          name: appName,
          namespace: this.selectedNamespace
        },
        spec: {
          replicas: this.createForm.spec.replicas,
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

      this.createYamlContent = yaml.dump(deployment)
  this.$refs.createEditor?.editor?.setValue(this.createYamlContent)
    },

    // 解析YAML到表单
    parseYamlToForm() {
      try {
        const parsed = yaml.load(this.createYamlContent)
        const appName = parsed.metadata?.name || ''

        this.createForm = {
          metadata: { name: appName },
          spec: {
            replicas: parsed.spec?.replicas || 1
          }
        }

        this.allContainers = []

        const containers = parsed.spec?.template?.spec?.containers || []
        containers.forEach(c => {
          this.allContainers.push({ ...this.createContainer('container'), ...c })
        })

        const initContainers = parsed.spec?.template?.spec?.initContainers || []
        initContainers.forEach(c => {
          this.allContainers.push({ ...this.createContainer('initContainer'), ...c })
        })

        this.$message.success('已同步回表单模式')
      } catch (err) {
        this.$message.error('YAML 解析失败：' + err.message)
      }
    },

    onCreateDialogOpened() {
      if (this.createTab === 'yaml') {
        this.generateYamlFromForm()
      }
    },
    handleTabClick(tab) {
      if (tab.name === 'yaml') this.generateYamlFromForm()
      else this.parseYamlToForm()
    },
    submitCreateDeployment() {
      this.generateYamlFromForm()
      let parsed
      try {
        parsed = yaml.load(this.createYamlContent)
      } catch (err) {
        this.$message.error('YAML格式错误: ' + err.message)
        return
      }

      this.createDeployment({
        wsName: this.selectedWorkspace,
        nsName: this.selectedNamespace,
        deployName: parsed.metadata.name,
        deploy: parsed
      })
        .then(() => {
          this.$message.success('创建成功')
          this.createDialogVisible = false
          this.fetchdeployments()
        })
        .catch(err => {
          this.$message.error('创建失败')
          console.error(err)
        })
    },
    formatDate(dateStr) {
      if (!dateStr) return '-'
      return new Date(dateStr).toLocaleString()
    },
    async handleDelete(row) {
      this.$confirm(`确认无状态服务 [${row.metadata.name}]？`, '提示', { type: 'warning' }).then(async() => {
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
    // 获取PVC列表的方法
    async fetchPVCs() {
      if (!this.selectedWorkspace || !this.selectedNamespace) return
      try {
        // 直接接收action返回的数据
        this.pvcList = await this.getPersistentVolumeClaims({
          wsName: this.selectedWorkspace,
          nsName: this.selectedNamespace
        })
        console.log('获取到的pvc', this.pvcList) // 现在有数据了
      } catch (error) {
        console.error('获取PVC列表失败:', error)
        this.pvcList = []
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
    },
    ensurePort(container) {
      if (!Array.isArray(container.ports)) {
        this.$set(container, 'ports', [{ containerPort: null }])
      } else if (!container.ports[0]) {
        this.$set(container.ports, 0, { containerPort: null })
      }
    },
    addPort(container) {
      if (!Array.isArray(container.ports)) {
        this.$set(container, 'ports', [])
      }

      const protocol = 'TCP'
      const index = container.ports.filter(p => p.protocol === protocol).length + 1
      const defaultName = `${protocol.toLowerCase()}-${index}`

      // 自动避免重复名称
      const existingNames = new Set(container.ports.map(p => p.name))
      let name = defaultName
      let i = index
      while (existingNames.has(name)) {
        i++
        name = `${protocol.toLowerCase()}-${i}`
      }

      container.ports.push({
        name,
        containerPort: 80,
        // hostPort: 80,
        protocol
      })
    },

    removePort(container, index) {
      container.ports.splice(index, 1)
    },
    onProtocolChange(container, index) {
      const port = container.ports[index]
      if (!port) return

      const protocol = port.protocol || 'TCP'
      const base = protocol.toLowerCase()

      const existingNames = new Set(container.ports.map((p, i) => i !== index && p.name))
      let i = 1
      let name = `${base}-${i}`
      while (existingNames.has(name)) {
        i++
        name = `${base}-${i}`
      }

      // 如果用户没自定义名称（当前是旧的自动名），则替换
      if (!port.name || /^tcp-\d+$|^udp-\d+$/.test(port.name)) {
        this.$set(port, 'name', name)
      }
    },
    validatePorts(container) {
      const names = new Set()
      const ports = new Set()
      for (const port of container.ports) {
        if (!port.containerPort) {
          this.$message.error('容器端口不能为空')
          return false
        }
        if (ports.has(port.containerPort)) {
          this.$message.error(`容器端口 ${port.containerPort} 重复`)
          return false
        }
        ports.add(port.containerPort)

        if (port.name) {
          if (names.has(port.name)) {
            this.$message.error(`端口名称 "${port.name}" 重复`)
            return false
          }
          names.add(port.name)
        }
      }
      return true
    },
    ensureResources(container) {
      if (!container.resources) this.$set(container, 'resources', {})
      if (!container.resources.requests) this.$set(container.resources, 'requests', {})
      if (!container.resources.limits) this.$set(container.resources, 'limits', {})
    },
    addVolumeMount(container) {
      if (!container.volumeMounts) {
        this.$set(container, 'volumeMounts', [])
      }
      container.volumeMounts.push({
        name: '', // 用于与 volumes 匹配
        mountPath: '',
        readOnly: false,
        claimName: ''
      })
    },
    removeVolumeMount(container, index) {
      container.volumeMounts.splice(index, 1)
    },
    addMount(container) {
      if (!container.volumeMounts) this.$set(container, 'volumeMounts', [])
      container.volumeMounts.push({
        pvcName: '',
        mountPath: '',
        readOnly: false
      })
    },
    removeMount(container, index) {
      container.volumeMounts.splice(index, 1)
    }

  }
}
</script>

<style scoped>
/* 容器管理样式 */
.container-management {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid #ebeef5;
}

.container-tabs {
  flex: 1;
}

.container-actions {
  margin-left: 20px;
}

.container-card {
  margin-bottom: 20px;
}

.container-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.no-container {
  margin: 20px 0;
}
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
