<template>
  <div class="dashboard-container">
    <h2>👋 欢迎回来，{{ username }}</h2>
    <div class="info-box">📧 邮箱: {{ email }}</div>

    <el-card class="box-card">
      <div class="info-box">
        <h3>🧭 Workspace 列表</h3>
        <div v-if="workspaces.length === 0">
          <el-empty description="当前用户未加入任何 Workspace" />
        </div>
        <div v-else>
          <el-table :data="workspaces" border style="width: 100%">
            <el-table-column label="Workspace 名称">
              <template v-slot="{ row }">
                {{ row.name || '未知空间' }}
              </template>
            </el-table-column>
            <el-table-column label="角色权限">
              <template v-slot="{ row }">
                {{ row.role || '无角色' }}
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'Dashboard',
  computed: {
    ...mapGetters('user', ['username', 'email']), // 假设用户数据在user模块
    ...mapGetters('dashboard', ['workspaces']), // 直接访问state
    // 添加格式化后的工作空间列表
    filteredWorkspaces() {
      return this.workspaces.filter(ws => ws.name && ws.role)
    }
  },
  async created() {
    try {
      await this.$store.dispatch('dashboard/getWorkspaces', this.username)
    } catch (error) {
      this.$message.error('工作空间加载失败')
    }
  }
}
</script>

<style lang="scss" scoped>
.dashboard-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}
.box-card {
  width: 100%;
  margin: 20px 0;
}
.info-box {
  margin: 20px 0;
  font-size: 16px;
}
</style>
