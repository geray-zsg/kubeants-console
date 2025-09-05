<template>
  <div class="sts-page">
    <!-- 筛选区 -->
    <div class="filters">
      <span class="filter-label">工作空间：</span>
      <el-select v-model="selectedWorkspace" placeholder="选择工作空间" @change="onWorkspaceChange">
        <el-option v-for="ws in workspaces" :key="ws.name" :label="ws.name" :value="ws.name" />
      </el-select>

      <span class="filter-label">命名空间：</span>
      <el-select v-model="selectedNamespace" placeholder="选择命名空间" style="margin-left: 10px" @change="fetchDaemonsets">
        <el-option
          v-for="ns in filteredNamespaces"
          :key="ns.metadata.name"
          :label="ns.metadata.name"
          :value="ns.metadata.name"
        />
      </el-select>

      <el-input
        v-model="searchText"
        placeholder="搜索守护进程"
        style="margin-left: 20px; width: 300px"
        clearable
      />

      <el-button type="primary" style="margin-left: auto" @click="openCreateDialog">
        创建守护进程
      </el-button>
    </div>

    <!-- 操作栏 -->
    <div class="actions">
      <el-button
        type="danger"
        size="mini"
        :disabled="selectedDs.length === 0"
        @click="handleBatchDelete"
      >
        批量删除
      </el-button>
    </div>

    <!-- 表格 -->
    <div class="table-container">
      <el-table v-loading="loading" :data="pagedDaemonsets" border style="flex: 1; overflow: auto" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" />
        <el-table-column prop="metadata.name" label="名称" width="300" />
        <el-table-column label="状态" width="120">
          <template slot-scope="{ row }">
            <el-tag :type="getDsStatusTagType(row)" size="small">
              {{ getDsStatus(row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status.currentNumberScheduled" label="当前调度" width="100" />
        <el-table-column prop="status.desiredNumberScheduled" label="期望调度" width="100" />
        <el-table-column prop="status.numberReady" label="就绪" width="100" />
        <el-table-column prop="metadata.creationTimestamp" label="创建时间" width="180">
          <template slot-scope="{ row }">
            {{ formatDate(row.metadata.creationTimestamp) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="350" align="center">
          <template slot-scope="{ row }">
            <div class="action-buttons">
              <el-button size="small" @click="handleView(row)">详情</el-button>
              <el-button size="small" type="primary" @click="handleEdit(row)">编辑</el-button>
              <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
        <template slot="empty">
          <el-empty description="暂无守护进程数据" />
        </template>
      </el-table>

      <!-- 分页 -->
      <el-pagination
        background
        layout="total, sizes, prev, pager, next"
        :current-page="currentPage"
        :page-sizes="[10, 20, 50, 100]"
        :page-size="pageSize"
        :total="filteredDs.length"
        style="margin-top: 16px; text-align: right"
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </div>

    <!-- 详情弹窗 -->
    <el-dialog title="Daemonset 详情" :visible.sync="showYamlDialog" width="70%">
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

    <!-- 创建弹窗 -->
    <el-dialog :title="isEditMode ? '编辑DaemonSet' : '创建DaemonSet'" :visible.sync="createDialogVisible" width="70%">
      <el-tabs v-model="createTab">
        <el-tab-pane label="表单模式" name="form">
          <el-form :model="createForm" label-width="120px">
            <!-- 基础信息 -->
            <el-form-item label="名称" required>
              <el-input v-model="createForm.metadata.name" placeholder="输入DaemonSet名称" />
            </el-form-item>

            <!-- 容器管理 -->
            <div class="container-management">
              <el-tabs v-model="containerTab" class="container-tabs">
                <el-tab-pane name="container">
                  <span slot="label">工作容器 ({{ containerCounts.container }})</span>
                </el-tab-pane>
                <el-tab-pane name="initContainer">
                  <span slot="label">初始化容器 ({{ containerCounts.initContainer }})</span>
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
              v-for="(container, idx) in currentContainers"
              :key="container.id"
              class="container-card"
            >
              <el-card>
                <div slot="header" class="container-header">
                  <span>{{ container.type === 'container' ? '工作容器' : '初始化容器' }} #{{ idx + 1 }}</span>
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

                <!-- 端口配置 -->
                <el-form-item label="端口配置">
                  <div v-if="container.ports.length > 0">
                    <div style="display: flex; font-weight: bold; margin-bottom: 6px;">
                      <span style="width: 100px;">协议</span>
                      <span style="width: 140px;">名称</span>
                      <span style="width: 120px;">容器端口</span>
                      <span style="flex: 1" />
                    </div>

                    <div
                      v-for="(port, portIdx) in container.ports"
                      :key="portIdx"
                      style="display: flex; align-items: center; margin-bottom: 10px"
                    >
                      <el-select
                        v-model="port.protocol"
                        placeholder="协议"
                        style="width: 100px"
                        @change="onProtocolChange(container, portIdx)"
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

                      <el-button
                        type="text"
                        icon="el-icon-delete"
                        style="color: #F56C6C; margin-left: 10px"
                        @click="removePort(container, portIdx)"
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
                        <el-input
                          :value="getContainerResource(container, 'requests', 'cpu')"
                          placeholder="100m"
                          style="width: 150px"
                          @input="updateContainerResource(container, 'requests', 'cpu', $event)"
                        />
                      </el-form-item>
                      <el-form-item label="内存请求" label-width="80px">
                        <el-input
                          :value="getContainerResource(container, 'requests', 'memory')"
                          placeholder="128Mi"
                          style="width: 150px"
                          @input="updateContainerResource(container, 'requests', 'memory', $event)"
                        />
                      </el-form-item>
                    </div>
                    <!-- 第二行 -->
                    <div style="display: flex; gap: 10px; width: 100%">
                      <el-form-item label="CPU上限" label-width="80px">
                        <el-input
                          :value="getContainerResource(container, 'limits', 'cpu')"
                          placeholder="500m"
                          style="width: 150px"
                          @input="updateContainerResource(container, 'limits', 'cpu', $event)"
                        />
                      </el-form-item>
                      <el-form-item label="内存上限" label-width="80px">
                        <el-input
                          :value="getContainerResource(container, 'limits', 'memory')"
                          placeholder="512Mi"
                          style="width: 150px"
                          @input="updateContainerResource(container, 'limits', 'memory', $event)"
                        />
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

                <el-form-item label="挂载卷">
                  <div
                    v-for="(mount, mountIdx) in container.volumeMounts"
                    :key="mountIdx"
                    style="margin-bottom: 10px; display: flex; gap: 10px"
                  >
                    <!-- 挂载类型 -->
                    <el-select v-model="mount.mountType" placeholder="挂载类型" style="width: 120px">
                      <el-option label="PVC" value="pvc" />
                      <el-option label="ConfigMap" value="configMap" />
                      <el-option label="Secret" value="secret" />
                    </el-select>

                    <!-- PVC -->
                    <template v-if="mount.mountType === 'pvc'">
                      <el-select v-model="mount.pvcName" placeholder="选择 PVC" style="width: 160px">
                        <el-option
                          v-for="pvc in pvcList"
                          :key="pvc.metadata.name"
                          :label="pvc.metadata.name"
                          :value="pvc.metadata.name"
                        />
                      </el-select>
                    </template>

                    <!-- ConfigMap -->
                    <template v-else-if="mount.mountType === 'configMap'">
                      <el-select
                        v-model="mount.configMapName"
                        placeholder="选择 ConfigMap"
                        style="width: 160px"
                        @change="updateAvailableKeys"
                      >
                        <el-option
                          v-for="cm in configMapList"
                          :key="cm.metadata.name"
                          :label="cm.metadata.name"
                          :value="cm.metadata.name"
                        />
                      </el-select>

                      <el-select
                        v-model="mount.key"
                        placeholder="键名（key）"
                        style="width: 120px"
                        @change="mount.subPath = mount.key"
                      >
                        <el-option
                          v-for="key in mount.availableKeys || []"
                          :key="key"
                          :label="key"
                          :value="key"
                        />
                      </el-select>

                      <el-input v-model="mount.subPath" placeholder="子路径（subPath）" style="width: 120px" />
                    </template>

                    <!-- Secret -->
                    <template v-else-if="mount.mountType === 'secret'">
                      <el-select
                        v-model="mount.secretName"
                        placeholder="选择 Secret"
                        style="width: 160px"
                        @change="updateAvailableKeys"
                      >
                        <el-option
                          v-for="secret in secretList"
                          :key="secret.metadata.name"
                          :label="secret.metadata.name"
                          :value="secret.metadata.name"
                        />
                      </el-select>

                      <el-select
                        v-model="mount.key"
                        placeholder="键名（key）"
                        style="width: 120px"
                        @change="mount.subPath = mount.key"
                      >
                        <el-option
                          v-for="key in mount.availableKeys || []"
                          :key="key"
                          :label="key"
                          :value="key"
                        />
                      </el-select>

                      <el-input v-model="mount.subPath" placeholder="子路径（subPath）" style="width: 120px" />
                    </template>

                    <!-- 挂载路径 -->
                    <el-input v-model="mount.mountPath" placeholder="挂载路径" style="width: 200px" />

                    <!-- 挂载模式 -->
                    <el-select v-model="mount.readOnly" placeholder="挂载模式" style="width: 120px">
                      <el-option label="读写" :value="false" />
                      <el-option label="只读" :value="true" />
                    </el-select>

                    <el-button icon="el-icon-delete" type="text" @click="removeMount(container, mountIdx)" />
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
              :options="detailEditorOptions"
            />
          </div>
        </el-tab-pane>
      </el-tabs>

      <span slot="footer" class="dialog-footer">
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">{{ isEditMode ? '更新' : '创建' }}</el-button>
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
      selectedDs: [],
      pageSize: 10,
      currentPage: 1,
      showYamlDialog: false,
      yamlContent: '',
      detailEditorOptions: {
        readOnly: false,
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: 'on',
        folding: true,
        wordWrap: 'on'
      },
      createDialogVisible: false,
      createTab: 'form',
      createYamlContent: '',
      isEditMode: false,
      containerTab: 'container',
      containerIdCounter: 0,
      allContainers: [],
      pvcList: [],
      configMapList: [],
      secretList: [],
      lastYamlContent: '',
      isYamlModified: false,
      createForm: {
        metadata: { name: '' },
        spec: {
          selector: { matchLabels: { app: '' }},
          template: {
            metadata: { labels: { app: '' }},
            spec: {
              containers: []
            }
          }
        }
      }
    }
  },
  computed: {
    ...mapGetters('dashboard', ['workspaces']),
    ...mapGetters('workspace', ['namespaces']),
    ...mapGetters('daemonsets', ['daemonsets']),
    filteredNamespaces() {
      return this.namespaces.filter(
        ns => ns.metadata.labels?.['kubeants.io/workspace'] === this.selectedWorkspace
      )
    },
    filteredDs() {
      if (!this.daemonsets) return []
      return this.searchText
        ? this.daemonsets.filter(s => s.metadata.name.includes(this.searchText))
        : this.daemonsets
    },
    pagedDaemonsets() {
      if (!this.filteredDs) return []
      const start = (this.currentPage - 1) * this.pageSize
      return this.filteredDs.slice(start, start + this.pageSize)
    },
    currentContainers() {
      return this.allContainers.filter(c => c.type === this.containerTab)
    },
    containerCounts() {
      return {
        container: this.allContainers.filter(c => c.type === 'container').length,
        initContainer: this.allContainers.filter(c => c.type === 'initContainer').length
      }
    }
  },
  watch: {
    filteredDs() {
      this.currentPage = 1
    },
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
    ...mapActions('storageclass', ['getStorageclass']),
    ...mapActions('persistentvolumeclaims', ['getPersistentVolumeClaims']),
    ...mapActions('configmap', ['getConfigmap']),
    ...mapActions('secrets', ['getSecrets']),
    ...mapActions('daemonsets', [
      'getDaemonsets',
      'getDaemonsetsDetail',
      'createDaemonsets',
      'updateDaemonsets',
      'deleteDaemonsets'
    ]),

    updateAvailableKeys() {
      this.allContainers.forEach(container => {
        if (!Array.isArray(container.volumeMounts)) return
        container.volumeMounts.forEach(mount => {
          if (mount.mountType === 'configMap') {
            const cm = this.configMapList.find(c => c.metadata.name === mount.configMapName)
            this.$set(mount, 'availableKeys', cm ? Object.keys(cm.data || {}) : [])
          } else if (mount.mountType === 'secret') {
            const sec = this.secretList.find(s => s.metadata.name === mount.secretName)
            this.$set(mount, 'availableKeys', sec ? Object.keys(sec.data || {}) : [])
          } else {
            this.$set(mount, 'availableKeys', [])
          }
        })
      })
    },

    pushContainerFromYaml(container, type = 'container', volumes = []) {
      const mounts = (container.volumeMounts || []).map(m => {
        const volume = volumes.find(v => v.name === m.name)
        let mountType = 'unknown'
        let pvcName = ''
        let configMapName = ''
        let secretName = ''
        let key = ''
        const subPath = m.subPath || ''

        if (volume?.persistentVolumeClaim) {
          mountType = 'pvc'
          pvcName = volume.persistentVolumeClaim.claimName
        } else if (volume?.configMap) {
          mountType = 'configMap'
          configMapName = volume.configMap.name
        } else if (volume?.secret) {
          mountType = 'secret'
          secretName = volume.secret.secretName
        }

        // 推测 ConfigMap/Secret 挂载的 key（用于回填表单）
        if (mountType === 'configMap' || mountType === 'secret') {
          if (subPath) {
            key = subPath // 很多时候 subPath 就是 key
          }
        }

        return {
          mountType,
          pvcName,
          configMapName,
          secretName,
          mountPath: m.mountPath,
          readOnly: typeof m.readOnly === 'boolean' ? m.readOnly : false,
          subPath,
          key
        }
      })

      // 确保资源配额有默认值
      const resources = container.resources || {}
      const requests = resources.requests || {}
      const limits = resources.limits || {}

      const mapped = {
        id: ++this.containerIdCounter,
        type,
        name: container.name || '',
        image: container.image || '',
        imagePullPolicy: container.imagePullPolicy || 'IfNotPresent',
        ports: container.ports || [],
        resources: {
          requests: {
            cpu: requests.cpu || '100m',
            memory: requests.memory || '128Mi'
          },
          limits: {
            cpu: limits.cpu || '500m',
            memory: limits.memory || '512Mi'
          }
        },
        volumeMounts: mounts,
        command: joinShellArgs(container.command),
        args: joinShellArgs(container.args)
      }

      this.allContainers.push(mapped)
    },

    async onWorkspaceChange() {
      this.selectedNamespace = ''
      await this.getNamespaces(this.selectedWorkspace)
      const filtered = this.filteredNamespaces
      if (filtered.length > 0) {
        this.selectedNamespace = filtered[0].metadata.name
        await this.fetchDaemonsets()
      }
    },

    async fetchDaemonsets() {
      if (!this.selectedWorkspace || !this.selectedNamespace) return
      this.loading = true
      try {
        await this.getDaemonsets({
          wsName: this.selectedWorkspace,
          nsName: this.selectedNamespace
        })
      } catch (error) {
        console.error('获取Daemonsets失败:', error)
      } finally {
        this.loading = false
      }
    },

    // 确保在打开创建对话框时获取相关资源列表
    async openCreateDialog() {
      this.isEditMode = false
      this.createForm = {
        metadata: { name: '' },
        spec: {
          selector: { matchLabels: { app: '' }},
          template: {
            metadata: { labels: { app: '' }},
            spec: {
              containers: []
            }
          }
        }
      }
      this.allContainers = [this.createContainer('container')]
      this.containerTab = 'container'
      this.createDialogVisible = true

      // 获取相关资源列表
      await this.fetchPVCs()
      await this.fetchCMs()
      await this.fetchSecrets()
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
          requests: { cpu: '100m', memory: '128Mi' },
          limits: { cpu: '500m', memory: '512Mi' }
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

        // 确保资源结构存在
        const resources = container.resources || {}
        const requests = resources.requests || {}
        const limits = resources.limits || {}

        clean.resources = {
          requests: {
            cpu: addResourceUnit(requests.cpu, 'cpu'),
            memory: addResourceUnit(requests.memory, 'memory')
          },
          limits: {
            cpu: addResourceUnit(limits.cpu, 'cpu'),
            memory: addResourceUnit(limits.memory, 'memory')
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
              vm.subPath = m.subPath || m.key
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

      const daemonSet = {
        apiVersion: 'apps/v1',
        kind: 'DaemonSet',
        metadata: {
          name: appName,
          namespace: this.selectedNamespace
        },
        spec: {
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

      this.createYamlContent = yaml.dump(daemonSet)
      if (this.$refs.createEditor && this.$refs.createEditor.editor) {
        this.$refs.createEditor.editor.setValue(this.createYamlContent)
      }
    },

    // 解析YAML到表单
    parseYamlToForm() {
      try {
        const editorValue = this.$refs.createEditor?.editor?.getValue?.()
        const parsed = yaml.load(editorValue)

        this.isYamlModified = false
        this.lastYamlContent = editorValue
        this.createYamlContent = editorValue

        const form = safeParseForm(parsed)

        // 同步 namespace
        this.selectedNamespace = form.namespace || this.selectedNamespace

        // 替换 createForm
        this.createForm = {
          metadata: form.metadata,
          spec: form.spec
        }

        // 清空容器列表再回填
        this.allContainers.splice(0, this.allContainers.length)
        const containers = parsed?.spec?.template?.spec?.containers || []
        const initContainers = parsed?.spec?.template?.spec?.initContainers || []
        const volumes = parsed?.spec?.template?.spec?.volumes || []

        containers.forEach(c => this.pushContainerFromYaml(c, 'container', volumes))
        initContainers.forEach(c => this.pushContainerFromYaml(c, 'initContainer', volumes))

        this.$message.success('已同步回表单模式')
      } catch (err) {
        this.$message.error('YAML 解析失败：' + err.message)
        console.error(err)
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

      const dsName = parsed.metadata.name
      const namespace = parsed.metadata.namespace || this.selectedNamespace

      // 验证必填字段
      if (!dsName) {
        this.$message.error('DaemonSet名称不能为空')
        return
      }

      if (!parsed.spec.selector || !parsed.spec.selector.matchLabels) {
        this.$message.error('Selector匹配标签不能为空')
        return
      }

      if (!parsed.spec.template || !parsed.spec.template.metadata || !parsed.spec.template.metadata.labels) {
        this.$message.error('模板标签不能为空')
        return
      }

      try {
        // 创建或更新DaemonSet
        const action = this.isEditMode ? this.updateDaemonsets : this.createDaemonsets
        await action({
          wsName: this.selectedWorkspace,
          nsName: namespace,
          dsName: dsName,
          dsObj: parsed
        })

        this.$message.success(`${this.isEditMode ? '更新' : '创建'}成功`)
        this.createDialogVisible = false
        this.fetchDaemonsets()
      } catch (err) {
        this.$message.error(`${this.isEditMode ? '更新' : '创建'}失败: ${err.message}`)
        console.error(err)
      }
    },

    async handleEdit(row) {
      this.isEditMode = true
      this.createTab = 'form'

      try {
        // 获取 DaemonSet 详情
        const detail = await this.getDaemonsetsDetail({
          wsName: this.selectedWorkspace,
          nsName: this.selectedNamespace,
          dsName: row.metadata.name
        })

        // 同步 namespace
        this.selectedNamespace = detail.metadata.namespace

        // 解析 DaemonSet 到表单
        const form = safeParseForm(detail)

        this.createForm = {
          metadata: form.metadata,
          spec: form.spec
        }

        // 清空容器列表
        this.allContainers = []
        this.containerIdCounter = 0

        const containers = detail?.spec?.template?.spec?.containers || []
        const initContainers = detail?.spec?.template?.spec?.initContainers || []
        const volumes = detail?.spec?.template?.spec?.volumes || []

        // 确保每个容器都有正确的资源结构
        containers.forEach(c => {
          // 确保资源结构完整
          if (!c.resources) c.resources = {}
          if (!c.resources.requests) c.resources.requests = {}
          if (!c.resources.limits) c.resources.limits = {}

          this.pushContainerFromYaml(c, 'container', volumes)
        })

        initContainers.forEach(c => {
          // 确保资源结构完整
          if (!c.resources) c.resources = {}
          if (!c.resources.requests) c.resources.requests = {}
          if (!c.resources.limits) c.resources.limits = {}

          this.pushContainerFromYaml(c, 'initContainer', volumes)
        })

        // 打开弹窗
        this.createDialogVisible = true
        await this.fetchPVCs()
        await this.fetchCMs()
        await this.fetchSecrets()
      } catch (err) {
        this.$message.error('获取 DaemonSet 详情失败')
        console.error(err)
      }
    },

    async handleDelete(row) {
      this.$confirm(`确认删除 Daemonset [${row.metadata.name}]？`, '提示', { type: 'warning' }).then(async() => {
        await this.deleteDaemonsets({
          wsName: this.selectedWorkspace,
          nsName: this.selectedNamespace,
          dsName: row.metadata.name
        })
        this.fetchDaemonsets()
        this.$message.success('删除成功')
      })
    },

    async handleView(row) {
      try {
        const res = await this.getDaemonsetsDetail({
          wsName: this.selectedWorkspace,
          nsName: this.selectedNamespace,
          dsName: row.metadata.name
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

    async handleBatchDelete() {
      if (this.selectedDs.length === 0) {
        this.$message.warning('请先选择要删除的 DaemonSet')
        return
      }

      this.$confirm(`确认删除选中的 ${this.selectedDs.length} 个 DaemonSet？`, '提示', { type: 'warning' }).then(async() => {
        const tasks = this.selectedDs.map(ds =>
          this.deleteDaemonsets({
            wsName: this.selectedWorkspace,
            nsName: this.selectedNamespace,
            dsName: ds.metadata.name
          })
        )
        try {
          await Promise.all(tasks)
          this.$message.success('批量删除成功')
          this.fetchDaemonsets()
        } catch (err) {
          this.$message.error('删除失败')
          console.error(err)
        }
      })
    },

    // DaemonSet状态获取
    getDsStatus(ds) {
      if (!ds.status) return 'Unknown'

      const desired = ds.status.desiredNumberScheduled || 0
      const current = ds.status.currentNumberScheduled || 0
      const ready = ds.status.numberReady || 0

      if (ds.status.updatedNumberScheduled !== undefined &&
          ds.status.updatedNumberScheduled !== ds.status.desiredNumberScheduled) {
        return 'Updating'
      }
      if (ready === desired && current === desired) {
        return 'Running'
      }
      return 'Pending'
    },

    getDsStatusTagType(ds) {
      const status = this.getDsStatus(ds)
      switch (status) {
        case 'Running': return 'success'
        case 'Updating': return 'warning'
        case 'Pending': return 'warning'
        case 'Failed': return 'danger'
        default: return ''
      }
    },

    // 获取PVC、configmap和secret列表
    async fetchPVCs() {
      if (!this.selectedWorkspace || !this.selectedNamespace) return
      try {
        this.pvcList = await this.getPersistentVolumeClaims({
          wsName: this.selectedWorkspace,
          nsName: this.selectedNamespace
        })
      } catch (error) {
        console.error('获取PVC列表失败:', error)
        this.pvcList = []
      }
    },

    async fetchCMs() {
      if (!this.selectedWorkspace || !this.selectedNamespace) return
      try {
        this.configMapList = await this.getConfigmap({
          wsName: this.selectedWorkspace,
          nsName: this.selectedNamespace
        })
      } catch (error) {
        console.error('获取configmap列表失败:', error)
        this.configMapList = []
      }
    },

    async fetchSecrets() {
      if (!this.selectedWorkspace || !this.selectedNamespace) return
      try {
        this.secretList = await this.getSecrets({
          wsName: this.selectedWorkspace,
          nsName: this.selectedNamespace
        })
      } catch (error) {
        console.error('获取secret列表失败:', error)
        this.secretList = []
      }
    },

    // 端口管理方法
    addPort(container) {
      if (!Array.isArray(container.ports)) {
        this.$set(container, 'ports', [])
      }

      const protocol = 'TCP'
      const index = container.ports.filter(p => p.protocol === protocol).length + 1
      const defaultName = `${protocol.toLowerCase()}-${index}`

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

      if (!port.name || /^tcp-\d+$|^udp-\d+$/.test(port.name)) {
        this.$set(port, 'name', name)
      }
    },

    // 挂载卷管理方法
    addMount(container) {
      if (!container.volumeMounts) this.$set(container, 'volumeMounts', [])
      const newMount = {
        mountType: 'pvc',
        pvcName: '',
        configMapName: '',
        secretName: '',
        mountPath: '',
        key: '',
        subPath: '',
        readOnly: false,
        availableKeys: []
      }
      container.volumeMounts.push(newMount)
    },

    removeMount(container, index) {
      container.volumeMounts.splice(index, 1)
    },

    handleSelectionChange(val) {
      this.selectedDs = val
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

    // 获取容器资源值，如果不存在则返回默认值
    getContainerResource(container, type, resource) {
      if (!container.resources) {
        this.$set(container, 'resources', {})
      }
      if (!container.resources[type]) {
        this.$set(container.resources, type, {})
      }

      const defaultValue = type === 'requests'
        ? (resource === 'cpu' ? '100m' : '128Mi')
        : (resource === 'cpu' ? '500m' : '512Mi')

      return container.resources[type][resource] || defaultValue
    },

    // 更新容器资源值
    updateContainerResource(container, type, resource, value) {
      if (!container.resources) {
        this.$set(container, 'resources', {})
      }
      if (!container.resources[type]) {
        this.$set(container.resources, type, {})
      }

      this.$set(container.resources[type], resource, value)
    }
  }
}
</script>

<style scoped>
.sts-page {
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

.action-buttons {
  display: flex;
  gap: 8px;
}

.table-container {
  flex: 1;
  overflow: auto;
}

.actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 12px 0;
}

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

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
</style>
