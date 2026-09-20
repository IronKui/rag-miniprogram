// pages/files/files.js
const api = require('../../utils/api')
const { getToken } = require('../../utils/request')
const { chooseFile, formatSize } = require('../../utils/upload')

const app = getApp()

/** 后端存的是 UTC 的 "YYYY-MM-DD HH:MM:SS"，转成本地时间展示 */
function formatTime(raw) {
  if (!raw) return ''
  const d = new Date(String(raw).replace(' ', 'T') + 'Z')
  if (isNaN(d.getTime())) return String(raw).slice(0, 16)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

Page({
  data: {
    files: [],
    loading: false,
    uploading: false,
    userName: ''
  },

  onShow() {
    if (!getToken()) {
      wx.reLaunch({ url: '/pages/login/login' })
      return
    }
    this.setData({ userName: app.globalData.username || '' })
    this.loadFiles()
  },

  onPullDownRefresh() {
    this.loadFiles().then(() => wx.stopPullDownRefresh())
  },

  async loadFiles() {
    this.setData({ loading: true })
    try {
      const res = await api.listFiles()
      if (res.code === 0) {
        const files = (res.data || []).map((f) => ({
          id: f.id,
          filename: f.filename,
          sizeText: formatSize(f.file_size),
          chunkCount: f.chunk_count || 0,
          scopeText: f.scope === 'session' ? '会话级' : '账号级',
          timeText: formatTime(f.created_at)
        }))
        this.setData({ files })
      } else {
        wx.showToast({ title: res.message, icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: err.message, icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 上传。这里固定用「账号级」范围：
   * 会话级文件只在某一个 session 内可检索，而本页没有会话上下文
   * （后端会把 session_id 当成 default，第一条消息之后该 id 就再也用不到了）。
   * 需要会话级上传请到「对话」页用输入框左侧的 ＋。
   */
  async onUpload() {
    if (this.data.uploading) return

    let file
    try {
      file = await chooseFile()
    } catch (err) {
      if (err.message !== 'cancel') wx.showToast({ title: err.message, icon: 'none' })
      return
    }

    const confirmed = await new Promise((resolve) => {
      wx.showModal({
        title: '上传到知识库',
        content: `${file.name}\n大小：${formatSize(file.size)}\n范围：账号级（所有会话共享）`,
        confirmText: '上传',
        success: (r) => resolve(r.confirm)
      })
    })
    if (!confirmed) return

    this.setData({ uploading: true })
    wx.showLoading({ title: '解析中…', mask: true })
    try {
      const res = await api.uploadFile(file, 'default', 'account')
      wx.hideLoading()
      if (res.code === 0) {
        wx.showToast({ title: `已入库 ${res.data.chunk_count} 个文本块`, icon: 'none' })
        this.loadFiles()
      } else {
        wx.showToast({ title: res.message, icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: err.message, icon: 'none' })
    } finally {
      this.setData({ uploading: false })
    }
  },

  onDelete(e) {
    const { id, name } = e.currentTarget.dataset
    wx.showModal({
      title: '删除文件',
      content: `确定删除「${name}」吗？\n该文件的向量数据会被一并清除，无法恢复。`,
      confirmColor: '#ef4444',
      success: async (r) => {
        if (!r.confirm) return
        try {
          const res = await api.deleteFile(id)
          if (res.code === 0) {
            this.setData({ files: this.data.files.filter((f) => f.id !== id) })
            wx.showToast({ title: '已删除', icon: 'success' })
          } else {
            wx.showToast({ title: res.message, icon: 'none' })
          }
        } catch (err) {
          wx.showToast({ title: err.message, icon: 'none' })
        }
      }
    })
  }
})
