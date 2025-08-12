<template>
  <div class="node-page">
    <!-- 搜索栏 -->
    <div class="filters">
      <el-input
        v-model="searchText"
        placeholder="搜索节点名称或IP"
        style="width: 300px"
        clearable
      />
    </div>

    <!-- 节点表格 -->
    <div class="table-container">
      <el-table
        v-loading="loading"
        :data="pagedNodes"
        border
        style="flex: 1; overflow: auto"
        @selection-change="handleSelectionChange"
      >
        <!-- 多选框 -->
        <el-table-column type="selection" width="55" />

        <el-table-column prop="metadata.name" label="名称" width="200" />

        <el-table-column label="IP地址" width="160">
          <template #default="{ row }">
            {{ getNodeIP(row) }}
          </template>
        </el-table-column>

        <!-- 状态 -->
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getStatusTagType(row)">
              {{ getNodeStatus(row) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="角色" width="160">
          <template #default="{ row }">
            {{ getNodeRoles(row) }}
          </template>
        </el-table-column>

        <!-- 污点 -->
        <el-table-column label="污点" width="260">
          <template #default="{ row }">
            {{ getNodeTaints(row) }}
          </template>
        </el-table-column>

        <!-- 容器组 -->
        <el-table-column label="容器组（已/可调度）" width="180">
          <template #default="{ row }">
            {{ getPodAlloc(row) }}
          </template>
        </el-table-column>

        <el-table-column prop="metadata.creationTimestamp" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.metadata.creationTimestamp) }}
          </template>
        </el-table-column>

        <el-table-column label="操作" fixed="right" width="160" align="center">
          <template #default="{ row }">
            <el-dropdown trigger="click">
              <span class="el-dropdown-link">
                更多操作<i class="el-icon-arrow-down el-icon--right" />
              </span>
              <el-dropdown-menu slot="dropdown">
                <el-dropdown-item @click.native="handleView(row)">查看详情</el-dropdown-item>
                <el-dropdown-item @click.native="toggleScheduling(row)">
                  {{ isSchedulingDisabled(row) ? '启用调度' : '停止调度' }}
                </el-dropdown-item>
                <el-dropdown-item @click.native="editTaints(row)">编辑污点</el-dropdown-item>
                <el-dropdown-item @click.native="editLabels(row)">编辑 Label</el-dropdown-item>
              </el-dropdown-menu>
            </el-dropdown>
          </template>
        </el-table-column>

        <template #empty>
          <el-empty description="暂无节点数据" />
        </template>
      </el-table>

      <!-- 分页 -->
      <el-pagination
        background
        layout="total, sizes, prev, pager, next"
        :current-page="currentPage"
        :page-sizes="[10, 20, 50, 100]"
        :page-size="pageSize"
        :total="filteredNodes.length"
        style="margin-top: 16px; text-align: right"
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </div>

    <!-- YAML 详情弹窗 -->
    <el-dialog title="节点详情" :visible.sync="showYamlDialog" width="70%" @opened="refreshMonacoEditor">
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
      searchText: '',
      loading: false,
      selectedNodes: [],
      pageSize: 10,
      currentPage: 1,
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
      }
    }
  },
  computed: {
    ...mapGetters('nodes', ['nodes']),
    filteredNodes() {
      return this.searchText
        ? this.nodes.filter(n =>
          n.metadata.name.includes(this.searchText) ||
            this.getNodeIP(n).includes(this.searchText)
        )
        : this.nodes
    },
    pagedNodes() {
      const start = (this.currentPage - 1) * this.pageSize
      return this.filteredNodes.slice(start, start + this.pageSize)
    }
  },
  async created() {
    this.fetchNodes()
  },
  methods: {
    ...mapActions('nodes', ['getNodes', 'getNodesDetail', 'updateNodes']),
    isSchedulingDisabled(node) {
      return node.spec.unschedulable === true
    },

    async toggleScheduling(node) {
      try {
        const updatedNode = JSON.parse(JSON.stringify(node))
        updatedNode.spec.unschedulable = !this.isSchedulingDisabled(node)
        await this.updateNodes({
          clusterName: 'local',
          nodeName: node.metadata.name,
          nodeObj: updatedNode
        })
        this.$message.success(`已${this.isSchedulingDisabled(updatedNode) ? '停止' : '启用'}调度`)
        this.fetchNodes()
      } catch (e) {
        this.$message.error('更新调度状态失败')
        console.error(e)
      }
    },

    editTaints(node) {
      // 先把当前 taints 转成字符串 key=value:Effect, 多个用逗号分隔
      const currentTaints = (node.spec.taints || [])
        .map(t => `${t.key}=${t.value}:${t.effect}`)
        .join(',')

      this.$prompt('请输入新的污点（格式: key=value:Effect，多个用逗号分隔）', '编辑污点', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputValue: currentTaints // 预填当前值
      }).then(async({ value }) => {
        try {
          const updatedNode = JSON.parse(JSON.stringify(node))
          updatedNode.spec.taints = value
            ? value.split(',').map(t => {
              const [kv, effect] = t.split(':')
              const [key, val] = kv.split('=')
              return { key, value: val, effect }
            })
            : []
          await this.updateNodes({
            clusterName: 'local',
            nodeName: node.metadata.name,
            nodeObj: updatedNode
          })
          this.$message.success('污点更新成功')
          this.fetchNodes()
        } catch (e) {
          this.$message.error('更新污点失败')
          console.error(e)
        }
      }).catch(() => {})
    },

    editLabels(node) {
      // 把当前 labels 转成 key=value, 用逗号分隔
      const currentLabels = Object.entries(node.metadata.labels || {})
        .map(([key, val]) => `${key}=${val}`)
        .join(',')

      this.$prompt('请输入新的 Label（格式: key=value，多个用逗号分隔）', '编辑 Label', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputValue: currentLabels // 预填当前值
      }).then(async({ value }) => {
        try {
          const updatedNode = JSON.parse(JSON.stringify(node))
          updatedNode.metadata.labels = {}
          value.split(',').forEach(l => {
            const [key, val] = l.split('=')
            if (key) updatedNode.metadata.labels[key] = val || ''
          })
          await this.updateNodes({
            clusterName: 'local',
            nodeName: node.metadata.name,
            nodeObj: updatedNode
          })
          this.$message.success('Label 更新成功')
          this.fetchNodes()
        } catch (e) {
          this.$message.error('更新 Label 失败')
          console.error(e)
        }
      }).catch(() => {})
    },
    getNodeIP(node) {
      return node.metadata &&
         node.metadata.annotations &&
         node.metadata.annotations['projectcalico.org/IPv4Address']
        ? node.metadata.annotations['projectcalico.org/IPv4Address'].split('/')[0]
        : (node.status?.addresses?.find(a => a.type === 'InternalIP')?.address || '-')
    },
    getNodeStatus(node) {
      const conditions = node.status?.conditions || []
      const readyCond = conditions.find(c => c.type === 'Ready')
      return readyCond ? (readyCond.status === 'True' ? 'Ready' : 'NotReady') : 'Unknown'
    },
    getStatusTagType(node) {
      const s = this.getNodeStatus(node)
      if (s === 'Ready') return 'success'
      if (s === 'NotReady') return 'danger'
      return 'info'
    },
    getNodeRoles(node) {
      const labels = node.metadata.labels || {}
      const roles = Object.keys(labels)
        .filter(k => k.startsWith('node-role.kubernetes.io/'))
        .map(k => k.replace('node-role.kubernetes.io/', '') || 'master')
      return roles.length ? roles.join(', ') : '-'
    },
    getNodeTaints(node) {
      return (node.spec?.taints || [])
        .map(t => `${t.key}=${t.value}:${t.effect}`)
        .join(', ') || '-'
    },
    getPodAlloc(node) {
      const allocatable = node.status?.allocatable?.pods
      // 已调度数量暂时无法直接获取，后续可通过 Pod 列表统计
      return allocatable ? `- / ${allocatable}` : '-'
    },
    async fetchNodes() {
      this.loading = true
      try {
        await this.getNodes({ clusterName: 'local' }) // 写死 local
      } finally {
        this.loading = false
      }
    },
    formatDate(dateStr) {
      if (!dateStr) return '-'
      return new Date(dateStr).toLocaleString()
    },
    async handleView(row) {
      try {
        const res = await this.getNodesDetail({
          clusterName: 'local',
          nodeName: row.metadata.name
        })
        this.yamlContent = yaml.dump(res)
        this.showYamlDialog = true
        this.$nextTick(this.refreshMonacoEditor)
      } catch (err) {
        this.$message.error('获取节点详情失败')
        console.error(err)
      }
    },
    handleEdit(row) {
      this.$message.info(`编辑节点功能待实现: ${row.metadata.name}`)
    },
    refreshMonacoEditor() {
      this.$refs.yamlViewer?.editor?.layout()
    },
    handleSelectionChange(val) {
      this.selectedNodes = val
    },
    handlePageChange(page) {
      this.currentPage = page
    },
    handleSizeChange(size) {
      this.pageSize = size
      this.currentPage = 1
    }
  }
}
</script>
