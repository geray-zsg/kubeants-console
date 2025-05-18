<template>
  <div class="workspace-container">
    <!-- Workspace选择器 -->
    <el-select v-model="currentWorkspace" placeholder="选择Workspace" style="margin-bottom: 20px;" @change="onWorkspaceChange">
      <el-option
        v-for="ws in workspaces"
        :key="ws.name"
        :label="ws.name"
        :value="ws.name"
      />
    </el-select>

    <el-tabs v-model="activeTab">
      <!-- Namespace管理 -->
      <el-tab-pane label="Namespace列表" name="namespaces">
        <el-button @click="showCreateNsDialog">新建Namespace</el-button>
        <el-table :data="namespaces" border>
          <el-table-column prop="name" label="名称" />
          <el-table-column label="标签">
            <template v-slot="{ row }">
              <el-tag
                v-for="(value, key) in row.labels"
                :key="key"
                style="margin: 2px"
              >
                {{ key }}: {{ value }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- Workspace设置 -->
      <el-tab-pane label="设置" name="settings">
        <div class="user-management">
          <h3>用户列表（当前Workspace: {{ currentWorkspace }}）</h3>
          <el-table :data="userBindings">
            <el-table-column prop="user" label="用户名" />
            <el-table-column prop="role" label="角色" />
            <el-table-column label="操作">
              <template v-slot="{ row }">
                <el-button size="mini" @click="openRoleDialog(row.user)">修改角色</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-button @click="showInviteDialog">邀请用户</el-button>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 新建Namespace对话框 -->
    <el-dialog title="新建Namespace" :visible.sync="nsDialogVisible">
      <el-form :model="nsForm" label-width="120px">
        <el-form-item label="名称" prop="name" required>
          <el-input v-model="nsForm.name" placeholder="请输入符合DNS规范的名称" />
        </el-form-item>

        <el-form-item label="别名">
          <el-input v-model="nsForm.alias" placeholder="请输入易记的名称" />
        </el-form-item>

        <el-form-item label="描述">
          <el-input
            v-model="nsForm.description"
            type="textarea"
            :rows="3"
            placeholder="请输入Namespace的描述信息"
          />
        </el-form-item>

        <el-form-item label="自定义标签">
          <div v-for="(label, index) in nsForm.labels" :key="index" class="label-item">
            <el-input
              v-model="label.key"
              placeholder="键"
              style="width: 200px; margin-right: 10px;"
            />
            <el-input
              v-model="label.value"
              placeholder="值"
              style="width: 200px; margin-right: 10px;"
            />
            <el-button
              type="danger"
              icon="el-icon-remove"
              circle
              size="mini"
              @click.prevent="removeLabel(index)"
            />
          </div>
          <el-button type="primary" icon="el-icon-plus" size="mini" @click="addLabel">
            添加标签
          </el-button>
        </el-form-item>
      </el-form>

      <div slot="footer">
        <el-button @click="nsDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitNamespace">创建</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex'

export default {
  data() {
    return {
      currentWorkspace: '',
      activeTab: 'namespaces',
      nsDialogVisible: false,
      nsForm: {
        name: '',
        alias: '',
        description: '',
        labels: []
      }
    }
  },
  computed: {
    ...mapGetters('workspace', ['namespaces', 'userBindings']),
    ...mapGetters('dashboard', ['workspaces'])
  },
  watch: {
    currentWorkspace(newVal) {
      if (newVal) this.fetchWorkspaceData(newVal)
    }
  },
  async created() {
    const routeWorkspace = this.$route.params.workspaceName
    this.currentWorkspace = routeWorkspace || (this.workspaces[0]?.name || '')
    if (this.currentWorkspace) {
      await this.fetchWorkspaceData(this.currentWorkspace)
    }
  },
  methods: {
    ...mapActions('workspace', [
      'fetchNamespaces',
      'fetchUserBindings',
      'createNamespace' // 新增 action
    ]),
    async fetchWorkspaceData(name) {
      try {
        await Promise.all([
          this.fetchNamespaces(name),
          this.fetchUserBindings(name)
        ])
      } catch (error) {
        const msg = error?.response?.data?.msg || error.message || '数据加载失败'
        this.$message.error(msg)
        console.error('加载 Workspace 数据失败:', error)
      }
    },
    onWorkspaceChange() {
      this.$router.replace({ name: 'workspace', params: { workspaceName: this.currentWorkspace }})
    },
    showCreateNsDialog() {
      this.nsDialogVisible = true
    },
    addLabel() {
      this.nsForm.labels.push({ key: '', value: '' })
    },
    removeLabel(index) {
      this.nsForm.labels.splice(index, 1)
    },
    async submitNamespace() {
      try {
        const labels = this.nsForm.labels.reduce((acc, cur) => {
          if (cur.key && cur.value) {
            acc[cur.key] = cur.value
          }
          return acc
        }, {})

        labels['kubeants.io/workspace'] = this.currentWorkspace
        labels['kubeants.io/managed-by'] = 'workspace'

        const annotations = {}
        if (this.nsForm.alias) {
          annotations['kubeants.io/alias-name'] = this.nsForm.alias
        }
        if (this.nsForm.description) {
          annotations['kubeants.io/description'] = this.nsForm.description
        }

        // 调用方法创建
        await this.createNamespace({
          workspace: this.currentWorkspace,
          namespace: {
            apiVersion: 'v1',
            kind: 'Namespace',
            metadata: {
              name: this.nsForm.name,
              labels,
              annotations
            }
          }
        })

        this.$message.success('创建成功')
        await this.fetchNamespaces(this.currentWorkspace)
        this.nsDialogVisible = false
        this.resetNsForm()
      } catch (error) {
        const msg = error?.response?.data?.msg || error.message || '创建失败'
        this.$message.error(`创建失败: ${msg}`)
      }
    },
    resetNsForm() {
      this.nsForm = {
        name: '',
        alias: '',
        description: '',
        labels: []
      }
    },
    showInviteDialog() {
      this.$message.info('邀请用户功能待实现')
    },
    openRoleDialog(user) {
      this.$message.info(`修改 ${user} 的角色，功能待实现`)
    }
  }
}
</script>

  <style scoped>
  .workspace-container {
    padding: 20px;
    max-width: 1200px;
    margin: 0 auto;
  }
  .user-management {
    margin-top: 20px;
  }
  .label-item {
    margin-bottom: 10px;
    display: flex;
    align-items: center;
  }
  </style>
