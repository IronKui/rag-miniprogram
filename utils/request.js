// utils/request.js —— wx.request / wx.uploadFile 的 Promise 封装
const { BASE_URL } = require('../config')

const TOKEN_KEY = 'token'

function getToken() {
  return wx.getStorageSync(TOKEN_KEY) || ''
}

function setToken(token) {
  wx.setStorageSync(TOKEN_KEY, token || '')
}

/** token 失效：清空登录态并回到登录页（加锁避免并发请求重复跳转） */
let redirecting = false
function handleUnauthorized() {
  if (redirecting) return
  redirecting = true
  setToken('')
  try {
    getApp().clearUser()
  } catch (e) {
    // getApp() 在极早期可能不可用，忽略
  }
  wx.reLaunch({
    url: '/pages/login/login',
    complete: () => {
      redirecting = false
    }
  })
}

/**
 * 发起请求，resolve 后端返回的 JSON 对象（{code, message, data}）
 * 注意：后端业务错误也走 resolve，由调用方判断 code；只有网络/HTTP 层错误才 reject
 */
function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const header = Object.assign({ 'Content-Type': 'application/json' }, options.header)
    const token = getToken()
    if (token) header.Authorization = 'Bearer ' + token

    wx.request({
      url: BASE_URL + url,
      method: options.method || 'GET',
      data: options.data,
      header,
      success(res) {
        if (res.statusCode === 401) {
          handleUnauthorized()
          reject(new Error('登录已过期，请重新登录'))
          return
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error('服务异常 (HTTP ' + res.statusCode + ')'))
          return
        }
        resolve(res.data || {})
      },
      fail(err) {
        reject(new Error(networkMessage(err)))
      }
    })
  })
}

/**
 * 上传文件（multipart/form-data），resolve 后端返回的 JSON 对象
 * @param {string} filePath 本地临时文件路径
 * @param {object} formData 附加表单字段，如 { session_id, scope }
 */
function upload(filePath, formData = {}, options = {}) {
  return new Promise((resolve, reject) => {
    const header = {}
    const token = getToken()
    if (token) header.Authorization = 'Bearer ' + token

    wx.uploadFile({
      url: BASE_URL + (options.url || '/api/upload'),
      filePath,
      name: 'file',
      formData,
      header,
      success(res) {
        if (res.statusCode === 401) {
          handleUnauthorized()
          reject(new Error('登录已过期，请重新登录'))
          return
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error('上传失败 (HTTP ' + res.statusCode + ')'))
          return
        }
        // uploadFile 返回的 data 是字符串，需要手动解析
        try {
          resolve(JSON.parse(res.data))
        } catch (e) {
          reject(new Error('上传响应解析失败'))
        }
      },
      fail(err) {
        reject(new Error(networkMessage(err)))
      }
    })
  })
}

/** 把 wx 的错误信息翻译成人话 */
function networkMessage(err) {
  const msg = (err && err.errMsg) || ''
  if (msg.indexOf('timeout') > -1) return '请求超时，模型可能还在思考，请稍后重试'
  if (msg.indexOf('domain list') > -1 || msg.indexOf('not in domain') > -1) {
    return '域名未校验：请在开发者工具「详情 → 本地设置」勾选「不校验合法域名」'
  }
  if (msg.indexOf('fail') > -1) return '无法连接后端，请确认服务已启动且地址正确'
  return msg || '网络请求失败'
}

module.exports = { request, upload, getToken, setToken, BASE_URL }
