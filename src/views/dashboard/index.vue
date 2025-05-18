<template>
  <div class="dashboard-container">
    <h2>👋 欢迎回来，{{ username }}</h2>
    <div class="info-box">📧 邮箱: {{ email }}</div>

    <el-tabs v-model="activeTab" class="no-transition-tabs">
      <!-- <el-tabs v-model="activeTab" class="optimized-tabs"> -->
      <el-tab-pane label="workspace栏" name="workspace">
        <div class="table-header">
          <el-input
            v-model="workspaceSearch"
            placeholder="🔍 搜索 Workspace..."
            clearable
            style="width: 300px"
          />
          <el-button
            v-if="hasClusterAdminRole"
            type="primary"
            icon="el-icon-plus"
            @click="createWorkspace"
          >新建 Workspace</el-button>
        </div>

        <div v-if="filteredWorkspaces.length === 0">
          <el-empty description="当前用户未加入任何 Workspace" />
        </div>
        <div v-else>
          <el-table :data="filteredWorkspaces" border style="width: 100%">
            <el-table-column label="Workspace 名称">
              <template v-slot="{ row }">{{ row.name || '未知空间' }}</template>
            </el-table-column>
            <el-table-column label="角色权限">
              <template v-slot="{ row }">{{ row.role || '无角色' }}</template>
            </el-table-column>
            <el-table-column label="操作" width="220">
              <template v-slot="{ row }">
                <el-button
                  v-if="['admin', 'edit'].includes(row.role)"
                  size="mini"
                  type="primary"
                  @click.stop="editWorkspace(row)"
                >编辑</el-button>
                <el-button size="mini" @click.stop="viewWorkspace(row)">查看</el-button>
                <el-button
                  v-if="['admin', 'edit'].includes(row.role)"
                  size="mini"
                  type="danger"
                  @click.stop="deleteWorkspace(row)"
                >删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>
      <!-- =====查看workspace详情弹窗开始===== -->
      <el-dialog
        title="查看 Workspace"
        :visible.sync="viewWorkspaceDialogVisible"
        width="600px"
      >
        <el-descriptions :title="viewedWorkspace.name" :column="1" border>
          <el-descriptions-item label="别名">{{ viewedWorkspace.alias }}</el-descriptions-item>
          <el-descriptions-item label="描述">{{ viewedWorkspace.description }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ viewedWorkspace.creationTimestamp }}</el-descriptions-item>
        </el-descriptions>
      </el-dialog>
      <!-- =====查看workspace详情弹窗结束===== -->

      <!-- =====编辑workspace弹窗开始===== -->
      <el-dialog
        title="编辑 Workspace"
        :visible.sync="editWorkspaceDialogVisible"
        width="600px"
      >
        <el-form
          ref="editFormRef"
          :model="workspaceEditForm"
          label-width="100px"
        >
          <!-- 新增 显示不可修改的名称字段 -->
          <el-form-item label="名称">
            <el-input
              v-model="workspaceEditForm.name"
              :disabled="true"
              style="color: #606266;"
            />
          </el-form-item>
          <el-form-item label="别名">
            <el-input v-model="workspaceEditForm.alias" />
          </el-form-item>
          <el-form-item label="描述">
            <el-input v-model="workspaceEditForm.description" type="textarea" :rows="3" />
          </el-form-item>
        </el-form>

        <span slot="footer">
          <el-button @click="editWorkspaceDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitWorkspaceEdit">保存</el-button>
        </span>
      </el-dialog>
      <!-- =====编辑workspace弹窗结束===== -->
      <!-- =====新建workspace弹窗开始===== -->
      <el-dialog
        title="新建Workspace"
        :visible.sync="createWorkspaceDialogVisible"
        width="600px"
        @closed="resetWorkspaceForm"
      >
        <el-form
          ref="workspaceForm"
          :model="workspaceForm"
          :rules="workspaceRules"
          label-width="120px"
        >
          <el-form-item label="名称" prop="name">
            <el-input
              v-model="workspaceForm.name"
              placeholder="英文标识符，小写字母开头"
              clearable
            />
            <div class="workspace-form-tip">唯一标识符，创建后不可修改</div>
          </el-form-item>

          <el-form-item label="别名" prop="alias">
            <el-input
              v-model="workspaceForm.alias"
              placeholder="中文显示名称"
            />
          </el-form-item>

          <el-form-item label="描述" prop="description">
            <el-input
              v-model="workspaceForm.description"
              type="textarea"
              :rows="3"
              placeholder="工作空间详细描述"
            />
          </el-form-item>
        </el-form>

        <span slot="footer">
          <el-button @click="createWorkspaceDialogVisible = false">取消</el-button>
          <el-button
            type="primary"
            :loading="createWorkspaceLoading"
            @click="submitWorkspaceForm"
          >确认创建</el-button>
        </span>
      </el-dialog>
      <!-- =====新建workspace弹窗结束===== -->

      <el-tab-pane v-if="isClusterAdmin" label="用户栏" name="user">
        <div class="table-header">
          <el-input
            v-model="userSearch"
            placeholder="🔍 搜索用户名..."
            clearable
            style="width: 300px"
          />
          <el-button
            v-if="hasClusterAdminRole"
            type="primary"
            icon="el-icon-plus"
            @click="createUser"
          >新建用户</el-button>
        </div>
        <!-- 用户表格部分 -->
        <el-table :data="filteredUserList" border>
          <el-table-column prop="metadata.name" label="用户名" width="120" />
          <el-table-column prop="spec.email" label="邮箱" />
          <el-table-column prop="spec.phone" label="电话" />
          <el-table-column prop="spec.state" label="状态" width="80" />
          <el-table-column label="操作" width="280">
            <template v-slot="{ row }">
              <div style="display: inline-flex; gap: 4px; flex-wrap: nowrap">
                <el-button size="mini" @click.stop="viewUser(row)">查看</el-button>
                <el-button size="mini" type="primary" @click.stop="editUser(row)">编辑</el-button>
                <el-button size="mini" @click.stop="viewPermissions(row)">权限</el-button>
                <el-button size="mini" type="danger" @click.stop="deleteUser(row)">删除</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <!-- =====创建用户弹窗开始===== -->
        <el-dialog
          title="新建用户"
          :visible.sync="createUserDialogVisible"
          width="600px"
          @closed="resetUserForm"
        >
          <el-form
            ref="userForm"
            :model="userForm"
            :rules="userRules"
            label-width="100px"
          >
            <el-form-item label="用户名" prop="username">
              <el-input v-model="userForm.username" placeholder="英文标识符，不可重复" />
            </el-form-item>

            <el-form-item label="显示名称" prop="displayName">
              <el-input v-model="userForm.displayName" placeholder="支持中文" />
            </el-form-item>

            <el-form-item label="邮箱" prop="email">
              <el-input v-model="userForm.email" placeholder="用户邮箱" />
            </el-form-item>

            <el-form-item label="密码" prop="password">
              <el-input
                v-model="userForm.password"
                type="password"
                placeholder="至少8位，包含大小写字母和数字"
              />
            </el-form-item>

            <el-form-item label="手机号" prop="phone">
              <el-input v-model="userForm.phone" placeholder="用户联系电话" />
            </el-form-item>

            <el-form-item label="账号状态">
              <el-select v-model="userForm.state">
                <el-option label="激活" value="active" />
                <el-option label="禁用" value="disabled" />
              </el-select>
            </el-form-item>

            <el-form-item label="角色分配">
              <el-radio-group v-model="userForm.roleType">
                <el-radio label="workspace">Workspace角色</el-radio>
                <el-radio label="cluster">集群角色</el-radio>
              </el-radio-group>
              <!-- 默认选中的菜单栏userForm.roleType === 'workspace' -->
              <template v-if="userForm.roleType === 'workspace'">
                <el-select
                  v-model="userForm.workspaceName"
                  placeholder="选择Workspace"
                  style="margin-right: 10px"
                >
                  <el-option
                    v-for="ws in workspaces"
                    :key="ws.name"
                    :label="ws.name"
                    :value="ws.name"
                  />
                </el-select>
                <el-select v-model="userForm.workspaceRole" placeholder="选择角色">
                  <el-option label="管理员" value="admin" />
                  <el-option label="编辑者" value="edit" />
                  <el-option label="查看者" value="view" />
                </el-select>
              </template>

              <template v-else>
                <el-select v-model="userForm.clusterRole" placeholder="选择集群角色">
                  <el-option label="管理员" value="admin" />
                  <el-option label="编辑者" value="edit" />
                  <el-option label="查看者" value="view" />
                </el-select>

              </template>
            </el-form-item>
          </el-form>

          <span slot="footer">
            <el-button @click="createUserDialogVisible = false">取消</el-button>
            <el-button
              type="primary"
              :loading="createLoading"
              @click="submitUserForm"
            >确认创建</el-button>
          </span>
        </el-dialog>
        <!-- =====创建用户弹窗结束===== -->
        <!-- =====用户弹窗权限详情 Dialog开始===== -->
        <el-dialog :visible.sync="permissionDialogVisible" title="用户权限详情" width="600px">
          <!-- 修改1：使用独立的 permissionActiveTab -->
          <el-tabs v-model="permissionActiveTab">
            <el-tab-pane label="集群角色" name="cluster">
              <el-table :data="clusterRoles">
                <el-table-column label="角色" prop="role" />
                <el-table-column label="来源" prop="bindingName" />
              </el-table>
            </el-tab-pane>
            <el-tab-pane label="Workspace 角色" name="workspace">
              <el-table :data="workspaceRoles">
                <el-table-column label="Workspace" prop="workspace" />
                <el-table-column label="角色" prop="role" />
                <el-table-column label="来源" prop="bindingName" />
              </el-table>
            </el-tab-pane>
          </el-tabs>
        </el-dialog>
        <!-- =====用户弹窗权限详情 Dialog结束===== -->

        <el-alert title="此区域仅集群管理员可见，可用于查看和管理所有用户。" type="info" show-icon />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { debounce } from 'lodash'

export default {
  name: 'Dashboard',
  data() {
    // workspace名称校验 新增异步校验方法
    const validateNameUnique = debounce(async(rule, value, callback) => { // [!code ++]
      if (!value || value.length < 3) return callback()

      try {
        await this.$api.dashboard.checkWorkspaceExists(value)
        callback(new Error('该名称已被使用'))
      } catch (error) {
        if (error.response?.status === 404) {
          callback()
        } else {
          callback()
        }
      }
    }, 300)
    return {
      // 用户权限查看
      permissionDialogVisible: false,
      permissionActiveTab: 'cluster', // 权限弹框独立标签变量
      clusterRoles: [],
      workspaceRoles: [],
      // workspace相关
      workspaceSearch: '',
      userSearch: '',
      activeTab: 'workspace',
      // 查看和编辑workspace
      viewWorkspaceDialogVisible: false,
      editWorkspaceDialogVisible: false,
      viewedWorkspace: {
        name: '',
        alias: '',
        description: '',
        creationTimestamp: ''
      },
      workspaceEditForm: {
        name: '',
        alias: '',
        description: ''
      },
      // 创建workspace表单
      // 新增Workspace表单相关数据
      createWorkspaceDialogVisible: false,
      createWorkspaceLoading: false,
      workspaceForm: {
        name: '',
        alias: '',
        description: ''
      },
      workspaceRules: {
        name: [
          {
            required: true,
            message: '名称不能为空',
            trigger: 'blur'
          },
          {
            pattern: /^[a-z][a-z0-9-]{2,19}$/,
            message: '3-20位小写字母、数字或中划线，以小写字母开头',
            trigger: 'blur'
          },
          { // [!code ++]
            validator: validateNameUnique,
            trigger: 'blur'
          },
          {
            validator: this.createDebouncedValidator(), // [!code ++]
            trigger: 'blur'
          }
        ],
        alias: [
          { required: true, message: '显示名称不能为空', trigger: 'blur' }
        ]
      },
      // 创建用户表单
      createUserDialogVisible: false,
      createLoading: false,
      userForm: {
        username: '',
        displayName: '',
        email: '',
        password: '',
        phone: '',
        state: 'active',
        roleType: 'workspace',
        clusterRole: '',
        workspaceName: '',
        workspaceRole: ''
      },
      userRules: {
        username: [
          { required: true, message: '用户名不能为空', trigger: 'blur' },
          { pattern: /^[a-z0-9_-]{3,20}$/, message: '3-20位小写字母、数字或_-' }
        ],
        displayName: [
          { required: true, message: '显示名称不能为空', trigger: 'blur' }
        ],
        email: [
          { required: true, message: '邮箱不能为空', trigger: 'blur' },
          { type: 'email', message: '邮箱格式不正确', trigger: 'blur' }
        ],
        password: [
          { required: true, message: '密码不能为空', trigger: 'blur' },
          {
            pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[^]{8,}$/,
            message: '至少8位且包含大小写字母和数字'
          }
        ]
      }
    }
  },
  computed: {
    ...mapGetters('user', ['username', 'email', 'userBindings', 'isClusterAdmin']),
    ...mapGetters('dashboard', ['workspaces', 'users']),

    filteredWorkspaces() {
      return this.workspaces.filter(ws =>
        (!this.workspaceSearch || ws.name.includes(this.workspaceSearch)) &&
        ws.name && ws.role
      )
    },
    filteredUserList() {
      return this.users.filter(user =>
        !this.userSearch || user.metadata?.name.includes(this.userSearch)
      )
    },
    hasClusterAdminRole() {
      return this.userBindings.some(b => b.spec?.scope?.kind === 'Cluster' && b.spec?.role === 'admin')
    }
  },
  async created() {
    try {
      await this.$store.dispatch('dashboard/getWorkspaces', this.username)
      if (this.isClusterAdmin) {
        await this.$store.dispatch('dashboard/getUserAll')
      }
    } catch (error) {
      this.$message.error('数据加载失败')
    }
  },
  methods: {
    goToWorkspace(row) {
      if (row.name) {
        this.$router.push({ name: 'workspace', params: { workspaceName: row.name }})
      }
    },
    // 查看和编辑、删除workspace按钮=====================================
    async viewWorkspace(row) {
      try {
        const detail = await this.$store.dispatch('dashboard/viewWorkspace', row.name)
        this.viewedWorkspace = {
          name: row.name,
          alias: detail.metadata.annotations?.['kubeants.io/alias-name'] || '',
          description: detail.metadata.annotations?.['kubeants.io/description'] || '',
          creationTimestamp: detail.metadata.creationTimestamp || ''
        }
        this.viewWorkspaceDialogVisible = true
      } catch (error) {
        this.$message.error('加载 Workspace 详情失败')
      }
    },
    // 编辑 Workspace
    editWorkspace(row) {
      this.workspaceEditForm = {
        name: row.name,
        alias: '',
        description: ''
      }
      this.$store.dispatch('dashboard/viewWorkspace', row.name).then(detail => {
        this.workspaceEditForm.alias = detail.metadata.annotations?.['kubeants.io/alias-name'] || ''
        this.workspaceEditForm.description = detail.metadata.annotations?.['kubeants.io/description'] || ''
        this.editWorkspaceDialogVisible = true
      }).catch(() => {
        this.$message.error('加载 Workspace 信息失败')
      })
    },

    // 提交编辑
    async submitWorkspaceEdit() {
      try {
        const { name, alias, description } = this.workspaceEditForm
        await this.$store.dispatch('dashboard/updateWorkspace', { name, alias, description })
        this.$message.success('更新成功')
        this.editWorkspaceDialogVisible = false
      } catch (error) {
        this.$message.error('更新 Workspace 失败')
      }
    },

    // 删除 Workspace
    deleteWorkspace(row) {
      this.$confirm(`确认删除 Workspace: ${row.name}？`, '警告', {
        type: 'warning'
      }).then(async() => {
        try {
          await this.$store.dispatch('dashboard/deleteWorkspace', row.name)
          this.$message.success('删除成功')
        } catch (error) {
          this.$message.error('删除失败')
        }
      })
    },
    // 查看和编辑删除workspace按钮=====================================

    // 新建workspace按钮动作触发
    createDebouncedValidator() { // [!code ++]
      return debounce(async(rule, value, callback) => {
        if (!value || value.length < 3) return callback()

        try {
          await this.$api.dashboard.checkWorkspaceExists(value)
          callback(new Error('该名称已被使用'))
        } catch (error) {
          error.response?.status === 404 ? callback() : callback()
        }
      }, 300)
    },
    createWorkspace() {
      this.createWorkspaceDialogVisible = true
    },

    // 重置表单
    resetWorkspaceForm() {
      this.$refs.workspaceForm?.resetFields()
      this.workspaceForm = {
        name: '',
        alias: '',
        description: ''
      }
    },

    // 提交表单
    async submitWorkspaceForm() {
      this.$refs.workspaceForm.validate(async(valid) => {
        if (!valid) return
        this.createWorkspaceLoading = true
        try {
          const payload = {
            apiVersion: 'workspace.kubeants.io/v1beta1',
            kind: 'Workspace',
            metadata: {
              name: this.workspaceForm.name,
              labels: {
                'kubeants.io/managed-by': 'user'
              },
              annotations: {
                'kubeants.io/alias-name': this.workspaceForm.alias,
                'kubeants.io/description': this.workspaceForm.description
              }
            },
            spec: {
              clusters: ['ka'] // 默认绑定当前集群
            }
          }
          await this.$store.dispatch('dashboard/createWorkspace', payload)
          this.$message.success('Workspace创建成功')
          this.createWorkspaceDialogVisible = false
        } catch (error) {
          let message = '创建失败'
          // 优化错误处理逻辑 // [!code ++]
          if (error.response?.data) {
            const errorData = error.response.data
            message = errorData.msg || errorData.message || errorData.error
            // 处理特定错误
            if (message.includes('already exists')) {
              message = '工作空间名称已存在，请更换名称'
            }
          } else if (error.message) {
            message += `: ${error.message}`
          }
          this.$message.error(message)
        } finally {
          this.createWorkspaceLoading = false
        }
      })
    },

    viewUser(row) {
      this.$message.info(`查看用户: ${row.metadata.name}`)
    },
    editUser(row) {
      this.$message.info(`编辑用户: ${row.metadata.name}`)
    },
    deleteUser(row) {
      this.$confirm(`确认删除用户 ${row.metadata.name}？`, '提示', {
        type: 'warning'
      }).then(() => {
        this.$message.success('用户已删除')
      })
    },

    // 新建用户按钮动作触发
    createUser() {
      this.createUserDialogVisible = true
    },
    // 新建用户弹窗表单字段定义
    resetUserForm() {
    this.$refs.userForm?.resetFields()
    this.userForm = {
      username: '',
      displayName: '',
      email: '',
      password: '',
      phone: '',
      state: 'active',
      roleType: 'workspace',
      clusterRole: '',
      workspaceName: '',
      workspaceRole: ''
    }
    },
    // 创建触发调用store接口
    submitUserForm() {
      this.$refs.userForm.validate((valid) => {
        if (!valid) return

        this.loading = true

        // 1. 构建 User 资源对象
        const userPayload = {
          apiVersion: 'user.kubeants.io/v1beta1',
          kind: 'User',
          metadata: {
            name: this.userForm.username
          },
          spec: {
            displayName: this.userForm.displayName,
            email: this.userForm.email,
            phone: this.userForm.phone,
            state: this.userForm.state
          }
        }

        if (this.userForm.password) {
          userPayload.spec.password = this.userForm.password
        }

        // 2. 检查是否需要添加默认的 UserBinding
        if (
          !this.userForm.roleType ||
        (this.userForm.roleType === 'workspace' && (!this.userForm.workspaceName || !this.userForm.workspaceRole)) ||
        (this.userForm.roleType === 'cluster' && !this.userForm.clusterRole)
        ) {
        // 默认添加 wspublic:view
          this.userForm.roleType = 'workspace'
          this.userForm.workspaceName = 'wspublic'
          this.userForm.workspaceRole = 'view'
        }

        // 3. 构建 UserBinding 对象
        const bindings = []
        if (this.userForm.roleType === 'cluster') {
          bindings.push({
            apiVersion: 'userbinding.kubeants.io/v1beta1',
            kind: 'UserBinding',
            metadata: {
              name: `cluster--${this.userForm.username}`
            },
            spec: {
              user: this.userForm.username,
              role: this.userForm.clusterRole,
              scope: {
                kind: 'Cluster',
                name: 'kubeantscluster'
              }
            }
          })
        } else if (this.userForm.roleType === 'workspace') {
          bindings.push({
            apiVersion: 'userbinding.kubeants.io/v1beta1',
            kind: 'UserBinding',
            metadata: {
              name: `workspace-${this.userForm.workspaceName}-${this.userForm.username}`
            },
            spec: {
              user: this.userForm.username,
              role: this.userForm.workspaceRole,
              scope: {
                kind: 'Workspace',
                name: this.userForm.workspaceName
              }
            }
          })
        }

        // 4. 并发创建资源
        const requests = [
          this.$k8s.postCustomResource('user.kubeants.io', 'v1beta1', '', 'users', userPayload)
        ]
        bindings.forEach((binding) => {
          requests.push(
            this.$k8s.postCustomResource('userbinding.kubeants.io', 'v1beta1', '', 'userbindings', binding)
          )
        })

        Promise.all(requests)
          .then(() => {
            this.$message.success('用户创建成功')
            this.getUsers()
            this.userDialogVisible = false
          })
          .catch((err) => {
            this.$message.error('创建失败：' + (err.message || '未知错误'))
          })
          .finally(() => {
            this.loading = false
          })
      })
    },
    // 用户角色权限查看弹窗
    async viewPermissions(user) {
      try {
        const username = user.metadata.name
        const userbindings = await this.$store.dispatch('dashboard/getUserBindings', { username })

        // 过滤角色数据
        this.clusterRoles = userbindings
          .filter(b => b.spec?.scope?.kind?.toLowerCase() === 'cluster')
          .map(b => ({
            role: b.spec.role,
            bindingName: b.metadata?.name || 'unknown'
          }))

        this.workspaceRoles = userbindings
          .filter(b => b.spec?.scope?.kind?.toLowerCase() === 'workspace')
          .map(b => ({
            workspace: b.spec?.scope?.name,
            role: b.spec.role,
            bindingName: b.metadata?.name || 'unknown'
          }))

        // 修改2：每次打开弹框时重置标签状态
        this.permissionActiveTab = 'cluster' // [!code ++]
        this.permissionDialogVisible = true
      } catch (error) {
        this.$message.error('加载用户权限失败: ' + error.message)
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.workspace-form-tip {
  color: #909399;
  font-size: 12px;
  margin-top: 4px;
}
/* 新增禁用动画的CSS */
.no-transition-tabs {
  ::v-deep {
    .el-tabs__content {
      // overflow: visible; // 修复滚动条闪烁问题
      // transition: none !important; // 禁用过渡动画
      // animation: none !important; // 禁用动画
      transition: opacity 2s !important;
      animation-duration: 2s !important;
    }
    .el-table__body-wrapper {
      overflow: auto; // 确保表格滚动条稳定
    }
  }
}
.optimized-tabs {
  ::v-deep {
    /* 完全禁用动画系统 */
    .el-tabs__content {
      transform: none !important;
      transition: none !important;
      animation: none !important;
    }

    /* 优化表格渲染性能 */
    .el-table {
      will-change: auto;
      backface-visibility: hidden;
    }

    /* 修复按钮闪现问题 */
    .el-tab-pane {
      position: relative;
      z-index: 1;
      display: none;

      &.is-active {
        display: block;
      }
    }
  }
}
.dashboard-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}
.table-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
}
.info-box {
  margin: 10px 0;
  font-size: 16px;
}
.mt-3 {
  margin-top: 12px;
}

/* 使禁用状态更明显 */
::v-deep .el-input.is-disabled .el-input__inner {
  background-color: #f5f7fa;
  border-color: #e4e7ed;
  color: #606266;
  cursor: not-allowed;
}

.workspace-form-tip {
  color: #909399;
  font-size: 12px;
  margin-top: 4px;
}
</style>
