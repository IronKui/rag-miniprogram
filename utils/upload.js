// utils/upload.js —— 文件选择 + 上传前处理
const fs = wx.getFileSystemManager()

// 与后端 ALLOWED_EXTENSIONS 保持一致
const ALLOWED_EXT = ['pdf', 'docx', 'md', 'txt', 'png', 'jpg', 'jpeg']
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

function extOf(name) {
  const i = (name || '').lastIndexOf('.')
  return i > -1 ? name.slice(i + 1).toLowerCase() : ''
}

function sanitize(name) {
  return (name || '').replace(/[\\/:*?"<>|\s]/g, '_').trim() || 'upload'
}

function formatSize(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

/**
 * 上传前把临时文件复制到 USER_DATA_PATH，并保留原始文件名。
 *
 * 原因：wx.uploadFile 拿「文件路径的 basename」当作 multipart 里的 filename，
 * 而 chooseMessageFile / chooseMedia 返回的临时路径 basename 是随机串，
 * 直接上传会让后端存下随机文件名（文件列表里显示成一串乱码）。
 * 复制成 <USER_DATA_PATH>/原始文件名.pdf 后，后端就能拿到正确的文件名。
 *
 * 复制失败时降级用原路径，保证上传本身不中断。
 */
function prepareLocalFile(tempPath, originalName) {
  return new Promise((resolve) => {
    const dest = `${wx.env.USER_DATA_PATH}/${sanitize(originalName)}`
    const fallback = () => resolve(tempPath)

    const copy = () => {
      fs.copyFile({
        srcPath: tempPath,
        destPath: dest,
        success: () => resolve(dest),
        fail: fallback
      })
    }

    // 目标文件可能已存在，先删掉再复制
    fs.unlink({ filePath: dest, success: copy, fail: copy })
  })
}

function ensureSize(size) {
  return size == null || size <= MAX_FILE_SIZE
}

/** 从聊天记录选文件（支持 pdf/docx/md/txt/图片） */
function pickMessageFile() {
  return new Promise((resolve, reject) => {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ALLOWED_EXT,
      success(res) {
        const f = res.tempFiles && res.tempFiles[0]
        if (!f) return reject(new Error('cancel'))
        if (!ensureSize(f.size)) return reject(new Error('文件不能超过 50MB'))
        resolve({ path: f.path, name: f.name || 'file.' + extOf(f.path), size: f.size })
      },
      fail: () => reject(new Error('cancel'))
    })
  })
}

/** 从相册/相机选图片（相册图片没有原始文件名，这里按时间戳生成） */
function pickImage() {
  return new Promise((resolve, reject) => {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success(res) {
        const f = res.tempFiles && res.tempFiles[0]
        if (!f) return reject(new Error('cancel'))
        if (!ensureSize(f.size)) return reject(new Error('图片不能超过 50MB'))
        const ext = extOf(f.tempFilePath) || 'jpg'
        const stamp = new Date()
        const pad = (n) => String(n).padStart(2, '0')
        const name = `图片_${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}` +
          `_${pad(stamp.getHours())}${pad(stamp.getMinutes())}${pad(stamp.getSeconds())}.${ext}`
        resolve({ path: f.tempFilePath, name, size: f.size })
      },
      fail: () => reject(new Error('cancel'))
    })
  })
}

/** 弹出选择方式，返回 {path, name, size}；用户取消则 reject('cancel') */
function chooseFile() {
  return new Promise((resolve, reject) => {
    wx.showActionSheet({
      itemList: ['从聊天记录选文件', '从相册选图片'],
      success(res) {
        const task = res.tapIndex === 0 ? pickMessageFile() : pickImage()
        task.then(resolve, reject)
      },
      fail: () => reject(new Error('cancel'))
    })
  })
}

/** 上传文件到后端，返回后端 JSON（{code, message, data}） */
async function uploadFileToServer(file, sessionId, scope) {
  const { upload } = require('./request')
  const localPath = await prepareLocalFile(file.path, file.name)
  return upload(localPath, { session_id: sessionId || 'default', scope: scope || 'account' })
}

module.exports = {
  ALLOWED_EXT,
  MAX_FILE_SIZE,
  chooseFile,
  uploadFileToServer,
  formatSize,
  sanitize
}
