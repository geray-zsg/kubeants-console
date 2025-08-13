<template>
  <div class="node-page">
    <!-- 搜索栏 -->
    <div class="filters">
      <el-input
        v-model="searchText"
        placeholder="搜索节点名称"
        style="width: 300px; margin-right: 12px"
        clearable
      />
      <el-button
        type="warning"
        :disabled="!selectedNodes.length"
        @click="handleBatchUnschedule"
      >
        批量停止调度
      </el-button>
      <el-button
        type="success"
        :disabled="!selectedNodes.length"
        style="margin-left: 8px"
        @click="handleBatchSchedule"
      >
        批量启用调度
      </el-button>
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
        <el-table-column type="selection" width="55" />
        <el-table-column prop="metadata.name" label="节点名称" width="300" />

        <el-table-column label="角色" width="180">
          <template #default="{ row }">
            {{ getNodeRoles(row) }}
          </template>
        </el-table-column>

        <el-table-column label="IP地址" width="200">
          <template #default="{ row }">
            {{ getNodeIP(row) }}
          </template>
        </el-table-column>

        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getNodeStatusTag(row)">
              {{ getNodeStatus(row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          label="调度状态"
          width="120"
        >
          <template slot-scope="{ row }">
            <el-tag
              v-if="row.spec && row.spec.unschedulable"
              type="danger"
            >
              已停止
            </el-tag>
            <el-tag
              v-else
              type="success"
            >
              已启用
            </el-tag>
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

    <!-- 编辑污点 -->
    <el-dialog title="编辑污点" :visible.sync="taintDialogVisible" width="50%">
      <div v-for="(item, index) in taintForm.taints" :key="index" style="display: flex; gap: 10px; margin-bottom: 10px">
        <el-input v-model="item.key" placeholder="key" style="flex: 1" />
        <el-input v-model="item.value" placeholder="value" style="flex: 1" />
        <el-select v-model="item.effect" placeholder="effect" style="flex: 1">
          <el-option label="NoSchedule" value="NoSchedule" />
          <el-option label="PreferNoSchedule" value="PreferNoSchedule" />
          <el-option label="NoExecute" value="NoExecute" />
        </el-select>
        <el-button type="danger" icon="el-icon-delete" @click="removeTaint(index)" />
      </div>
      <el-button type="primary" icon="el-icon-plus" @click="addTaint">添加污点</el-button>
      <span slot="footer">
        <el-button @click="taintDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveTaints">保存</el-button>
      </span>
    </el-dialog>

    <!-- 编辑 Label -->
    <el-dialog title="编辑 Label" :visible.sync="labelDialogVisible" width="50%">
      <div v-for="(item, index) in labelForm.labels" :key="index" style="display: flex; gap: 10px; margin-bottom: 10px">
        <el-input v-model="item.key" placeholder="key" style="flex: 1" />
        <el-input v-model="item.value" placeholder="value" style="flex: 1" />
        <el-button type="danger" icon="el-icon-delete" @click="removeLabel(index)" />
      </div>
      <el-button type="primary" icon="el-icon-plus" @click="addLabel">添加 Label</el-button>
      <span slot="footer">
        <el-button @click="labelDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveLabels">保存</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'
import dayjs from 'dayjs'

export default {
  data() {
    return {
      searchText: '',
      loading: false,
      selectedNodes: [],
      pageSize: 10,
      currentPage: 1,
      currentNode: null,

      taintDialogVisible: false,
      labelDialogVisible: false,
      taintForm: { taints: [] },
      labelForm: { labels: [] }
    }
  },
  computed: {
    ...mapGetters('nodes', ['nodes']),
    filteredNodes() {
      return this.searchText
        ? this.nodes.filter(n => n.metadata.name.includes(this.searchText))
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
    ...mapActions('nodes', ['getNodes', 'updateNodes']),
    async fetchNodes() {
      this.loading = true
      try {
        await this.getNodes({ clusterName: 'local' })
      } finally {
        this.loading = false
      }
    },
    getNodeIP(node) {
      return node.metadata?.annotations?.['projectcalico.org/IPv4Address']?.split('/')[0] || '-'
    },
    getNodeRoles(node) {
      const labels = node.metadata.labels || {}
      const roles = Object.keys(labels)
        .filter(k => k.startsWith('node-role.kubernetes.io/'))
        .map(k => k.replace('node-role.kubernetes.io/', '') || 'master')
      return roles.length ? roles.join(', ') : '-'
    },
    getNodeStatus(node) {
      const condition = node.status?.conditions?.find(c => c.type === 'Ready')
      return condition?.status === 'True' ? 'Ready' : 'NotReady'
    },
    getNodeStatusTag(node) {
      return this.getNodeStatus(node) === 'Ready' ? 'success' : 'danger'
    },
    isSchedulingDisabled(node) {
      return node.spec?.unschedulable === true
    },
    async toggleScheduling(node) {
      const updated = { ...node, spec: { ...node.spec, unschedulable: !this.isSchedulingDisabled(node) }}
      await this.updateNodes({ clusterName: 'local', nodeName: node.metadata.name, nodeObj: updated })
      this.$message.success(this.isSchedulingDisabled(node) ? '已启用调度' : '已停止调度')
      this.fetchNodes()
    },
    editTaints(node) {
      this.currentNode = node
      this.taintForm.taints = (node.spec?.taints || []).map(t => ({
        key: t.key || '',
        value: t.value || '',
        effect: t.effect || 'NoSchedule'
      }))
      if (!this.taintForm.taints.length) {
        this.addTaint()
      }
      this.taintDialogVisible = true
    },
    addTaint() {
      this.taintForm.taints.push({ key: '', value: '', effect: 'NoSchedule' })
    },
    removeTaint(index) {
      this.taintForm.taints.splice(index, 1)
    },
    async saveTaints() {
      const updated = { ...this.currentNode, spec: { ...this.currentNode.spec, taints: this.taintForm.taints }}
      await this.updateNodes({ clusterName: 'local', nodeName: this.currentNode.metadata.name, nodeObj: updated })
      this.$message.success('污点已更新')
      this.taintDialogVisible = false
      this.fetchNodes()
    },
    editLabels(node) {
      this.currentNode = node
      this.labelForm.labels = Object.entries(node.metadata.labels || {}).map(([key, value]) => ({ key, value }))
      if (!this.labelForm.labels.length) {
        this.addLabel()
      }
      this.labelDialogVisible = true
    },
    addLabel() {
      this.labelForm.labels.push({ key: '', value: '' })
    },
    removeLabel(index) {
      this.labelForm.labels.splice(index, 1)
    },
    async saveLabels() {
      const updatedLabels = {}
      this.labelForm.labels.forEach(l => {
        if (l.key) updatedLabels[l.key] = l.value
      })
      const updated = { ...this.currentNode, metadata: { ...this.currentNode.metadata, labels: updatedLabels }}
      await this.updateNodes({ clusterName: 'local', nodeName: this.currentNode.metadata.name, nodeObj: updated })
      this.$message.success('Label 已更新')
      this.labelDialogVisible = false
      this.fetchNodes()
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
    },
    formatDate(dateStr) {
      if (!dateStr) return '-'
      return dayjs(dateStr).format('YYYY-MM-DD HH:mm:ss')
    },
    async cordonNode(node) {
      const updated = { ...node, spec: { ...node.spec, unschedulable: true }}
      await this.updateNodes({
        clusterName: 'local',
        nodeName: node.metadata.name,
        nodeObj: updated
      })
    },

    // 启用调度单节点
    async uncordonNode(node) {
      const updated = { ...node, spec: { ...node.spec, unschedulable: false }}
      await this.updateNodes({
        clusterName: 'local',
        nodeName: node.metadata.name,
        nodeObj: updated
      })
    },

    // 批量停止调度
    async handleBatchUnschedule() {
      this.$confirm(
        `确定要停止调度选中的 ${this.selectedNodes.length} 个节点吗？`,
        '提示',
        { type: 'warning' }
      ).then(async() => {
        try {
          this.loading = true
          for (const node of this.selectedNodes) {
            await this.cordonNode(node)
          }
          this.$message.success('批量停止调度成功')
          await this.fetchNodes()
        } finally {
          this.loading = false
        }
      })
    },

    // 批量启用调度
    async handleBatchSchedule() {
      this.$confirm(
        `确定要启用调度选中的 ${this.selectedNodes.length} 个节点吗？`,
        '提示',
        { type: 'info' }
      ).then(async() => {
        try {
          this.loading = true
          for (const node of this.selectedNodes) {
            await this.uncordonNode(node)
          }
          this.$message.success('批量启用调度成功')
          await this.fetchNodes()
        } finally {
          this.loading = false
        }
      })
    }
  }
}
</script>

<style scoped>
.node-page {
  padding: 20px;
  display: flex;
  flex-direction: column;
}
.filters {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}
.table-container {
  flex: 1;
  overflow-x: auto;
}
</style>
