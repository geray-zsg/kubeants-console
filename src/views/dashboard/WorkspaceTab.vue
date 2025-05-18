<template>
  <div>
    <!-- Workspace 操作区域 -->
    <div style="margin-bottom: 20px;">
      <el-input v-model="searchKeyword" placeholder="搜索 Workspace 名称" style="width: 300px;" />
      <el-button type="primary" style="margin-left: 10px;" @click="handleCreateWorkspace">新建 Workspace</el-button>
    </div>

    <!-- Workspace 表格 -->
    <el-table :data="filteredWorkspaces" style="width: 100%;">
      <el-table-column prop="metadata.name" label="名称" />
      <el-table-column label="操作" width="200">
        <template slot-scope="scope">
          <el-button size="mini" @click="handleViewWorkspace(scope.row)">查看</el-button>
          <el-button size="mini" @click="handleEditWorkspace(scope.row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- Workspace 弹窗 -->
    <el-dialog :title="dialogTitle" :visible.sync="dialogVisible">
      <el-form :model="dialogForm" label-width="100px">
        <el-form-item label="名称">
          <el-input v-model="dialogForm.metadata.name" :disabled="isEditMode" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="dialogForm.spec.description" />
        </el-form-item>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitDialog">确认</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { getWorkspaceList, createWorkspace, updateWorkspace } from '@/api/dashboard'

export default {
  name: 'WorkspaceTab',
  data() {
    return {
      searchKeyword: '',
      workspaces: [],
      dialogVisible: false,
      isEditMode: false,
      dialogForm: {
        metadata: {
          name: ''
        },
        spec: {
          description: ''
        }
      }
    }
  },
  computed: {
    filteredWorkspaces() {
      return this.workspaces.filter(ws =>
        ws.metadata.name.includes(this.searchKeyword)
      )
    },
    dialogTitle() {
      return this.isEditMode ? '编辑 Workspace' : '新建 Workspace'
    }
  },
  mounted() {
    this.fetchWorkspaces()
  },
  methods: {
    fetchWorkspaces() {
      getWorkspaceList().then(res => {
        this.workspaces = res.items || []
      })
    },
    handleCreateWorkspace() {
      this.isEditMode = false
      this.dialogForm = {
        metadata: { name: '' },
        spec: { description: '' }
      }
      this.dialogVisible = true
    },
    handleViewWorkspace(workspace) {
      this.dialogForm = JSON.parse(JSON.stringify(workspace))
      this.dialogVisible = true
      this.isEditMode = true
    },
    handleEditWorkspace(workspace) {
      this.dialogForm = JSON.parse(JSON.stringify(workspace))
      this.dialogVisible = true
      this.isEditMode = true
    },
    submitDialog() {
      if (this.isEditMode) {
        updateWorkspace(this.dialogForm.metadata.name, this.dialogForm).then(() => {
          this.dialogVisible = false
          this.fetchWorkspaces()
        })
      } else {
        createWorkspace(this.dialogForm).then(() => {
          this.dialogVisible = false
          this.fetchWorkspaces()
        })
      }
    }
  }
}
</script>
