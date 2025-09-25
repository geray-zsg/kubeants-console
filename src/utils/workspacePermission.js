// utils/workspacePermission.js

// role 等价表
const ROLE_MAP = {
  admin: 'admin',
  'ka-admin': 'admin',
  edit: 'edit',
  'ka-edit': 'edit',
  view: 'view',
  'ka-view': 'view'
}

/**
   * 判断用户是否具备对某个 workspace 的操作权限
   * @param {Array} userBindings - Vuex 存储的 userBindings
   * @param {String} wsName - 当前 workspace
   * @param {String} action - 动作 [create|delete|edit|view]
   * @returns {Boolean}
   */
export function hasWorkspacePermission(userBindings, { wsName, action }) {
  if (!userBindings || userBindings.length === 0) {
    console.log(`[Workspace权限检查] 用户绑定信息为空，无 ${action} 权限 (ws: ${wsName})`)
    return false
  }

  console.log(`[Workspace权限检查] 检查当前workspace的权限`)

  // 把 action 映射到角色
  const roleOrder = ['view', 'edit', 'admin']
  const actionRequiredRole = {
    view: 'view',
    edit: 'edit',
    create: 'edit', // 在workspace级别，创建资源通常需要edit权限
    delete: 'admin' // 删除workspace需要admin权限
  }

  const requiredRole = actionRequiredRole[action]
  if (!requiredRole) {
    console.log(`[Workspace权限检查] 未知的操作类型: ${action} (ws: ${wsName})`)
    return false
  }

  const requiredIndex = roleOrder.indexOf(requiredRole)

  return userBindings.some(b => {
    const kind = b.spec?.scope?.kind
    const name = b.spec?.scope?.name
    const role = ROLE_MAP[b.spec?.role]

    if (!role) return false
    const roleIndex = roleOrder.indexOf(role)

    // 权限等级判断
    const canDo = roleIndex >= requiredIndex

    // 范围匹配 - 只检查Cluster和Workspace级别的权限
    if (kind === 'Cluster') return canDo
    if (kind === 'Workspace' && name === wsName) return canDo

    return false
  })
}

//   /**
//    * 获取用户在workspace中的角色
//    * @param {Array} userBindings - Vuex 存储的 userBindings
//    * @param {String} wsName - 当前 workspace
//    * @returns {String} 用户角色 (admin, edit, view) 或 null
//    */
//   export function getWorkspaceRole(userBindings, wsName) {
//     if (!userBindings || userBindings.length === 0) {
//       return null
//     }

//     // 查找最高权限的角色
//     let highestRole = null
//     const roleOrder = ['view', 'edit', 'admin']

//     userBindings.forEach(b => {
//       const kind = b.spec?.scope?.kind
//       const name = b.spec?.scope?.name
//       const role = ROLE_MAP[b.spec?.role]

//       if (!role) return

//       // 检查范围匹配
//       const isMatch = kind === 'Cluster' || (kind === 'Workspace' && name === wsName)

//       if (isMatch) {
//         const currentIndex = roleOrder.indexOf(role)
//         const highestIndex = highestRole ? roleOrder.indexOf(highestRole) : -1

//         if (currentIndex > highestIndex) {
//           highestRole = role
//         }
//       }
//     })

//     return highestRole
//   }
