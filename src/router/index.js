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
      meta: { title: '首页', icon: 'dashboard', affix: true }
    }]
  },

  // {
  //   path: '/clusters',
  //   component: Layout,
  //   redirect: '/example/table',
  //   name: 'Example',
  //   meta: { title: '集群概览', icon: 'el-icon-s-help' },
  //   /* 集群健康状态（节点、Pod、服务数量及状态）
  //   资源使用情况（CPU、内存、存储等）
  //   事件日志（最近的重要事件和警告） */
  //   children: [
  //     // {
  //     //   path: 'table',
  //     //   name: 'Table',
  //     //   component: () => import('@/views/tree/index'),
  //     //   meta: { title: 'Table', icon: 'table' }
  //     // },
  //     // {
  //     //   path: 'tree',
  //     //   name: 'Tree',
  //     //   component: () => import('@/views/tree/index'),
  //     //   meta: { title: 'Tree', icon: 'tree' }
  //     // }
  //   ]
  // },

  //   {
  //     path: '/form',
  //     component: Layout,
  //     children: [
  //       {
  //         path: 'index',
  //         name: 'Form',
  //         component: () => import('@/views/form/index'),
  //         meta: { title: '节点管理', icon: 'form' }
  //         /* 节点列表（状态、资源使用情况）
  // 节点标签与污点（标签管理和调度策略）
  // 节点维护（排空、升级、重启） */
  //       }
  //     ]
  //   },

  {
    path: '/workloads',
    component: Layout,
    redirect: '/example/table',
    name: 'Example',
    meta: { title: '工作负载', icon: 'el-icon-s-help' },
    /* Pods（所有 Pod 列表及状态）
        Deployments（部署列表及扩缩容操作）
        StatefulSets（有状态应用管理）
        DaemonSets（守护进程集管理）
        Jobs/CronJobs（批处理任务管理） */
    children: [
      {
        path: 'table',
        name: 'Table',
        component: () => import('@/views/tree/index'),
        meta: { title: '无状态服务', icon: 'table' }
      },
      // {
      //   path: 'tree',
      //   name: 'Tree',
      //   component: () => import('@/views/tree/index'),
      //   meta: { title: '有状态服服务', icon: 'tree' }
      // },
      // {
      //   path: 'table',
      //   name: 'Table',
      //   component: () => import('@/views/tree/index'),
      //   meta: { title: '任务', icon: 'table' }
      // },
      // {
      //   path: 'tree',
      //   name: 'Tree',
      //   component: () => import('@/views/tree/index'),
      //   meta: { title: '定时任务', icon: 'tree' }
      // },
      {
        path: 'tree',
        name: 'Tree',
        component: () => import('@/views/tree/index'),
        meta: { title: '容器组', icon: 'tree' }
      }
    ]
  },
  /*
  {
    path: '/services',
    component: Layout,
    redirect: '/example/table',
    name: 'Example',
    meta: { title: '服务与路由', icon: 'el-icon-s-help' },
    // Services（服务列表及类型：ClusterIP、NodePort、LoadBalancer）
    // Ingress（路由规则及证书管理）
    // ConfigMaps（配置管理）
    // Secrets（敏感信息管理）
    children: [
      {
        path: 'table',
        name: 'Table',
        component: () => import('@/views/tree/index'),
        meta: { title: '服务', icon: 'table' }
      },
      {
        path: 'tree',
        name: 'Tree',
        component: () => import('@/views/tree/index'),
        meta: { title: '路由', icon: 'tree' }
      },
      {
        path: 'table',
        name: 'Table',
        component: () => import('@/views/tree/index'),
        meta: { title: '配置映射', icon: 'table' }
      },
      {
        path: 'tree',
        name: 'Tree',
        component: () => import('@/views/tree/index'),
        meta: { title: '保密字典', icon: 'tree' }
      }
    ]
  },

  {
    path: '/storages',
    component: Layout,
    redirect: '/example/table',
    name: 'Example',
    meta: { title: '存储与持久化', icon: 'el-icon-s-help' },
    // Persistent Volumes（持久卷列表）
    // Persistent Volume Claims（持久卷声明）
    // Storage Classes（存储类管理）
    // Horizontal Pod Autoscalers（自动扩缩容策略）
    children: [
      {
        path: 'table',
        name: 'Table',
        component: () => import('@/views/tree/index'),
        meta: { title: '持久卷', icon: 'table' }
      },
      {
        path: 'tree',
        name: 'Tree',
        component: () => import('@/views/tree/index'),
        meta: { title: '持久卷声明', icon: 'tree' }
      },
      {
        path: 'table',
        name: 'Table',
        component: () => import('@/views/tree/index'),
        meta: { title: '存储类', icon: 'table' }
      },
      {
        path: 'tree',
        name: 'Tree',
        component: () => import('@/views/tree/index'),
        meta: { title: '自动扩缩容策略', icon: 'tree' }
      }
    ]
  }, */

  {
    path: '/form',
    component: Layout,
    children: [
      {
        path: 'index',
        name: 'Form',
        component: () => import('@/views/form/index'),
        meta: { title: '节点管理', icon: 'form' }
        /* 节点列表（状态、资源使用情况）
节点标签与污点（标签管理和调度策略）
节点维护（排空、升级、重启） */
      }
    ]
  },

  {
    path: '/nested',
    component: Layout,
    redirect: '/nested/menu1',
    name: 'Nested',
    meta: {
      title: '网络与安全',
      icon: 'nested'
    },
    /* Network Policies（网络策略管理）
Role-Based Access Control (RBAC)（角色和权限管理）
Service Mesh（如 Istio 的配置，如果适用）
Pod Security Policies（Pod 安全策略） */
    children: [
      {
        path: 'menu1',
        component: () => import('@/views/nested/menu1/index'), // Parent router-view
        name: 'Menu1',
        meta: { title: 'Menu1' },
        children: [
          {
            path: 'menu1-1',
            component: () => import('@/views/nested/menu1/menu1-1'),
            name: 'Menu1-1',
            meta: { title: 'Menu1-1' }
          },
          {
            path: 'menu1-2',
            component: () => import('@/views/nested/menu1/menu1-2'),
            name: 'Menu1-2',
            meta: { title: 'Menu1-2' },
            children: [
              {
                path: 'menu1-2-1',
                component: () => import('@/views/nested/menu1/menu1-2/menu1-2-1'),
                name: 'Menu1-2-1',
                meta: { title: 'Menu1-2-1' }
              },
              {
                path: 'menu1-2-2',
                component: () => import('@/views/nested/menu1/menu1-2/menu1-2-2'),
                name: 'Menu1-2-2',
                meta: { title: 'Menu1-2-2' }
              }
            ]
          },
          {
            path: 'menu1-3',
            component: () => import('@/views/nested/menu1/menu1-3'),
            name: 'Menu1-3',
            meta: { title: 'Menu1-3' }
          }
        ]
      },
      {
        path: 'menu2',
        component: () => import('@/views/nested/menu2/index'),
        name: 'Menu2',
        meta: { title: 'menu2' }
      }
    ]
  },

  {
    path: 'external-link',
    component: Layout,
    children: [
      {
        path: 'https://panjiachen.github.io/vue-element-admin-site/#/',
        meta: { title: 'External Link', icon: 'link' }
      }
    ]
  },

  // 404 page must be placed at the end !!!
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
