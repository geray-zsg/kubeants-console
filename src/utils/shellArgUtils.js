/**
 * 将字符串（含 \n 或 ;）转为数组（用于写入 YAML）
 * @param {string} input
 * @returns {string[] | undefined}
 */
export function splitShellArgs(input) {
  if (typeof input !== 'string') return undefined
  return input
    .replace(/\\n/g, '\n') // 将 \n 字符串转为换行
    .split(/\n|;/) // 按换行或 ; 拆分
    .map(s => s.trim())
    .filter(Boolean) // 去掉空行或空字符串
}

/**
   * 将数组还原为字符串（用于渲染表单中的 <el-input>）
   * @param {string[] | string} input
   * @returns {string}
   */
export function joinShellArgs(input) {
  if (Array.isArray(input)) {
    return input.join('\n') // 使用换行分隔回显更好
  }
  return input || ''
}
