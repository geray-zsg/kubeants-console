<template>
  <div>
    <!-- 用户搜索与新建 -->
    <div style="margin-bottom: 20px;">
      <el-input v-model="searchKeyword" placeholder="搜索用户名" style="width: 300px;" />
      <el-button type="primary" style="margin-left: 10px;" @click="handleCreateUser">新建用户</el-button>
    </div>

    <!-- 用户表格 -->
    <el-table :data="filteredUsers" style="width: 100%;">
      <el-table-column prop="metadata.name" label="用户名" />
      <el-table-column prop="spec.email" label="邮箱" />
      <el-table-column label="操作" width="240">
        <template slot-scope="scope">
          <el-button size="mini" @click="handleViewPermissions(scope.row)">查看权限</el-button>
          <el-button size="mini" @click="handleEditUser(scope.row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 用户弹窗 -->
    <el-dialog :title="dialogTitle" :visible.sync="dialogVisible">
      <el-form :model="dialogForm" label-width="100px">
        <el-form-item label="用户名">
          <el-input v-model="dialogForm.metadata.name" :disabled="isEditMode" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="dialogForm.spec.email" />
        </el-form-item>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitDialog">确认</el-button>
      </div>
    </el-dialog>

    <!-- 权限查看弹窗 -->
    <el-dialog title="用户权限" :visible.sync="permissionDialogVisible">
      <el-tabs v-model="activePermissionTab">
        <el-tab-pane label="ClusterRole" name="cluster">
          <el-table :data="clusterRoles" style="width: 100%;">
            <el-table-column prop="roleRef.name" label="角色名" />
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="WorkspaceRole" name="workspace">
          <el-table :data="workspaceRoles" style="width: 100%;">
            <el-table-column prop="roleRef.name" label="角色名" />
            <el-table-column prop="workspace" label="所属 Workspace" />
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-dialog>
  </div>
</template>

<script>
import {
  getUserList,
  createUser,
  updateUser,
  getUserBindings
} from '@/api/dashboard'

export default {
  name: 'UserTab',
  data() {
    return {
      searchKeyword: '',
      users: [],
      dialogVisible: false,
      isEditMode: false,
      dialogForm: {
        metadata: {
          name: ''
        },
        spec: {
          email: ''
        }
      },
      permissionDialogVisible: false,
      clusterRoles: [],
      workspaceRoles: [],
      activePermissionTab: 'cluster'
    }
  },
  computed: {
    filteredUsers() {
      return this.users.filter(user =>
        user.metadata.name.includes(this.searchKeyword)
      )
    },
    dialogTitle() {
      return this.isEditMode ? '编辑用户' : '新建用户'
    }
  },
  mounted() {
    this.fetchUsers()
  },
  methods: {
    fetchUsers() {
      getUserList().then(res => {
        this.users = res.items || []
      })
    },
    handleCreateUser() {
      this.isEditMode = false
      this.dialogForm = {
        metadata: { name: '' },
        spec: { email: '' }
      }
      this.dialogVisible = true
    },
    handleEditUser(user) {
      this.dialogForm = JSON.parse(JSON.stringify(user))
      this.dialogVisible = true
      this.isEditMode = true
    },
    submitDialog() {
      if (this.isEditMode) {
        updateUser(this.dialogForm.metadata.name, this.dialogForm).then(() => {
          this.dialogVisible = false
          this.fetchUsers()
        })
      } else {
        createUser(this.dialogForm).then(() => {
          this.dialogVisible = false
          this.fetchUsers()
        })
      }
    },
    handleViewPermissions(user) {
      getUserBindings(user.metadata.name).then(res => {
        this.clusterRoles = res.cluster || []
        this.workspaceRoles = res.workspace || []
        this.permissionDialogVisible = true
        this.activePermissionTab = 'cluster'
      })
    }
  }
}
</script>
