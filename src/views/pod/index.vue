<template>
  <div class="secret-page">
    <div class="filters">
      <span class="filter-label">工作空间：</span>
      <el-select v-model="selectedWorkspace" placeholder="选择工作空间" @change="onWorkspaceChange">
        <el-option v-for="ws in workspaces" :key="ws.name" :label="ws.name" :value="ws.name" />
      </el-select>

      <span class="filter-label">命名空间：</span>
      <el-select v-model="selectedNamespace" placeholder="选择命名空间" style="margin-left: 10px" @change="fetchPods">
        <el-option v-for="ns in filteredNamespaces" :key="ns.metadata.name" :label="ns.metadata.name" :value="ns.metadata.name" />
      </el-select>

      <el-input
        v-model="searchText"
        placeholder="搜索容器组"
        style="margin-left: 20px; width: 300px"
        clearable
      />
    </div>

    <!-- 操作栏：批量删除 + 状态筛选 -->
    <div class="actions">
      <el-button
        type="danger"
        size="mini"
        :disabled="selectedPods.length === 0"
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
      <el-table v-loading="loading" :data="pagedPods || []" border style="flex: 1; overflow: auto" @selection-change="handleSelectionChange">
        <!-- 多选框 -->
        <el-table-column type="selection" width="55" />
        <el-table-column prop="metadata.name" label="名称" width="400" />
        <el-table-column prop="status.phase" label="状态" width="120">
          <template v-slot="{ row }">
            <el-tag :type="getStatusTagType(row.status.phase)" size="small">
              {{ row.status.phase }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="spec.nodeName" label="节点" width="200" />
        <el-table-column prop="status.podIP" label="容器组IP" width="160" />
        <el-table-column prop="metadata.creationTimestamp" label="创建时间" width="180">
          <template v-slot="{ row }">
            {{ formatDate(row.metadata.creationTimestamp) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="350" align="center">
          <template v-slot="{ row }">
            <div class="action-buttons">
              <el-button size="small" text @click="handleView(row)">详情</el-button>
              <!-- <el-button size="small" type="primary" @click="handleEdit(row)">编辑</el-button> -->
              <el-button size="small" type="primary" @click="logView(row)">日志</el-button>
              <el-button size="small" type="primary" @click="exec(row)">终端</el-button>
              <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无容器组数据" />
        </template>
      </el-table>
      <!-- 分页 -->
      <!-- 增强的分页组件 -->
      <el-pagination
        background
        layout="total, sizes, prev, pager, next"
        :current-page="currentPage"
        :page-sizes="[10, 20, 50, 100, 500]"
        :page-size="pageSize"
        :total="filteredPodsByStatus.length"
        style="margin-top: 16px; text-align: right"
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </div>

    <el-dialog title="容器组详情" :visible.sync="showYamlDialog" width="70%" @opened="refreshMonacoEditor">
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

    <!-- 日志弹窗 -->
    <el-dialog title="Pod 日志" :visible.sync="logDialogVisible" width="80%">
      <div style="display: flex; justify-content: space-between; margin-bottom: 10px">
        <el-select v-model="selectedContainer" placeholder="选择容器" @change="handleContainerChange">
          <el-option v-for="item in containers" :key="item" :label="item" :value="item" />
        </el-select>
        <el-button type="primary" icon="el-icon-refresh" @click="fetchLogText">刷新日志</el-button>
      </div>
      <!-- 下载按钮 -->
      <el-button size="small" type="success" @click="downloadLogs">下载日志</el-button>

      <el-input
        v-model="logText"
        type="textarea"
        :rows="20"
        resize="none"
        readonly
        style="margin-top: 10px"
      />
    </el-dialog>

    <!-- 终端弹窗 -->
    <el-dialog title="容器终端" :visible.sync="terminalDialogVisible" width="80%" @opened="onTerminalDialogOpen">
      <el-select v-model="selectedContainer" placeholder="选择容器" @change="onContainerChange">
        <el-option v-for="item in containers" :key="item" :label="item" :value="item" />
      </el-select>
      <div id="terminal" style="height: 400px; margin-top: 10px; background: black;" />
    </el-dialog>
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'
// import { generateExecWsUrl } from '@/api/pods'
// import { getToken } from '@/utils/auth' // get token from cookie
import MonacoEditor from 'vue-monaco-editor'
import yaml from 'js-yaml'
import { Terminal } from 'xterm'
import 'xterm/css/xterm.css'

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
        readOnly: false,
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: 'on',
        folding: true,
        wordWrap: 'on'
      },
      loading: false,
      selectedPods: [],
      pageSize: 10,
      currentPage: 1,
      selectedStatus: '',
      logDialogVisible: false,
      terminalDialogVisible: false,
      logText: '',
      containers: [],
      selectedContainer: '',
      currentPod: null,
      terminal: null,
      socket: null,
      // hasInitializedTerminal: false // 初始化表示（容器终端）
      terminalInitialized: false // 新增标记
    }
  },
  computed: {
    ...mapGetters('dashboard', ['workspaces']),
    ...mapGetters('workspace', ['namespaces']),
    ...mapGetters('pods', ['pods']),
    filteredNamespaces() {
      return this.namespaces.filter(ns => ns.metadata.labels?.['kubeants.io/workspace'] === this.selectedWorkspace)
    },
    filteredPods() {
      return this.searchText
        ? this.pods.filter(p => p.metadata.name.includes(this.searchText))
        : this.pods
    },
    statusCounts() {
      const counts = {}
      this.pods.forEach(pod => {
        const phase = pod.status?.phase || 'Unknown'
        counts[phase] = (counts[phase] || 0) + 1
      })
      return counts
    },
    filteredPodsByStatus() {
      if (!this.selectedStatus) return this.filteredPods
      return this.filteredPods.filter(pod => pod.status?.phase === this.selectedStatus)
    },
    pagedPods() {
      const start = (this.currentPage - 1) * this.pageSize
      return this.filteredPodsByStatus.slice(start, start + this.pageSize)
    }
  },
  watch: {
    filteredPodsByStatus() {
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
    ...mapActions('pods', [
      'getPod',
      'getPodDetail',
      'createPod',
      'deletePod',
      'getPodLogs'
    ]),
    // 新增分页大小改变处理方法
    handleSizeChange(size) {
      this.pageSize = size
      this.currentPage = 1 // 重置到第一页
    },
    async onWorkspaceChange() {
      this.selectedNamespace = ''
      await this.getNamespaces(this.selectedWorkspace)
      const filtered = this.filteredNamespaces
      if (filtered.length > 0) {
        this.selectedNamespace = filtered[0].metadata.name
        this.fetchPods()
      }
    },
    async fetchPods() {
      if (!this.selectedWorkspace || !this.selectedNamespace) return
      this.loading = true
      try {
        await this.getPod({ wsName: this.selectedWorkspace, nsName: this.selectedNamespace })
      } finally {
        this.loading = false
      }
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
    async submitCreatePod() {
      this.generateYamlFromForm(false)
      let pod
      try {
        pod = yaml.load(this.createYamlContent)
      } catch (err) {
        this.$message.error('YAML 格式错误：' + err.message)
        return
      }

      try {
        await this.createPod({
          wsName: this.selectedWorkspace,
          nsName: this.selectedNamespace,
          podName: pod.metadata.name,
          pod
        })
        this.$message.success('创建成功')
        this.createDialogVisible = false
        this.fetchPods()
      } catch (err) {
        this.$message.error('创建失败')
        console.error(err)
      }
    },
    formatDate(dateStr) {
      if (!dateStr) return '-'
      return new Date(dateStr).toLocaleString()
    },
    async handleDelete(row) {
      this.$confirm(`确认删除容器组 [${row.metadata.name}]？`, '提示', { type: 'warning' }).then(async() => {
        await this.deletePod({ wsName: this.selectedWorkspace, nsName: this.selectedNamespace, podName: row.metadata.name })
        this.fetchPods()
        this.$message.success('删除成功')
      })
    },
    async handleView(row) {
      try {
        const res = await this.getPodDetail({
          wsName: this.selectedWorkspace,
          nsName: this.selectedNamespace,
          podName: row.metadata.name
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

    async handleBatchDelete() {
      if (this.selectedPods.length === 0) {
        this.$message.warning('请先选择要删除的 Pod')
        return
      }

      this.$confirm(`确认删除选中的 ${this.selectedPods.length} 个 Pod？`, '提示', { type: 'warning' }).then(async() => {
        const tasks = this.selectedPods.map(pod =>
          this.deletePod({
            wsName: this.selectedWorkspace,
            nsName: this.selectedNamespace,
            podName: pod.metadata.name
          })
        )
        try {
          await Promise.all(tasks)
          this.$message.success('批量删除成功')
          this.fetchPods()
        } catch (err) {
          this.$message.error('删除失败')
          console.error(err)
        }
      })
    },
    // 添加分页事件
    handleSelectionChange(val) {
      this.selectedPods = val
    },
    handlePageChange(page) {
      this.currentPage = page
    },
    handleStatusFilterChange(val) {
      this.selectedStatus = val
      this.currentPage = 1
    },
    async logView(row) {
      const containers = row.spec.containers?.map(c => c.name) || []
      this.currentPod = row
      this.containers = containers
      this.selectedContainer = containers[0] || ''
      this.logDialogVisible = true
      this.fetchLogText()
    },

    async exec(row) {
      const containers = row.spec.containers?.map(c => c.name) || []
      this.currentPod = row
      this.containers = containers
      this.selectedContainer = containers[0] || ''
      this.terminalDialogVisible = true
      this.$nextTick(() => {
        this.initTerminal()
      })
    },

    async fetchLogText() {
      if (!this.currentPod || !this.selectedContainer) return
      const res = await this.getPodLogs({
        wsName: this.selectedWorkspace,
        nsName: this.selectedNamespace,
        podName: this.currentPod.metadata.name,
        container: this.selectedContainer
      })
      this.logText = typeof res === 'string' ? res : res?.data || '暂无日志'
    },

    handleContainerChange() {
      this.fetchLogText()
    },
    onTerminalDialogOpen() {
      if (this.containers.length > 0) {
        this.selectedContainer = this.containers[0]
        this.terminalInitialized = false // 每次打开弹窗都要重置
        setTimeout(() => {
          this.initTerminal()
          this.terminalInitialized = true
        }, 100)
      }
    },
    onContainerChange() {
      if (this.terminalInitialized) {
        this.initTerminal()
      }
    },
    async initTerminal() {
      console.log('准备进入容器终端...')

      if (!this.selectedContainer) {
        this.$message.warning('未选择容器，无法连接终端')
        return
      }

      const token = this.$store.getters.token
      const encodedToken = encodeURIComponent(token)
      // VUE_APP_BASE_API
      const baseApi = process.env.VUE_APP_BASE_API.replace(/^https?:\/\//, '')
      const url = `ws://${baseApi}/gapi/cluster/local/workspace/${this.selectedWorkspace}/api/v1/namespaces/${this.selectedNamespace}/pod/${this.currentPod.metadata.name}/exec?container=${this.selectedContainer}&command=/bin/sh&token=${encodedToken}`
      // const url = `ws://${location.hostname}:8080/gapi/cluster/local/workspace/${this.selectedWorkspace}/api/v1/namespaces/${this.selectedNamespace}/pods/${this.currentPod.metadata.name}/exec?container=${this.selectedContainer}&command=/bin/sh&token=${encodedToken}`

      console.log('容器终端拼接后的url：', url)

      // 清理旧 terminal 和 socket
      if (this.terminal) {
        this.terminal.dispose()
      }
      if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
        this.socket.close()
      }

      const term = new Terminal({
        fontSize: 14,
        cursorBlink: true,
        theme: {
          background: '#000000',
          foreground: '#ffffff'
        }
      })

      this.terminal = term
      term.open(document.getElementById('terminal'))

      const socket = new WebSocket(url)
      this.socket = socket

      socket.onopen = () => {
        console.log('终端连接成功')
        term.focus()
        term.writeln('Welcome to Kubernetes Container Terminal')

        term.onData(data => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(data)
          } else {
            term.writeln('\r\n连接尚未准备就绪...')
          }
        })
      }

      socket.onmessage = e => {
        term.write(e.data)
      }

      socket.onerror = err => {
        console.error('终端连接失败', err)
        term.writeln('\r\n连接失败，请检查容器状态或网络')
        this.$message.error('容器终端连接失败')
      }

      socket.onclose = () => {
        // console.log('终端连接关闭')
        // term.writeln('\r\n连接已关闭')
        // this.$message.info('终端已关闭')
      }
    },

    beforeDestroy() {
    this.terminal?.dispose()
    this.socket?.close()
    },
    downloadLogs() {
      const pod = this.currentPod
      const container = this.selectedContainer
      if (!pod || !container) {
        this.$message.warning('缺少 Pod 或容器信息')
        return
      }
      this.$store.dispatch('pods/downloadPodLogs', {
        wsName: this.selectedWorkspace,
        nsName: this.selectedNamespace,
        podName: pod.metadata.name,
        container
      })
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
