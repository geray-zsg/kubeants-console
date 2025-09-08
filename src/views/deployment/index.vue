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

      <el-input v-model="searchText" placeholder="搜索无状态服务" style="margin-left: 20px; width: 300px" clearable />
      <el-button type="primary" style="margin-left: auto" @click="openCreateDialog">创建无状态服务</el-button>
    </div>

    <!-- 操作栏：批量删除 + 状态筛选 -->
    <div class="actions">
      <el-button type="danger" size="mini" :disabled="selectedDeployments.length === 0" @click="handleBatchDelete">批量删除</el-button>

      <el-select v-model="selectedStatus" placeholder="筛选状态" clearable style="width: 180px" @change="handleStatusFilterChange">
        <el-option v-for="(count, status) in statusCounts" :key="status" :label="`${status} (${count})`" :value="status" />
      </el-select>
    </div>

    <div class="table-container">
      <el-table v-loading="loading" :data="pagedDeployments || []" border style="flex: 1; overflow: auto" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" />
        <el-table-column prop="metadata.name" label="名称" width="220" />

        <el-table-column label="状态" width="120">
          <template v-slot="{ row }">
            <el-tag :type="getDeploymentStatusTagType(row)" size="small">
              {{ getDeploymentStatus(row) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="副本" width="120">
          <template v-slot="{ row }">
            <span class="replica-count">
              {{ getAvailableReplicas(row) }}/{{ getDesiredReplicas(row) }}
            </span>
          </template>
        </el-table-column>

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

        <el-table-column label="操作" fixed="right" width="220">
          <template v-slot="{ row }">
            <div class="action-buttons">
              <el-button size="small" text @click="handleView(row)">详情</el-button>
              <el-button size="small" type="primary" @click="handleEdit(row)">编辑</el-button>
              <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>

        <template #empty>
          <el-empty description="暂无Deployment数据" />
        </template>
      </el-table>

      <!-- 增强的分页组件 -->
      <el-pagination background layout="total, sizes, prev, pager, next" :current-page="currentPage" :page-sizes="[10, 20, 50, 100, 500]" :page-size="pageSize" :total="filteredDeploymentsByStatus.length" style="margin-top: 16px; text-align: right" @current-change="handlePageChange" @size-change="handleSizeChange" />
    </div>

    <el-dialog title="无状态服务详情" :visible.sync="showYamlDialog" width="70%" @opened="refreshMonacoEditor">
      <div style="height: 400px; border: 1px solid #dcdfe6; border-radius: 4px">
        <monaco-editor ref="yamlViewer" v-model="yamlContent" language="yaml" theme="vs-dark" :options="DetailditorOptions" />
      </div>
    </el-dialog>

    <!-- 创建对话框 -->
    <el-dialog :title="isEditMode ? '编辑无状态服务' : '创建无状态服务'" :visible.sync="createDialogVisible" width="70%" @opened="onCreateDialogOpened">
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
                <!-- 修改资源配额的模板部分，添加默认值 -->
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

                <el-form-item label="挂载卷">
                  <div
                    v-for="(mount, mIndex) in container.volumeMounts"
                    :key="mIndex"
                    style="margin-bottom: 10px; display: flex; gap: 10px"
                  >
                    <!-- 挂载类型 -->
                    <el-select v-model="mount.mountType" placeholder="挂载类型" style="width: 120px">
                      <el-option label="PVC" value="pvc" />
                      <el-option label="ConfigMap" value="configMap" />
                      <el-option label="Secret" value="secret" />
                      <el-option label="HostPath" value="hostPath" />
                      <el-option label="EmptyDir" value="emptyDir" />
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
                    <!-- HostPath 类型 -->
                    <template v-else-if="mount.mountType === 'hostPath'">
                      <el-input v-model="mount.hostPath" placeholder="主机路径" style="width: 160px" />
                      <el-select v-model="mount.hostPathType" placeholder="路径类型" style="width: 120px">
                        <el-option label="Directory" value="Directory" />
                        <el-option label="File" value="File" />
                        <el-option label="Socket" value="Socket" />
                        <el-option label="CharDevice" value="CharDevice" />
                        <el-option label="BlockDevice" value="BlockDevice" />
                      </el-select>
                    </template>

                    <!-- EmptyDir 类型 -->
                    <template v-else-if="mount.mountType === 'emptyDir'">
                      <el-select v-model="mount.medium" placeholder="存储介质" style="width: 120px">
                        <el-option label="默认" value="" />
                        <el-option label="Memory" value="Memory" />
                      </el-select>
                      <el-input v-model="mount.sizeLimit" placeholder="大小限制" style="width: 120px" />
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

                    <el-button icon="el-icon-delete" type="text" @click="removeMount(container, mIndex)" />
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
        <el-button type="primary" @click="handleSubmit">{{ isEdit ? '更新' : '创建' }}</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'
import MonacoEditor from 'vue-monaco-editor'
import yaml from 'js-yaml'
import { joinShellArgs, splitShellArgs } from '@/utils/shellArgUtils'
import { safeParseForm } from '@/utils/deployParser'

export default {
  components: { MonacoEditor },
  data() {
    return {
      isEdit: false,
      isEditMode: false,
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
      pvcList: [],
      configMapList: [],
      secretList: [],
      lastYamlContent: '', // 存储上一次从表单生成的 YAML
      isYamlModified: false
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
    ...mapActions('configmap', ['getConfigmap']),
    ...mapActions('secrets', ['getSecrets']),
    ...mapActions('deployments', [
      'getDeployment',
      'getDeploymentDetail',
      'createDeployment',
      'updateDeployment',
      'deleteDeployment'
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
        let hostPath = ''
        let hostPathType = ''
        let medium = ''
        let sizeLimit = ''
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
        } else if (volume?.hostPath) {
          mountType = 'hostPath'
          hostPath = volume.hostPath.path
          hostPathType = volume.hostPath.type || ''
        } else if (volume?.emptyDir) {
          mountType = 'emptyDir'
          medium = volume.emptyDir.medium || ''
          sizeLimit = volume.emptyDir.sizeLimit || ''
        }

        // 推测 ConfigMap/Secret 挂载的 key
        if ((mountType === 'configMap' || mountType === 'secret') && subPath) {
          key = subPath
        }

        return {
          mountType,
          pvcName,
          configMapName,
          secretName,
          hostPath,
          hostPathType,
          medium,
          sizeLimit,
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
      this.isEdit = false
      this.isEditMode = false

      this.createForm = {
        metadata: { name: '' },
        spec: {
          replicas: 1
        }
      }
      this.allContainers = [this.createContainer('container')]
      this.containerTab = 'container'
      this.createDialogVisible = true

      this.fetchPVCs()
      this.fetchCMs()
      this.fetchSecrets()
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
          requests: { cpu: '100m', memory: '128Mi' }, // 使用正确的单位
          limits: { cpu: '500m', memory: '512Mi' } // 使用正确的单位
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
    submitEditDeployment() {
      this.generateYamlFromForm()
      let parsed
      try {
        parsed = yaml.load(this.createYamlContent)
      } catch (err) {
        this.$message.error('YAML格式错误: ' + err.message)
        return
      }

      this.updateDeployment({
        wsName: this.selectedWorkspace,
        nsName: this.selectedNamespace,
        deployName: parsed.metadata.name,
        deploy: parsed
      })
        .then(() => {
          this.$message.success('更新成功')
          this.createDialogVisible = false
          this.fetchdeployments()
        })
        .catch(err => {
          this.$message.error('更新失败')
          console.error(err)
        })
    },
    async handleEdit(row) {
      this.isEdit = true
      this.isEditMode = true
      this.createTab = 'form'

      try {
        // 获取 deployment 详情
        const detail = await this.getDeploymentDetail({
          wsName: this.selectedWorkspace,
          nsName: this.selectedNamespace,
          deployName: row.metadata.name
        })

        // 同步 namespace
        this.selectedNamespace = detail.metadata.namespace

        // 解析 deployment 到表单
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

        // 确保每个容器都有正确的资源结构
        containers.forEach(c => {
          // 确保资源结构完整
          if (!c.resources) c.resources = {}
          if (!c.resources.requests) c.resources.requests = {}
          if (!c.resources.limits) c.resources.limits = {}

          this.pushContainerFromYaml(c, 'container', detail.spec.template.spec.volumes || [])
        })

        initContainers.forEach(c => {
          // 确保资源结构完整
          if (!c.resources) c.resources = {}
          if (!c.resources.requests) c.resources.requests = {}
          if (!c.resources.limits) c.resources.limits = {}

          this.pushContainerFromYaml(c, 'initContainer', detail.spec.template.spec.volumes || [])
        })

        // 打开弹窗
        this.createDialogVisible = true
        this.fetchPVCs()
        this.fetchCMs()
        this.fetchSecrets()
      } catch (err) {
        this.$message.error('获取 Deployment 详情失败')
        console.error(err)
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
            if (p.hostPort) portObj.hostPort = p.hostPort
            return portObj
          })

        if (clean.ports.length === 0) delete clean.ports

        // 处理挂载卷
        if (Array.isArray(container.volumeMounts)) {
          clean.volumeMounts = []

          container.volumeMounts.forEach(m => {
            let volumeName = ''

            if (m.mountType === 'pvc') {
              // PVC挂载
              volumeName = `pvc-${m.pvcName}`

              // 添加到 volumes 列表（避免重复）
              if (!volumes.find(v => v.name === volumeName)) {
                volumes.push({
                  name: volumeName,
                  persistentVolumeClaim: { claimName: m.pvcName }
                })
              }
            } else if (m.mountType === 'configMap') {
              // ConfigMap挂载
              volumeName = `configmap-${m.configMapName}`

              if (!volumes.find(v => v.name === volumeName)) {
                volumes.push({
                  name: volumeName,
                  configMap: { name: m.configMapName }
                })
              }
            } else if (m.mountType === 'secret') {
              // Secret挂载
              volumeName = `secret-${m.secretName}`

              if (!volumes.find(v => v.name === volumeName)) {
                volumes.push({
                  name: volumeName,
                  secret: { secretName: m.secretName }
                })
              }
            } else if (m.mountType === 'hostPath') {
              // HostPath挂载
              volumeName = `hostpath-${m.hostPath.replace(/\//g, '-')}` // 用路径来生成名称，替换/为-

              if (!volumes.find(v => v.name === volumeName)) {
                const hostPathVolume = {
                  name: volumeName,
                  hostPath: {
                    path: m.hostPath
                  }
                }

                if (m.hostPathType) {
                  hostPathVolume.hostPath.type = m.hostPathType
                }

                volumes.push(hostPathVolume)
              }
            } else if (m.mountType === 'emptyDir') {
              // EmptyDir挂载
              volumeName = `emptydir-${Math.random().toString(36).substr(2, 9)}` // 生成随机名称

              if (!volumes.find(v => v.name === volumeName)) {
                const emptyDirVolume = {
                  name: volumeName,
                  emptyDir: {}
                }

                if (m.medium) {
                  emptyDirVolume.emptyDir.medium = m.medium
                }

                if (m.sizeLimit) {
                  emptyDirVolume.emptyDir.sizeLimit = m.sizeLimit
                }

                volumes.push(emptyDirVolume)
              }
            }

            // 创建挂载配置
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

      const deployment = {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
          name: appName,
          namespace: this.selectedNamespace,
          labels: { app: appName, 'app.kubernetes.io/component': 'deployment' }
        },
        spec: {
          replicas: this.createForm.spec.replicas,
          selector: {
            matchLabels: { app: appName, 'app.kubernetes.io/component': 'deployment' }
          },
          template: {
            metadata: {
              labels: { app: appName, 'app.kubernetes.io/component': 'deployment' }
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
        // ✅ 核心修正：从 monaco-editor 中取值，而不是 this.createYamlContent
        const editorValue = this.$refs.createEditor?.editor?.getValue?.()
        const parsed = yaml.load(editorValue)

        this.isYamlModified = false
        this.lastYamlContent = editorValue // ⚠️ 同步到最新内容
        this.createYamlContent = editorValue // 🔁 保持内容同步，避免切回时跳变

        const form = safeParseForm(parsed)

        // 同步 namespace 到页面的绑定变量
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
        containers.forEach(c => this.pushContainerFromYaml(c, 'container'))
        initContainers.forEach(c => this.pushContainerFromYaml(c, 'initContainer'))
        this.$message.success('已同步回表单模式')
      } catch (err) {
        this.$message.error('YAML 解析失败：' + err.message)
        console.error(err)
      }
    },

    onCreateDialogOpened() {
      if (this.createTab === 'yaml') {
        this.generateYamlFromForm()
      }
    },
    handleTabClick(tab) {
      if (tab.name === 'yaml') {
        this.generateYamlFromForm()
        this.lastYamlContent = this.createYamlContent
        this.isYamlModified = false
      } else {
        const editorValue = this.$refs.createEditor?.editor?.getValue?.()
        if (editorValue !== this.lastYamlContent) {
          this.parseYamlToForm()
          this.isYamlModified = true
        }
      }
    },
    async handleSubmit() {
      this.generateYamlFromForm()
      let parsed

      try {
        parsed = yaml.load(this.createYamlContent)
      } catch (err) {
        this.$message.error('YAML 格式错误: ' + err.message)
        return
      }

      const payload = {
        wsName: this.selectedWorkspace,
        nsName: this.selectedNamespace,
        deployName: parsed.metadata.name,
        deploy: parsed
      }

      const action = this.isEdit ? this.updateDeployment : this.createDeployment
      const actionLabel = this.isEdit ? '更新' : '创建'

      try {
        await action(payload)
        this.$message.success(`${actionLabel}成功`)
        this.createDialogVisible = false
    this.fetchdeployments?.()
      } catch (err) {
        this.$message.error(`${actionLabel}失败`)
        console.error(err)
      }
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
    // 获取PVC、configmap和secret列表
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

    async fetchCMs() {
      if (!this.selectedWorkspace || !this.selectedNamespace) return
      try {
        this.configMapList = await this.getConfigmap({ wsName: this.selectedWorkspace, nsName: this.selectedNamespace })
        console.log('获取到的configmap', this.configMapList)
      } catch (error) {
        console.error('获取configmap列表失败:', error)
        this.configMapList = []
      }
    },
    async fetchSecrets() {
      if (!this.selectedWorkspace || !this.selectedNamespace) return
      try {
        this.secretList = await this.getSecrets({ wsName: this.selectedWorkspace, nsName: this.selectedNamespace })
        console.log('获取到的secret', this.secretList)
      } catch (error) {
        console.error('获取secret列表失败:', error)
        this.secretList = []
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
        mountType: 'configMap' | 'secret' | 'pvc', // pvc | configMap | secret
        mountPath: '', // 容器内的路径（完整路径，支持 /etc/foo/key.txt）
        key: '', // 仅对 configMap/secret 有效，要挂载的键名
        subPath: '', // 最终文件名（可自动设为 key）
        readOnly: false,
        pvcName: '',
        configMapName: '',
        secretName: '',
        availableKeys: [] // 用于存储可选的 key 下拉
      })
    },
    removeVolumeMount(container, index) {
      container.volumeMounts.splice(index, 1)
    },
    addMount(container) {
      if (!container.volumeMounts) this.$set(container, 'volumeMounts', [])
      const newMount = {
        mountType: 'pvc',
        pvcName: '',
        configMapName: '',
        secretName: '',
        hostPath: '',
        hostPathType: '',
        medium: '',
        sizeLimit: '',
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

/* .table-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
} */
.table-container {
  flex: 1;
  overflow-x: auto;
  overflow-y: auto;
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
  gap: 1px;
  flex-wrap: wrap; /* 小屏时自动换行 */
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
