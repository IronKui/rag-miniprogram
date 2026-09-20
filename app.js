// app.js
App({
  globalData: {
    username: '',
    userUuid: ''
  },

  onLaunch() {
    // 恢复本地保存的账号信息（token 由 utils/request.js 统一读写 Storage）
    this.globalData.username = wx.getStorageSync('username') || ''
    this.globalData.userUuid = wx.getStorageSync('userUuid') || ''
  },

  /** 登录成功后写入全局状态 */
  setUser(username, userUuid) {
    this.globalData.username = username || ''
    this.globalData.userUuid = userUuid || ''
    wx.setStorageSync('username', this.globalData.username)
    wx.setStorageSync('userUuid', this.globalData.userUuid)
  },

  /** 退出登录时清空全局状态 */
  clearUser() {
    this.globalData.username = ''
    this.globalData.userUuid = ''
    wx.removeStorageSync('username')
    wx.removeStorageSync('userUuid')
  }
})
