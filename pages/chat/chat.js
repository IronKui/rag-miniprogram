// pages/chat/chat.js
const api = require('../../utils/api')
const { getToken, setToken } = require('../../utils/request')
const { chooseFile, formatSize } = require('../../utils/upload')

const app = getApp()

const MODES = ['default', 'learning', 'interview', 'roleplay']
const MODE_NAMES = ['默认', '学习模式', '面试模式', '角色扮演']
const SCOPES = ['account', 'session']
const SCOPE_NAMES = ['账号级 · 所有会话共享', '会话级 · 仅当前会话']

Page({
  data: {
    messages: [],
    sessions: [],
    currentSessionId: null,
    currentTitle: '新会话',

    mode: 'default',
    modeName: '默认',

    loading: false,
    loadingText: '正在检索',
    loadSeq: 0,

    drawerOpen: false,

    pendingFile: null,
    pendingSizeText: '',
    scopeIndex: 0,
    scopeNames: SCOPE_NAMES,

    inputValue: '',
    scrollIntoView: '',

    userName: ''
  },

  // 消息自增 id（不用随机数，避免 key 冲突）
  msgSeq: 0,

  onLoad() {
    this.msgSeq = 0
  },

  onShow() {
    if (!getToken()) {
      wx.reLaunch({ url: '/pages/login/login' })
      return
    }
    this.setData({ userName: app.globalData.username || '未登录' })
    // 从知识库页切回来时刷新会话列表
    this.loadSessions()
  },

  // ==================== 会话列表 ====================

  async loadSessions() {
    try {
      const res = await api.listSessions()
      if (res.code !== 0) return
      const sessions = (res.data || []).map((s) => ({
        id: s.session_id,
        title: s.session_name || '新会话'
      }))
      this.setData({ sessions })
    } catch (err) {
      // 401 已由 request.js 统一处理，这里静默即可
      console.error('加载会话列表失败', err)
    }
  },

  openDrawer() {
    this.setData({ drawerOpen: true })
  },

  closeDrawer() {
    this.setData({ drawerOpen: false })
  },

  /** 新建会话：不立刻在后端建，发第一条消息时才真正创建 */
  newChat() {
    this.setData({
      currentSessionId: null,
      currentTitle: '新会话',
      messages: [],
      drawerOpen: false,
      scrollIntoView: ''
    })
  },

  // ==================== 切换 / 重命名 / 删除 ====================

  onSessionTap(e) {
    const { id } = e.currentTarget.dataset
    this.switchSession(id)
  },

  async switchSession(id) {
    const s = this.data.sessions.find((x) => x.id === id)
    this.setData({
      currentSessionId: id,
      currentTitle: s ? s.title : '会话',
      drawerOpen: false,
      messages: [],
      scrollIntoView: ''
    })
    await this.loadHistory(id)
  },

  async loadHistory(sessionId) {
    this.setData({ loading: true, loadingText: '加载历史…' })
    try {
      const res = await api.sessionHistory(sessionId)
      if (res.code === 0) {
        const messages = (res.data.messages || [])
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({ id: ++this.msgSeq, role: m.role, content: m.content }))
        this.setData({ messages })
        this.scrollToBottom()
      } else {
        this.pushMessage('error', res.message)
      }
    } catch (err) {
      this.pushMessage('error', '加载历史失败：' + err.message)
    } finally {
      this.setData({ loading: false })
    }
  },

  /** 会话项上的「⋯」：重命名或删除 */
  onSessionMenu(e) {
    const { id } = e.currentTarget.dataset
    const session = this.data.sessions.find((x) => x.id === id)
    wx.showActionSheet({
      itemList: ['重命名', '删除会话'],
      success: (res) => {
        if (res.tapIndex === 0) this.renameSession(id, session ? session.title : '')
        else this.confirmDeleteSession(id)
      }
    })
  },

  renameSession(sessionId, currentTitle) {
    wx.showModal({
      title: '重命名会话',
      editable: true,
      placeholderText: '输入新的会话名称',
      content: currentTitle || '',
      success: async (res) => {
        if (!res.confirm) return
        const name = (res.content || '').trim()
        if (!name) return
        try {
          const r = await api.renameSession(sessionId, name)
          if (r.code === 0) {
            const sessions = this.data.sessions.map((s) =>
              s.id === sessionId ? { ...s, title: name } : s
            )
            const patch = { sessions }
            if (this.data.currentSessionId === sessionId) patch.currentTitle = name
            this.setData(patch)
          } else {
            wx.showToast({ title: r.message, icon: 'none' })
          }
        } catch (err) {
          wx.showToast({ title: '重命名失败：' + err.message, icon: 'none' })
        }
      }
    })
  },

  confirmDeleteSession(sessionId) {
    wx.showModal({
      title: '删除会话',
      content: '删除后聊天记录无法恢复，确定删除吗？',
      confirmColor: '#ef4444',
      success: async (res) => {
        if (!res.confirm) return
        try {
          const r = await api.deleteSession(sessionId)
          if (r.code === 0) {
            this.setData({ sessions: this.data.sessions.filter((s) => s.id !== sessionId) })
            if (this.data.currentSessionId === sessionId) this.newChat()
          } else {
            wx.showToast({ title: r.message, icon: 'none' })
          }
        } catch (err) {
          wx.showToast({ title: '删除失败：' + err.message, icon: 'none' })
        }
      }
    })
  },

  // ==================== 模式 ====================

  pickMode() {
    wx.showActionSheet({
      itemList: MODE_NAMES,
      success: (res) => {
        this.setData({ mode: MODES[res.tapIndex], modeName: MODE_NAMES[res.tapIndex] })
      }
    })
  },

  // ==================== 消息 ====================

  pushMessage(role, content) {
    const id = ++this.msgSeq
    this.setData({
      messages: this.data.messages.concat([{ id, role, content }]),
      scrollIntoView: 'msg-' + id
    })
  },

  scrollToBottom() {
    const list = this.data.messages
    if (!list.length) return
    this.setData({ scrollIntoView: 'msg-' + list[list.length - 1].id })
  },

  /** 长按消息复制到剪贴板 */
  onMessageLongPress(e) {
    const { content } = e.currentTarget.dataset
    wx.setClipboardData({ data: content })
  },

  onInput(e) {
    this.setData({ inputValue: e.detail.value })
  },

  // ==================== 附件 ====================

  async onChooseFile() {
    try {
      const file = await chooseFile()
      this.setData({ pendingFile: file, pendingSizeText: formatSize(file.size) })
    } catch (err) {
      if (err.message !== 'cancel') {
        wx.showToast({ title: err.message, icon: 'none' })
      }
    }
  },

  cancelFile() {
    this.setData({ pendingFile: null, pendingSizeText: '' })
  },

  onScopeChange(e) {
    this.setData({ scopeIndex: Number(e.detail.value) })
  },

  // ==================== 发送 ====================

  async send() {
    if (this.data.loading) return

    const question = this.data.inputValue.trim()
    const file = this.data.pendingFile
    if (!question && !file) return

    // 会话级文件必须绑定一个已存在的会话，否则后端会记到临时的 default 会话上，
    // 第一条消息之后就再也检索不到了。这里直接拦住，提示改用账号级。
    if (file && SCOPES[this.data.scopeIndex] === 'session' && !this.data.currentSessionId) {
      wx.showToast({ title: '新会话还没创建，请先发消息或改用账号级', icon: 'none' })
      return
    }

    this.setData({ inputValue: '', loading: true, loadingText: '正在检索' })

    try {
      // 1) 先上传附件
      if (file) {
        this.pushMessage('user', `上传文件：${file.name}`)
        this.setData({ pendingFile: null, pendingSizeText: '', loadingText: '正在解析文档…' })
        try {
          const up = await api.uploadFile(file, this.data.currentSessionId, SCOPES[this.data.scopeIndex])
          if (up.code === 0) {
            this.pushMessage('assistant', `${up.message}（${up.data.chunk_count} 个文本块）`)
          } else if (up.code === 1) {
            // 文件已存在，不算失败
            this.pushMessage('assistant', up.message)
          } else {
            this.pushMessage('error', `上传失败：${up.message}`)
            if (question) this.setData({ inputValue: question })
            return
          }
        } catch (err) {
          this.pushMessage('error', '上传出错：' + err.message)
          if (question) this.setData({ inputValue: question })
          return
        }
      }

      // 2) 再发问题
      if (question) {
        this.pushMessage('user', question)
        this.showLoading()

        const res = await api.chat(question, this.data.mode, this.data.currentSessionId)

        if (res.code === 0) {
          this.pushMessage('assistant', res.data.answer)

          // 延迟创建：后端首次会返回真正的 session_id
          const newId = res.data.session_id
          if (newId && newId !== this.data.currentSessionId) {
            const title = question.length > 20 ? question.slice(0, 20) + '…' : question
            this.setData({
              currentSessionId: newId,
              currentTitle: title,
              sessions: [{ id: newId, title }].concat(this.data.sessions)
            })
          }
        } else {
          this.pushMessage('error', '回复失败：' + res.message)
        }
      }
    } catch (err) {
      this.pushMessage('error', err.message)
    } finally {
      this.setData({ loading: false })
    }
  },

  /** 正在检索的占位气泡，用唯一 id 保证每次都能滚到底 */
  showLoading() {
    const loadSeq = this.data.loadSeq + 1
    this.setData({ loadSeq, loadingText: '正在检索', scrollIntoView: 'loading-' + loadSeq })
  },

  // ==================== 账号 ====================

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      success: (res) => {
        if (!res.confirm) return
        setToken('')
        app.clearUser()
        wx.reLaunch({ url: '/pages/login/login' })
      }
    })
  }
})
