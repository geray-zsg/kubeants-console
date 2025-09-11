<template>
  <div class="secret-page">
    <!-- 过滤区域 -->
    <div class="filters">
      <span class="filter-label">工作空间：</span>
      <el-select v-model="selectedWorkspace" placeholder="选择 Workspace" @change="onWorkspaceChange">
        <el-option v-for="ws in workspaces" :key="ws.name" :label="ws.name" :value="ws.name" />
      </el-select>

      <el-input
        v-model="searchText"
        placeholder="搜索存储卷"
        style="margin-left: 20px; width: 300px"
        clearable
      />
    </div>

    <!-- 表格 -->
    <el-table
      :data="pagedData"
      border
      style="width: 100%"
      :header-cell-style="{ background: '#f5f7fa', fontWeight: 'bold' }"
    >
      <el-table-column prop="metadata.name" label="名称" min-width="200" />
      <el-table-column prop="spec.capacity.storage" label="容量" min-width="120" />
      <el-table-column label="访问模式" min-width="180">
        <template v-slot="{ row }">
          <el-tag
            v-for="mode in row.spec.accessModes"
            :key="mode"
            size="small"
            type="info"
            style="margin-right: 5px"
          >
            {{ mode }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="spec.storageClassName" label="存储类" min-width="160" />
      <el-table-column prop="spec.persistentVolumeReclaimPolicy" label="回收策略" min-width="150" />
      <el-table-column label="绑定的 PVC" min-width="200">
        <template v-slot="{ row }">
          <span v-if="row.spec.claimRef">{{ row.spec.claimRef.namespace }}/{{ row.spec.claimRef.name }}</span>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column prop="status.phase" label="状态" min-width="120" />
      <el-table-column prop="metadata.creationTimestamp" label="创建时间" min-width="180">
        <template v-slot="{ row }">
          {{ formatDate(row.metadata.creationTimestamp) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" fixed="right" width="100">
        <template v-slot="{ row }">
          <el-button size="small" text @click="handleView(row)">详情</el-button>
        </template>
      </el-table-column>

      <template #empty>
        <el-empty description="暂无数据" />
      </template>
    </el-table>

    <!-- 分页器 -->
    <div style="margin-top: 20px; text-align: right">
      <el-pagination
        background
        layout="total, sizes, prev, pager, next, jumper"
        :page-sizes="[10, 20, 50, 100]"
        :page-size="pageSize"
        :current-page="currentPage"
        :total="tableData.length"
        @size-change="handleSizeChange"
        @current-change="handlePageChange"
      />
    </div>

    <!-- YAML 详情弹窗 -->
    <el-dialog
      :visible.sync="showYamlDialog"
      title="PersistentVolume 详情"
      width="70%"
      @opened="refreshMonacoEditor"
    >
      <div style="height: 400px; border: 1px solid #dcdfe6; border-radius: 4px">
        <monaco-editor
          ref="yamlEditor"
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
import yaml from 'js-yaml'
import paginationMixin from '@/utils/pagination'
import MonacoEditor from 'vue-monaco-editor'

export default {
  components: { MonacoEditor },
  mixins: [paginationMixin],
  data() {
    return {
      selectedWorkspace: '',
      searchText: '',
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
    ...mapGetters('dashboard', ['workspaces']),
    ...mapGetters('persistentvolumes', ['persistentvolumes']),
    // ✅ tableData 提供给分页 mixin 使用
    tableData() {
      if (!this.searchText) return this.persistentvolumes
      return this.persistentvolumes.filter(pv =>
        pv.metadata.name.includes(this.searchText)
      )
    }
  },
  async created() {
    await this.getWorkspaces()
    if (this.workspaces.length > 0) {
      this.selectedWorkspace = this.workspaces[0].name
      await this.fetchPersistentvolumes()
    }
  },
  methods: {
    ...mapActions('dashboard', ['getWorkspaces']),
    ...mapActions('persistentvolumes', ['getPersistentvolumes', 'getPersistentvolumesDetaile']),

    async onWorkspaceChange() {
      await this.fetchPersistentvolumes()
    },
    async fetchPersistentvolumes() {
      if (!this.selectedWorkspace) return
      await this.getPersistentvolumes({ wsName: this.selectedWorkspace })
    },
    async handleView(row) {
      if (!this.selectedWorkspace || !row?.metadata?.name) {
        this.$message.error('当前工作空间未选中，或数据不完整')
        return
      }
      try {
        const res = await this.getPersistentvolumesDetaile({
          wsName: this.selectedWorkspace,
          pvName: row.metadata.name
        })
        this.showYamlDialog = true

        this.$nextTick(() => {
          this.yamlContent = yaml.dump(res || {})
          this.$refs.yamlEditor?.editor?.setValue(this.yamlContent)
          this.refreshMonacoEditor()
        })
      } catch (err) {
        console.error('获取 PersistentVolume 详情失败', err)
        this.$message.error('获取详情失败')
      }
    },
    refreshMonacoEditor() {
      this.$nextTick(() => {
        this.$refs.yamlEditor?.editor?.layout()
      })
    },
    formatDate(dateStr) {
      return new Date(dateStr).toLocaleString()
    }
  }
}
</script>

<style scoped>
.secret-page {
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
