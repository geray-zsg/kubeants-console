<template>
  <div class="service-page">
    <!-- 顶部过滤 -->
    <div class="filters">
      <span class="filter-label">工作空间：</span>
      <el-select v-model="selectedWorkspace" placeholder="选择工作空间" @change="onWorkspaceChange">
        <el-option v-for="ws in workspaces" :key="ws.name" :label="ws.name" :value="ws.name" />
      </el-select>

      <span class="filter-label">命名空间：</span>
      <el-select
        v-model="selectedNamespace"
        placeholder="选择命名空间"
        style="margin-left: 10px"
        @change="fetchServices"
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
        placeholder="搜索服务"
        style="margin-left: 20px; width: 300px"
        clearable
      />

      <el-button
        type="primary"
        icon="el-icon-plus"
        style="margin-left: auto"
        @click="openCreateDialog"
      >
        新建 Service
      </el-button>
    </div>

    <!-- 二级操作栏 -->
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

    <!-- 列表 -->
    <div class="table-container">
      <el-table
        v-loading="loading"
        :data="pagedServices || []"
        border
        style="flex: 1; overflow: auto"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="metadata.name" label="名称" width="360" />
        <el-table-column prop="spec.type" label="类型" width="120">
          <template v-slot="{ row }">
            <el-tag :type="getTypeTagType(row.spec.type)" size="small">
              {{ row.spec.type || 'ClusterIP' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="集群IP" width="160">
          <template v-slot="{ row }">
            {{ row.spec.clusterIP || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="外部IP" width="200">
          <template v-slot="{ row }">
            {{ getExternalIP(row) }}
          </template>
        </el-table-column>
        <el-table-column label="端口" width="220">
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
              <el-button size="small" type="primary" @click="handleEdit(row)">编辑</el-button>
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

    <!-- YAML 详情（原有） -->
    <el-dialog
      title="服务详情"
      :visible.sync="showYamlDialog"
      width="70%"
      @opened="refreshMonacoEditor"
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
    </el-dialog>

    <!-- 创建 Service 弹窗 -->
    <el-dialog
      :title="isEdit ? '编辑 Service' : '创建 Service'"
      :visible.sync="createDialogVisible"
      width="900px"
      :close-on-click-modal="false"
      @closed="resetCreateDialog"
    >
      <el-tabs v-model="createActiveTab" @tab-click="syncOnTabSwitch">
        <!-- 表单模式 -->
        <el-tab-pane label="表单模式" name="form">
          <el-form
            ref="svcFormRef"
            :model="svcForm"
            :rules="svcRules"
            label-width="120px"
            label-position="left"
          >
            <el-form-item label="名称" prop="name">
              <el-input v-model="svcForm.name" placeholder="如：my-service" />
            </el-form-item>

            <!-- 关联工作负载（可选） -->
            <el-form-item label="指定工作负载">
              <div class="wl-row">
                <el-select
                  v-model="workload.kind"
                  placeholder="选择类型"
                  style="width: 160px"
                  @change="onWorkloadKindChange"
                >
                  <el-option label="Deployment" value="Deployment" />
                  <el-option label="StatefulSet" value="StatefulSet" />
                  <el-option label="DaemonSet" value="DaemonSet" />
                </el-select>
                <el-select
                  v-model="workload.name"
                  :disabled="!workload.kind || workloadOptions.length === 0"
                  placeholder="选择工作负载"
                  filterable
                  style="width: 260px; margin-left: 8px"
                  @change="applySelectorFromWorkload"
                >
                  <el-option
                    v-for="w in workloadOptions"
                    :key="w.metadata.name"
                    :label="w.metadata.name"
                    :value="w.metadata.name"
                  />
                </el-select>
                <el-button
                  style="margin-left: 8px"
                  :disabled="!workload.kind"
                  @click="fetchWorkloads"
                >
                  刷新
                </el-button>
              </div>
              <div class="form-tip">选择工作负载后会自动将其 Pod 标签作为 Service 的 selector（仍可手动编辑）</div>
            </el-form-item>

            <!-- selector（kv 行编辑） -->
            <el-form-item label="选择器（Selector）">
              <div v-for="(pair, i) in svcForm.selector" :key="'sel-' + i" class="kv-row">
                <el-input v-model="pair.key" placeholder="key，如 app" style="width: 40%" />
                <el-input v-model="pair.value" placeholder="value，如 web" style="width: 40%; margin-left: 8px" />
                <el-button
                  icon="el-icon-delete"
                  type="danger"
                  circle
                  size="mini"
                  style="margin-left: 8px"
                  @click="removeSelector(i)"
                />
              </div>
              <el-button type="primary" icon="el-icon-plus" @click="addSelector">添加选择器</el-button>
            </el-form-item>

            <!-- 访问类型 -->
            <el-form-item label="访问模式（Type）" prop="type">
              <el-radio-group v-model="svcForm.type" @change="onTypeChange">
                <el-radio label="ClusterIP">ClusterIP</el-radio>
                <el-radio label="NodePort">NodePort</el-radio>
                <el-radio label="LoadBalancer">LoadBalancer</el-radio>
              </el-radio-group>
            </el-form-item>

            <!-- 会话保持 -->
            <el-form-item label="会话保持（SessionAffinity）">
              <el-radio-group v-model="svcForm.sessionAffinity">
                <el-radio label="None">None</el-radio>
                <el-radio label="ClientIP">ClientIP</el-radio>
              </el-radio-group>
              <div v-if="svcForm.sessionAffinity === 'ClientIP'" class="form-tip">
                将在 spec.sessionAffinityConfig.clientIP.timeoutSeconds 使用默认值（10800）。如需自定义可在 YAML 模式调整。
              </div>
            </el-form-item>

            <!-- 端口（多行） -->
            <el-form-item label="端口" required>
              <div v-for="(p, idx) in svcForm.ports" :key="'port-'+idx" class="port-row">
                <el-input v-model="p.name" placeholder="名称（可选）" style="width: 160px; margin-left: 8px" />
                <el-select v-model="p.protocol" placeholder="协议" style="width: 120px; margin-left: 8px">
                  <el-option label="TCP" value="TCP" />
                  <el-option label="UDP" value="UDP" />
                  <el-option label="SCTP" value="SCTP" />
                </el-select>
                <el-input v-model.number="p.port" placeholder="port" style="width: 90px" />
                <el-input v-model="p.targetPort" placeholder="targetPort（数字或名称）" style="width: 160px; margin-left: 8px" />
                <el-input
                  v-if="svcForm.type === 'NodePort' || svcForm.type === 'LoadBalancer'"
                  v-model.number="p.nodePort"
                  placeholder="nodePort（可选）"
                  style="width: 140px; margin-left: 8px"
                />
                <el-button
                  icon="el-icon-delete"
                  type="danger"
                  circle
                  size="mini"
                  style="margin-left: 8px"
                  @click="removePort(idx)"
                />
              </div>
              <el-button type="primary" icon="el-icon-plus" @click="addPort">添加端口</el-button>
            </el-form-item>

            <!-- 标签（kv 行编辑） -->
            <el-form-item label="标签（Labels）">
              <div v-for="(pair, i) in svcForm.labels" :key="'lbl-' + i" class="kv-row">
                <el-input v-model="pair.key" placeholder="key" style="width: 40%" />
                <el-input v-model="pair.value" placeholder="value" style="width: 40%; margin-left: 8px" />
                <el-button
                  icon="el-icon-delete"
                  type="danger"
                  circle
                  size="mini"
                  style="margin-left: 8px"
                  @click="removeLabel(i)"
                />
              </div>
              <el-button type="primary" icon="el-icon-plus" @click="addLabel">添加标签</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- YAML 模式 -->
        <el-tab-pane label="YAML 模式" name="yaml">
          <div style="height: 420px; border: 1px solid #dcdfe6; border-radius: 4px">
            <monaco-editor
              ref="yamlEditor"
              v-model="createYamlContent"
              language="yaml"
              theme="vs-dark"
              :options="yamlEditorOptions"
            />
          </div>
          <div v-if="yamlError" class="yaml-error">{{ yamlError }}</div>
        </el-tab-pane>
      </el-tabs>

      <span slot="footer">
        <el-button @click="createDialogVisible = false">取 消</el-button>
        <el-button type="primary" :loading="createLoading" @click="isEdit ? submitUpdate() : submitCreate()">
          {{ isEdit ? '保 存' : '确 定' }}
        </el-button>
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
      // 列表筛选
      selectedWorkspace: '',
      selectedNamespace: '',
      searchText: '',
      loading: false,
      selectedServices: [],
      pageSize: 10,
      currentPage: 1,
      selectedType: '',

      // 详情 YAML
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

      // 创建弹窗
      createDialogVisible: false,
      createActiveTab: 'form',
      createLoading: false,
      createYamlContent: '', // YAML 文本
      yamlError: '', // YAML 解析错误
      syncingFrom: '', // '' | 'form' | 'yaml' —— 防止循环同步

      // 表单数据（更适合维护）
      svcForm: {
        name: '',
        type: 'ClusterIP',
        sessionAffinity: 'None',
        selector: [{ key: '', value: '' }],
        ports: [{ name: '', port: null, targetPort: '', protocol: 'TCP', nodePort: null }],
        labels: [{ key: '', value: '' }]
      },
      svcRules: {
        name: [
          { required: true, message: '名称不能为空', trigger: 'blur' },
          { pattern: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/, message: 'DNS-1123 子域名规则', trigger: 'blur' }
        ],
        type: [{ required: true, message: '请选择类型', trigger: 'change' }]
      },
      yamlEditorOptions: {
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: 'on',
        folding: true,
        wordWrap: 'on'
      },

      // 工作负载选择
      workload: { kind: '', name: '' },
      workloadOptions: [], // 当前命名空间下的 workloads 列表
      isEdit: false, // 是否编辑模式
      editingServiceName: '' // 编辑的 service 名称
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
      this.services.forEach(svc => {
        const type = svc.spec?.type || 'ClusterIP'
        counts[type] = (counts[type] || 0) + 1
      })
      return counts
    },
    filteredServicesByType() {
      if (!this.selectedType) return this.filteredServices
      return this.filteredServices.filter(svc => (svc.spec?.type || 'ClusterIP') === this.selectedType)
    },
    pagedServices() {
      const start = (this.currentPage - 1) * this.pageSize
      return this.filteredServicesByType.slice(start, start + this.pageSize)
    }
  },
  watch: {
    createYamlContent(val) {
      if (this.syncingFrom === 'form') return
      this.syncingFrom = 'yaml'
      try {
        this.applyYamlToForm(val, { silentError: true })
      } finally {
        setTimeout(() => { this.syncingFrom = '' }, 0)
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
    ...mapActions('services', [
      'getServices',
      'getServicesDetail',
      'deleteServices',
      'updateService',
      'createService'
    ]),

    /* ========== 列表相关 ========== */
    handleSelectionChange(val) {
      this.selectedServices = val
    },
    handlePageChange(page) {
      this.currentPage = page
    },
    handleSizeChange(size) {
      this.pageSize = size
      this.currentPage = 1
    },
    handleTypeFilterChange(val) {
      this.selectedType = val
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
    async handleBatchDelete() {
      if (this.selectedServices.length === 0) {
        this.$message.warning('请先选择要删除的服务')
        return
      }
      this.$confirm(`确认删除选中的 ${this.selectedServices.length} 个服务？`, '提示', { type: 'warning' }).then(async() => {
        const tasks = this.selectedServices.map(svc =>
          this.deleteServices({
            wsName: this.selectedWorkspace,
            nsName: this.selectedNamespace,
            svcName: svc.metadata.name
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
    formatDate(dateStr) {
      if (!dateStr) return '-'
      return new Date(dateStr).toLocaleString()
    },
    refreshMonacoEditor() {
      this.$nextTick(() => {
        this.$refs.yamlViewer?.editor?.layout()
      })
    },
    getTypeTagType(type) {
      switch (type) {
        case 'ClusterIP': return 'success'
        case 'NodePort': return 'warning'
        case 'LoadBalancer': return 'primary'
        case 'ExternalName': return 'info'
        default: return ''
      }
    },
    getExternalIP(service) {
      if (service.spec?.type === 'LoadBalancer') {
        if (service.status?.loadBalancer?.ingress?.length) {
          return service.status.loadBalancer.ingress
            .map(item => item.ip || item.hostname)
            .join(', ')
        }
      }
      return service.spec?.externalIPs?.join(', ') || '-'
    },
    formatPorts(ports) {
      if (!ports) return '-'
      return ports.map(p => {
        const lhs = p.name ? `${p.name}:` : ''
        const core = `${p.port}${p.targetPort ? `:${p.targetPort}` : ''}/${p.protocol || 'TCP'}`
        const np = p.nodePort ? ` (nodePort:${p.nodePort})` : ''
        return `${lhs}${core}${np}`
      }).join(', ')
    },

    /* ========== 创建弹窗 ========== */
    openCreateDialog() {
      this.resetCreateDialog()
      this.createDialogVisible = true
    },
    resetCreateDialog() {
      this.yamlError = ''
      this.syncingFrom = ''
      this.createActiveTab = 'form'
      this.workload = { kind: '', name: '' }
      this.workloadOptions = []
      this.isEdit = false
      this.editingServiceName = ''

      // 重置表单
      this.svcForm = {
        name: '',
        type: 'ClusterIP',
        sessionAffinity: 'None',
        selector: [{ key: '', value: '' }],
        ports: [{ name: '', port: null, targetPort: '80', protocol: 'TCP', nodePort: null }],
        labels: [{ key: '', value: '' }]
      }

      // 直接生成默认 YAML 模板
      this.createYamlContent = this.dumpYamlFromForm()
    },

    // 表单 -> manifest -> YAML
    dumpYamlFromForm() {
      const sel = {}
      this.svcForm.selector?.forEach(x => {
        if (x.key && x.value) sel[x.key] = String(x.value)
      })

      const labels = {}
      this.svcForm.labels?.forEach(x => {
        if (x.key) labels[x.key] = String(x.value || '')
      })

      const ports = (this.svcForm.ports || []).length
        ? this.svcForm.ports.filter(p => p.port).map(p => {
          // 处理targetPort，确保是数字或字符串
          let targetPort = p.targetPort || '80'
          // 如果是数字字符串，转换为数字
          if (typeof targetPort === 'string' && !isNaN(targetPort) && targetPort.trim() !== '') {
            targetPort = parseInt(targetPort, 10)
          }

          const portObj = {
            name: p.name || undefined,
            port: Number(p.port) || 80,
            targetPort: targetPort,
            protocol: p.protocol || 'TCP'
          }

          // 只有NodePort和LoadBalancer类型才有nodePort
          if ((this.svcForm.type === 'NodePort' || this.svcForm.type === 'LoadBalancer') && p.nodePort) {
            portObj.nodePort = Number(p.nodePort)
          }

          return portObj
        })
        : [{ port: 80, targetPort: 80, protocol: 'TCP' }]

      return yaml.dump({
        apiVersion: 'v1',
        kind: 'Service',
        metadata: {
          name: this.svcForm.name || 'my-service',
          namespace: this.selectedNamespace,
          labels
        },
        spec: {
          type: this.svcForm.type || 'ClusterIP',
          sessionAffinity: this.svcForm.sessionAffinity || 'None',
          selector: Object.keys(sel).length ? sel : { app: this.svcForm.name || 'my-service' },
          ports
        }
      })
    },

    // YAML -> 表单
    applyYamlToForm(text, { silentError = false } = {}) {
      try {
        const obj = yaml.load(text) || {}
        if (!obj || obj.kind !== 'Service') throw new Error('YAML 必须是 kind: Service')

        const meta = obj.metadata || {}
        const spec = obj.spec || {}

        // labels
        const labels = meta.labels || {}
        const labelArr = Object.keys(labels).length
          ? Object.keys(labels).map(k => ({ key: k, value: labels[k] }))
          : [{ key: '', value: '' }]

        // selector
        const selector = spec.selector || {}
        const selArr = Object.keys(selector).length
          ? Object.keys(selector).map(k => ({ key: k, value: selector[k] }))
          : [{ key: '', value: '' }]

        // ports
        const ports = Array.isArray(spec.ports) ? spec.ports : []
        const portArr = ports.length
          ? ports.map(p => ({
            name: p.name || '',
            port: p.port || null,
            targetPort: (p.targetPort === 0 || p.targetPort) ? p.targetPort.toString() : '80',
            protocol: p.protocol || 'TCP',
            nodePort: p.nodePort || null
          }))
          : [{ name: '', port: null, targetPort: '80', protocol: 'TCP', nodePort: null }]

        this.svcForm = {
          name: meta.name || '',
          type: spec.type || 'ClusterIP',
          sessionAffinity: spec.sessionAffinity || 'None',
          selector: selArr,
          ports: portArr,
          labels: labelArr
        }

        this.yamlError = ''
      } catch (e) {
        if (!silentError) {
          this.yamlError = 'YAML 解析失败：' + e.message
        }
      }
    },

    // YAML 编辑触发
    onYamlChange() {
      if (this.syncingFrom === 'form') return
      this.syncingFrom = 'yaml'
      try {
        this.applyYamlToForm(this.createYamlContent)
      } finally {
        // 小延迟再释放，避免 Monaco 输入中频繁切换
        setTimeout(() => { this.syncingFrom = '' }, 0)
      }
    },

    // 表单项变化时手动调用（关键节点）
    onTypeChange() {
      this.syncFromForm()
    },
    syncFromForm() {
      if (this.syncingFrom === 'yaml') return
      this.syncingFrom = 'form'
      try {
        this.createYamlContent = this.dumpYamlFromForm()
        this.yamlError = ''
      } finally {
        setTimeout(() => { this.syncingFrom = '' }, 0)
      }
    },

    // 切换 Tab 时，做一次同步，确保显示的一侧是最新
    syncOnTabSwitch() {
      if (this.createActiveTab === 'yaml') {
        if (!this.createYamlContent.trim()) {
          this.createYamlContent = this.dumpYamlFromForm()
        }
      } else {
        this.applyYamlToForm(this.createYamlContent, { silentError: true })
      }
    },

    // Selector & Label & Ports 行编辑
    addSelector() { this.svcForm.selector.push({ key: '', value: '' }); this.syncFromForm() },
    removeSelector(i) { this.svcForm.selector.splice(i, 1); if (!this.svcForm.selector.length) this.addSelector(); this.syncFromForm() },

    addLabel() { this.svcForm.labels.push({ key: '', value: '' }); this.syncFromForm() },
    removeLabel(i) { this.svcForm.labels.splice(i, 1); if (!this.svcForm.labels.length) this.addLabel(); this.syncFromForm() },

    addPort() { this.svcForm.ports.push({ name: '', port: null, targetPort: '80', protocol: 'TCP', nodePort: null }); this.syncFromForm() },
    removePort(i) { this.svcForm.ports.splice(i, 1); if (!this.svcForm.ports.length) this.addPort(); this.syncFromForm() },

    /* ========== 工作负载联动（可选） ========== */
    async fetchWorkloads() {
      if (!this.workload.kind) return

      try {
        let res = []

        switch (this.workload.kind) {
          case 'Deployment':
            res = await this.$store.dispatch('deployments/getDeployment', {
              wsName: this.selectedWorkspace,
              nsName: this.selectedNamespace
            })
            break
          case 'StatefulSet':
            res = await this.$store.dispatch('statefulsets/getStatefulsets', {
              wsName: this.selectedWorkspace,
              nsName: this.selectedNamespace
            })
            break
          case 'DaemonSet':
            res = await this.$store.dispatch('daemonsets/getDaemonsets', {
              wsName: this.selectedWorkspace,
              nsName: this.selectedNamespace
            })
            break
          default:
            res = []
            break
        }

        this.workloadOptions = res || []
      } catch (e) {
        this.workloadOptions = []
        this.$message.warning('加载工作负载失败，可手动编辑 Selector')
      }
    },
    onWorkloadKindChange() {
      this.workload.name = ''
      this.workloadOptions = []
      if (this.workload.kind) this.fetchWorkloads()
    },
    applySelectorFromWorkload() {
      const w = this.workloadOptions.find(x => x.metadata?.name === this.workload.name)
      const podLabels = w?.spec?.template?.metadata?.labels || {}
      const sel = Object.keys(podLabels).map(k => ({ key: k, value: podLabels[k] }))
      this.svcForm.selector = sel.length ? sel : [{ key: '', value: '' }]
      this.syncFromForm()
    },

    /* ========== 提交创建 ========== */
    submitCreate() {
      // 表单校验（即使 YAML 模式下，也先用 YAML -> 表单一次，保证数据合法）
      if (this.createActiveTab === 'yaml') {
        // 先把 YAML 应用到表单
        const okBefore = !this.yamlError
        this.applyYamlToForm(this.createYamlContent)
        if (!okBefore && this.yamlError) {
          this.$message.error('YAML 格式有误，请修正后再提交')
          return
        }
      }

      // 验证端口
      for (let i = 0; i < this.svcForm.ports.length; i++) {
        const p = this.svcForm.ports[i]
        if (!p.port) {
          this.$message.error(`第${i + 1}个端口的端口号（port）不能为空`)
          return
        }
        if (!p.targetPort) {
          this.$message.error(`第${i + 1}个端口的目标端口（targetPort）不能为空`)
          return
        }
      }

      this.$refs.svcFormRef.validate(async(valid) => {
        if (!valid) return

        this.createLoading = true
        try {
          // 用表单再生成一次 YAML -> 对象，确保一致性
          const manifest = yaml.load(this.dumpYamlFromForm())

          await this.$store.dispatch('services/createServices', {
            wsName: this.selectedWorkspace,
            nsName: this.selectedNamespace,
            svcObj: manifest
          })

          this.$message.success('创建成功')
          this.createDialogVisible = false
          this.fetchServices()
        } catch (e) {
          this.$message.error('创建失败：' + (e.response?.data?.message || e.message))
        } finally {
          this.createLoading = false
        }
      })
    },
    async handleEdit(row) {
      try {
        const res = await this.getServicesDetail({
          wsName: this.selectedWorkspace,
          nsName: this.selectedNamespace,
          svcName: row.metadata.name
        })
        // YAML
        this.createYamlContent = yaml.dump(res)
        // 表单
        this.applyYamlToForm(this.createYamlContent)

        this.isEdit = true
        this.editingServiceName = row.metadata.name
        this.createDialogVisible = true
      } catch (err) {
        this.$message.error('加载 Service 详情失败')
        console.error(err)
      }
    },
    submitUpdate() {
      if (this.createActiveTab === 'yaml') {
        const okBefore = !this.yamlError
        this.applyYamlToForm(this.createYamlContent)
        if (!okBefore && this.yamlError) {
          this.$message.error('YAML 格式有误，请修正后再提交')
          return
        }
      }

      // 验证端口
      for (let i = 0; i < this.svcForm.ports.length; i++) {
        const p = this.svcForm.ports[i]
        if (!p.port) {
          this.$message.error(`第${i + 1}个端口的端口号（port）不能为空`)
          return
        }
        if (!p.targetPort) {
          this.$message.error(`第${i + 1}个端口的目标端口（targetPort）不能为空`)
          return
        }
      }

      this.$refs.svcFormRef.validate(async(valid) => {
        if (!valid) return
        this.createLoading = true
        try {
          const manifest = yaml.load(this.dumpYamlFromForm())

          await this.$store.dispatch('services/updateService', {
            wsName: this.selectedWorkspace,
            nsName: this.selectedNamespace,
            svcName: this.editingServiceName,
            svcObj: manifest
          })

          this.$message.success('更新成功')
          this.createDialogVisible = false
          this.fetchServices()
        } catch (e) {
          this.$message.error('更新失败：' + (e.response?.data?.message || e.message))
        } finally {
          this.createLoading = false
        }
      })
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
.actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 12px 0;
}
.table-container {
  flex: 1;
  overflow-x: auto;
}
.action-buttons {
  display: flex;
  gap: 8px;
}

.wl-row { display: flex; align-items: center; gap: 8px; }
.kv-row { display: flex; align-items: center; margin-bottom: 8px; }
.port-row { display: flex; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }

.form-tip { color: #909399; font-size: 12px; margin-top: 4px; }
.yaml-error { color: #f56c6c; margin-top: 8px; }
</style>
