import axios from 'axios'
import { MessageBox, Message } from 'element-ui'
import store from '@/store'
import { getToken } from '@/utils/auth'

// 👇改这里：支持运行时读取 config.json 设置
const baseURL =
  window._env_?.VUE_APP_BASE_API || process.env.VUE_APP_BASE_API || '/'

// create an axios instance，创建axios实例
const service = axios.create({
  // baseURL: process.env.VUE_APP_BASE_API, // url = base url + request url
  baseURL,
  // withCredentials: true, // send cookies when cross-domain requests
  timeout: 5000 // 超时时间
})

// request interceptor，请求拦截
service.interceptors.request.use(
  config => {
    // do something before request is sent

    if (store.getters.token) {
      // let each request carry token
      // ['X-Token'] is a custom headers key
      // please modify it according to the actual situation
      const token = getToken()
      config.headers['X-Token'] = token // 将token每次都带入请求头，不用每次给接口都写token信息
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  },
  error => {
    // do something with request error
    console.log('请求拦截异常', error) // for debug
    return Promise.reject(error)
  }
)

// response interceptor，响应拦截
service.interceptors.response.use(
  // 成功响应处理（HTTP 状态码 2xx）
  response => {
    // 直接返回响应数据，不再检查 code
    return response.data
  },
  // 错误响应处理（HTTP 状态码非 2xx）
  error => {
    // 添加跳过判断
    if (error.config?.skipGlobalError) {
      console.log('跳过全局错误提示')
      return Promise.reject(error)
    }
    const { response } = error

    // 处理有响应的错误（如 4xx、5xx）
    if (response) {
      const { status, data } = response
      const message = data.message || error.message

      console.log('request.js错误处理', message)
      // 新增409状态码处理
      if (status === 409) {
        Message({
          message: message || '资源已存在',
          type: 'warning',
          duration: 5 * 1000
        })
        return Promise.reject(error)
      }
      // 示例：401 表示未授权，跳转到登录页
      if (status === 401) {
        MessageBox.confirm('登录已过期，请重新登录', '确认登出', {
          confirmButtonText: '重新登录',
          cancelButtonText: '取消',
          type: 'warning'
        }).then(() => {
          store.dispatch('user/resetToken').then(() => {
            location.reload()
          })
        })
      } else {
        // 其他错误显示后端返回的 message 或默认错误
        Message({
          message: message || `请求错误：${status}`,
          type: 'error',
          duration: 5 * 1000
        })
      }
    } else {
      // 处理无响应的错误（如网络中断）
      Message({
        message: '网络连接失败，请检查网络',
        type: 'error',
        duration: 5 * 1000
      })
    }

    return Promise.reject(error)
  }
)

export default service
