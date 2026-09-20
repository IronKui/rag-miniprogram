// pages/login/login.js
const api = require('../../utils/api')
const { setToken, getToken } = require('../../utils/request')

const app = getApp()

Page({
  data: {
    isRegister: false,
    username: '',
    password: '',
    nickname: '',
    error: '',
    submitting: false
  },

  onLoad() {
    // 已有有效 token 直接进主界面（真正校验交给首个接口，401 会自动踢回登录页）
    if (getToken()) {
      wx.switchTab({ url: '/pages/chat/chat' })
    }
  },

  onInput(e) {
    // 每个输入框用 data-field 标注字段名，一个 handler 复用
    const field = e.currentTarget.dataset.field
    this.setData({ [field]: e.detail.value })
  },

  toggleMode() {
    this.setData({ isRegister: !this.data.isRegister, error: '' })
  },

  async onSubmit() {
    if (this.data.submitting) return

    const username = this.data.username.trim()
    const password = this.data.password
    const nickname = this.data.nickname.trim()

    if (!username || !password) {
      this.setData({ error: '请填写用户名和密码' })
      return
    }
    if (this.data.isRegister && password.length < 6) {
      this.setData({ error: '密码至少 6 位' })
      return
    }

    this.setData({ submitting: true, error: '' })
    try {
      const res = this.data.isRegister
        ? await api.register(username, password, nickname)
        : await api.login(username, password)

      if (res.code === 0) {
        setToken(res.data.token)
        app.setUser(username, res.data.user_uuid)
        wx.switchTab({ url: '/pages/chat/chat' })
      } else {
        this.setData({ error: res.message || '操作失败' })
      }
    } catch (err) {
      this.setData({ error: err.message })
    } finally {
      this.setData({ submitting: false })
    }
  }
})
