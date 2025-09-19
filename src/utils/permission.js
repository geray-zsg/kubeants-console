// utils/permission.js
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
   * 判断用户是否具备某个操作权限
   * @param {Array} userBindings - Vuex 存储的 userBindings
   * @param {String} wsName - 当前 workspace
   * @param {String} nsName - 当前 namespace
   * @param {String} action - 动作 [create|delete|edit|view]
   * @returns {Boolean}
   */
export function hasPermission(userBindings, { wsName, nsName, action }) {
  if (!userBindings || userBindings.length === 0) {
    console.log(`[权限检查] 用户绑定信息为空，无 ${action} 权限 (ws: ${wsName}, ns: ${nsName})`)
    return false
  }

  console.log(`[权限检查] 用户绑定信息不为空，检查当前workspace和namespace的权限`)
  // 把 action 映射到角色
  const roleOrder = ['view', 'edit', 'admin']
  const actionRequiredRole = {
    view: 'view',
    edit: 'edit',
    create: 'admin',
    delete: 'admin'
  }

  const requiredRole = actionRequiredRole[action]
  if (!requiredRole) {
    console.log(`[权限检查] 未知的操作类型: ${action} (ws: ${wsName}, ns: ${nsName})`)
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

    // 范围匹配
    if (kind === 'Cluster') return canDo
    if (kind === 'Workspace' && name === wsName) return canDo
    if (kind === 'Namespace' && name === nsName) return canDo

    return false
  })
}
