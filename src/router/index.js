import Vue from 'vue'
import Router from 'vue-router'

Vue.use(Router)

/* Layout */
import Layout from '@/layout'

/**
 * Note: sub-menu only appear when route children.length >= 1
 * Detail see: https://panjiachen.github.io/vue-element-admin-site/guide/essentials/router-and-nav.html
 *
 * hidden: true                   if set true, item will not show in the sidebar(default is false)
 * alwaysShow: true               if set true, will always show the root menu
 *                                if not set alwaysShow, when item has more than one children route,
 *                                it will becomes nested mode, otherwise not show the root menu
 * redirect: noRedirect           if set noRedirect will no redirect in the breadcrumb
 * name:'router-name'             the name is used by <keep-alive> (must set!!!)
 * meta : {
    roles: ['admin','editor']    control the page roles (you can set multiple roles)
    title: 'title'               the name show in sidebar and breadcrumb (recommend set)
    icon: 'svg-name'/'el-icon-x' the icon show in the sidebar
    breadcrumb: false            if set false, the item will hidden in breadcrumb(default is true)
    activeMenu: '/example/list'  if set path, the sidebar will highlight the path you set
  }
 */

/**
   * 动态路由
   */
export const asyncRoutes = [
  {
    path: '/nodes',
    component: Layout,
    redirect: '/nodes/index', // 添加重定向
    meta: { title: '节点管理', icon: 'nodes', roles: ['clusterRole'] }, // 将meta提到父级
    children: [
      {
        path: 'index',
        name: 'Node',
        component: () => import('@/views/nodes/index'),
        meta: { title: '节点管理', icon: 'table' } // 子路由可以简化
      }
    ]
  }
]

/**
 * constantRoutes
 * a base page that does not have permission requirements
 * all roles can be accessed
 */
export const constantRoutes = [
  {
    path: '/login',
    component: () => import('@/views/login/index'),
    hidden: true
  },

  {
    path: '/404',
    component: () => import('@/views/404'),
    hidden: true
  },

  {
    path: '/',
    component: Layout,
    redirect: '/dashboard',
    children: [{
      path: 'dashboard',
      name: 'Dashboard',
      component: () => import('@/views/dashboard/index'),
      meta: { title: '蚁挚首页', icon: 'dashboard', affix: true }
    }]
  },

  {
    path: '/workspace',
    component: Layout,
    children: [
      {
        path: ':workspaceName', // 动态参数
        name: 'workspace', // 注意：这里是 'workspace'
        component: () => import('@/views/workspace/index.vue'),
        meta: { title: '工作空间', icon: 'tree' }
      }
    ]
  },

  {
    path: '/namespace',
    component: Layout,
    children: [
      {
        path: '/namespace/:workspaceName/:namespaceName', // 动态参数
        name: 'NamespacePage', // 注意：这里是 'workspace'
        component: () => import('@/views/namespace/index.vue'),
        meta: { title: '命名空间', icon: 'tree' }
      }
    ]
  },

  {
    path: '/workloads',
    component: Layout,
    redirect: '/workloads/table',
    name: 'Workloads',
    meta: { title: '工作负载', icon: 'el-icon-s-help' },
    children: [
      {
        path: 'deployment',
        name: 'Deployment',
        component: () => import('@/views/deployment/index'),
        meta: { title: '无状态服务', icon: 'table' }
      },
      {
        path: 'statefulsets',
        name: 'Statefulsets',
        component: () => import('@/views/statefulsets/index'),
        meta: { title: '有状态服务', icon: 'table' }
      },
      {
        path: 'daemonsets',
        name: 'Daemonsets',
        component: () => import('@/views/daemonsets/index'),
        meta: { title: '守护进程', icon: 'table' }
      },
      {
        path: 'services',
        name: 'Services',
        component: () => import('@/views/services/index'),
        meta: { title: '服务', icon: 'table' }
      },
      {
        path: 'jobs',
        name: 'Jobs',
        component: () => import('@/views/jobs/index'),
        meta: { title: '任务', icon: 'table' }
      },
      {
        path: 'cronjobs',
        name: 'Cronjobs',
        component: () => import('@/views/cronjobs/index'),
        meta: { title: '定时任务', icon: 'table' }
      },
      {
        path: 'pod',
        name: 'Pod',
        component: () => import('@/views/pod/index'),
        meta: { title: '容器组', icon: 'tree' }
      }
    ]
  },

  {
    path: '/services',
    component: Layout,
    redirect: '/example/table',
    name: 'Example',
    meta: { title: '配置文件', icon: 'el-icon-s-help' },
    children: [
      {
        path: 'configmap',
        name: 'configmap',
        component: () => import('@/views/configmap/index'),
        meta: { title: '配置映射', icon: 'el-icon-s-order' }
      },
      {
        path: 'secret',
        name: 'secret',
        component: () => import('@/views/secret/index'),
        meta: { title: '保密字典', icon: 'el-icon-s-order' }
      }
    ]
  },

  {
    path: '/storages',
    component: Layout,
    redirect: '/storages/table',
    name: 'Storages',
    meta: { title: '存储与持久化', icon: 'el-icon-s-help' },
    children: [
      {
        path: 'storageclass',
        name: 'storageclass',
        component: () => import('@/views/storageclass/index'),
        meta: { title: '存储类', icon: 'table' }
      },
      {
        path: 'persistentvolumes',
        name: 'persistentvolumes',
        component: () => import('@/views/persistentvolumes/index'),
        meta: { title: '持久卷', icon: 'table' }
      },
      {
        path: 'persistentvolumeclaims',
        name: 'persistentvolumeclaims',
        component: () => import('@/views/persistentvolumeclaims/index'),
        meta: { title: '持久卷声明', icon: 'tree' }
      }
    ]
  },

  // {
  //   path: '/nodes',
  //   component: Layout,
  //   children: [
  //     {
  //       path: 'index',
  //       name: 'Node',
  //       component: () => import('@/views/nodes/index'),
  //       meta: { title: '节点管理', icon: 'nodes', requireClusterRole: true  }
  //     }
  //   ]
  // },

  { path: '*', redirect: '/404', hidden: true }
]

const createRouter = () => new Router({
  // mode: 'history', // require service support
  scrollBehavior: () => ({ y: 0 }),
  routes: constantRoutes
})

const router = createRouter()

// Detail see: https://github.com/vuejs/vue-router/issues/1234#issuecomment-357941465
export function resetRouter() {
  const newRouter = createRouter()
  router.matcher = newRouter.matcher // reset router
}

export default router
