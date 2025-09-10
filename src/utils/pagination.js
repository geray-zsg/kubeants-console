/**
 * 页面分页抽离的公用代码
 * tableData ：交给使用方去定义（就是你 filteredstorageclass 或 filteredCronjobs 的数组）。
 * pagedData ：已经分页后的数据。
 */
export default {
    data() {
      return {
        pageSize: 10,      // 每页数量
        currentPage: 1     // 当前页码
      }
    },
    computed: {
      // 把分页逻辑封装为通用计算属性
      pagedData() {
        if (!Array.isArray(this.tableData)) return []
        const start = (this.currentPage - 1) * this.pageSize
        return this.tableData.slice(start, start + this.pageSize)
      }
    },
    methods: {
      handlePageChange(page) {
        this.currentPage = page
      },
      handleSizeChange(size) {
        this.pageSize = size
        this.currentPage = 1
      }
    }
  }
  