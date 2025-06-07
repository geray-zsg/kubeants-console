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
        <el-button type="primary" icon="el-icon-plus" style="margin-bottom: 10px;" @click="showNsDialog = true"> 创建namespace</el-button>
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
          <el-table-column prop="status.phase" label="状态" />
          <el-table-column label="创建时间">
            <template v-slot="{ row }">
              {{ formatDate(row.metadata.creationTimestamp) }}
            </template>
          </el-table-column>
          <el-table-column label="操作">
            <template v-slot="{ row }">
              <el-button size="mini" @click.stop="deleteNamespace(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-skeleton v-else :rows="5" animated />
      </el-tab-pane>
      <!-- 创建 Namespace 弹窗 -->
      <el-dialog title="创建 Namespace" :visible.sync="showNsDialog">
        <el-form :model="nsForm" label-width="100px">
          <el-form-item label="名称">
            <el-input v-model="nsForm.metadata.name" placeholder="请输入 Namespace 名称" />
          </el-form-item>
        </el-form>
        <span slot="footer">
          <el-button @click="showNsDialog = false">取消</el-button>
          <el-button type="primary" @click="handleCreateNamespace">创建</el-button>
        </span>
      </el-dialog>

      <el-tab-pane label="用户列表" name="users">
        <el-button type="primary" icon="el-icon-plus" style="margin-bottom: 10px;" @click="openInviteDialog">  邀请用户</el-button>
        <el-table v-if="!loading" :data="userBindings" border style="width: 100%">
          <el-table-column prop="spec.user" label="用户名" />
          <el-table-column prop="spec.role" label="角色" />
          <el-table-column prop="metadata.name" label="绑定名称" />
          <el-table-column label="创建时间">
            <template v-slot="{ row }">
              {{ formatDate(row.metadata.creationTimestamp) }}
            </template>
          </el-table-column>
          <el-table-column label="操作">
            <template v-slot="{ row }">
              <el-button size="mini" @click.stop="removeUserBinding(row)">移除成员</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-dialog title="邀请用户加入 Workspace" :visible.sync="showInviteDialog">
        <el-form :model="inviteForm" label-width="100px">
          <el-form-item label="用户名">
            <el-select v-model="inviteForm.username" filterable placeholder="请选择用户">
              <el-option v-for="user in filteredUsers" :key="user.metadata.name" :label="user.metadata.name" :value="user.metadata.name" />
            </el-select>
          </el-form-item>
          <el-form-item label="角色">
            <el-select v-model="inviteForm.role" placeholder="请选择角色">
              <el-option label="管理员" value="admin" />
              <el-option label="编辑者" value="edit" />
              <el-option label="查看者" value="view" />
            </el-select>
          </el-form-item>
        </el-form>
        <span slot="footer">
          <el-button @click="showInviteDialog = false">取消</el-button>
          <el-button type="primary" @click="submitUserInvite">邀请</el-button>
        </span>
      </el-dialog>
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
      loading: false,
      showNsDialog: false,
      nsForm: {
        metadata: {
          name: ''
        }
      },
      allUsers: [],
      showInviteDialog: false,
      inviteForm: {
        username: '',
        role: ''
      }
    }
  },
  computed: {
    ...mapGetters('workspace', ['namespaces', 'userBindings']),
    ...mapGetters('dashboard', ['workspaces']),
    // 过滤掉已在改workspace下的用户
    filteredUsers() {
      const boundUsernames = this.userBindings.map(b => b.spec.user)
      return this.allUsers.filter(user => !boundUsernames.includes(user.metadata.name))
    }
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
    ...mapActions('workspace', ['getNamespaces', 'getUserBindings', 'addNamespace', 'addUserBinding']),
    async fetchWorkspaceData(workspace) {
      if (!workspace) return
      this.loading = true
      try {
        // await this.getNamespaces(this.currentWorkspace)
        await Promise.all([
          this.getNamespaces(workspace),
          this.getUserBindings(workspace)
          // this.loadAllUsers()
        ])
      } catch (err) {
        this.$message.error('命名空间加载失败')
      } finally {
        this.loading = false
      }
    },
    async openInviteDialog() {
      // 点击邀请用户时调用获取用户接口，避免重复加载
      if (this.allUsers.length === 0) {
        try {
          const res = await this.$store.dispatch('workspace/userListAll')
          this.allUsers = res.items?.items || []
        } catch (err) {
          this.$message.error('加载用户列表失败')
          return
        }
      }
      this.showInviteDialog = true
    },
    // async loadAllUsers() {
    //   try {
    //     const res = await this.$store.dispatch('workspace/userListAll')
    //     this.allUsers = res.items?.items || []
    //   } catch (err) {
    //     this.$message.error('加载用户列表失败')
    //   }
    // },
    formatDate(dateStr) {
      if (!dateStr) return ''
      const date = new Date(dateStr)
      return date.toLocaleString()
    },
    async handleCreateNamespace() {
      if (!this.nsForm.metadata.name) {
        this.$message.warning('请输入 Namespace 名称')
        return
      }

      // 💡 自动设置 Workspace 相关的 label（这是你提到的关联）
      const namespaceData = {
        apiVersion: 'v1',
        kind: 'Namespace',
        metadata: {
          name: this.nsForm.metadata.name,
          labels: {
            'kubeants.io/managed-by': 'workspace',
            'kubeants.io/workspace': this.currentWorkspace
          }
        }
      }

      try {
        await this.addNamespace({
          workspaceName: this.currentWorkspace,
          data: namespaceData
        })
        this.$message.success('Namespace 创建成功')
        this.showNsDialog = false
        this.nsForm.metadata.name = ''
        this.fetchWorkspaceData(this.currentWorkspace)
      } catch (err) {
        this.$message.error('创建失败：' + (err.message || '未知错误'))
      }
    },
    async submitUserInvite() {
      const { username, role } = this.inviteForm
      if (!username || !role) {
        this.$message.warning('请输入用户名并选择角色')
        return
      }

      const binding = {
        apiVersion: 'userbinding.kubeants.io/v1beta1',
        kind: 'UserBinding',
        metadata: {
          name: `workspace-${this.currentWorkspace}-${username}`,
          labels: {
            'kubeants.io/kind': 'workspace',
            'kubeants.io/managed-by': 'user',
            'kubeants.io/user': username,
            'kubeants.io/workspace': this.currentWorkspace
          }
        },
        spec: {
          user: username,
          role,
          scope: {
            kind: 'Workspace',
            name: this.currentWorkspace
          }
        }
      }

      try {
        await this.addUserBinding({
          workspaceName: this.currentWorkspace,
          data: binding
        })
        this.$message.success('用户邀请成功')
        this.showInviteDialog = false
        this.inviteForm.username = ''
        this.inviteForm.role = ''
        this.fetchWorkspaceData(this.currentWorkspace)
      } catch (err) {
        this.$message.error('邀请失败：' + (err.message || '未知错误'))
      }
    },
    removeUserBinding(row) {
      this.$confirm(`确认移除用户 ${row.spec?.user || row.metadata.name}？`, '提示', {
        type: 'warning'
      }).then(async() => {
        try {
          await this.$store.dispatch('workspace/removeUserBinding', {
            workspaceName: this.currentWorkspace,
            name: row.metadata.name
          })
          this.$message.success('移除用户成功')
          await this.fetchWorkspaceData(this.currentWorkspace) // ✅ 刷新列表
        } catch (err) {
          this.$message.error('移除失败: ' + (err.message || '未知错误'))
        }
      })
    },
    deleteNamespace(row) {
      this.$confirm(`确认移除用户 ${row.spec?.user || row.metadata.name}？`, '提示', {
        type: 'warning'
      }).then(async() => {
        try {
          await this.$store.dispatch('workspace/deleteNamespace', {
            name: row.metadata.name
          })
          this.$message.success('删除成功')
          await this.fetchWorkspaceData(this.currentWorkspace) // ✅ 刷新列表
        } catch (err) {
          this.$message.error('删除失败: ' + (err.message || '未知错误'))
        }
      })
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
