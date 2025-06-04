<template>
  <div class="workspace-container">
    <el-select
      v-model="currentWorkspace"
      placeholder="选择 Workspace"
      class="workspace-select"
      clearable
      @change="fetchWorkspaceData"
    >
      <el-option
        v-for="ws in workspaces"
        :key="ws.name"
        :label="ws.name"
        :value="ws.name"
      />
    </el-select>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="Namespace 列表" name="namespaces">
        <el-table v-if="!loading" :data="namespaces" border style="width: 100%">
          <el-table-column prop="metadata.name" label="名称" />
          <el-table-column label="标签">
            <template v-slot="{ row }">
              <el-tag
                v-for="(value, key) in row.metadata.labels"
                :key="key"
                style="margin: 2px"
              >
                {{ key }}: {{ value }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="创建时间">
            <template v-slot="{ row }">
              {{ formatDate(row.metadata.creationTimestamp) }}
            </template>
          </el-table-column>
        </el-table>
        <el-skeleton v-else :rows="5" animated />
      </el-tab-pane>

      <el-tab-pane label="用户列表" name="users">
        <el-table v-if="!loading" :data="userBindings" border style="width: 100%">
          <el-table-column prop="spec.user" label="用户名" />
          <el-table-column prop="spec.role" label="角色" />
          <el-table-column prop="metadata.name" label="绑定名称" />
          <el-table-column label="创建时间">
            <template v-slot="{ row }">
              {{ formatDate(row.metadata.creationTimestamp) }}
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'

export default {
  data() {
    return {
      currentWorkspace: '',
      activeTab: 'namespaces',
      loading: false
    }
  },
  computed: {
    ...mapGetters('workspace', ['namespaces', 'userBindings']),
    ...mapGetters('dashboard', ['workspaces'])
  },
  async created() {
    try {
      await this.$store.dispatch('dashboard/getWorkspaces')

      const paramWorkspace = this.$route.params.workspaceName

      if (paramWorkspace && this.workspaces.find(ws => ws.name === paramWorkspace)) {
        this.currentWorkspace = paramWorkspace
      } else if (this.workspaces.length > 0) {
        this.currentWorkspace = this.workspaces[0].name
      }

      this.fetchWorkspaceData(this.currentWorkspace)
    } catch (error) {
      this.$message.error('工作空间加载失败')
    }
  },
  methods: {
    ...mapActions('workspace', ['getNamespaces', 'getUserBindings']),
    async fetchWorkspaceData(workspace) {
      if (!workspace) return
      this.loading = true
      try {
        // await this.getNamespaces(this.currentWorkspace)
        await Promise.all([
          this.getNamespaces(workspace),
          this.getUserBindings(workspace)
        ])
      } catch (err) {
        this.$message.error('命名空间加载失败')
      } finally {
        this.loading = false
      }
    },
    formatDate(dateStr) {
      if (!dateStr) return ''
      const date = new Date(dateStr)
      return date.toLocaleString()
    }
  }
}
</script>

<style scoped>
.workspace-container {
  padding: 20px;
  max-width: 100%;
  margin: 0 auto;
}
.workspace-select {
  margin-bottom: 20px;
  width: 300px;
}
.el-tag {
  margin-right: 5px;
}
</style>
