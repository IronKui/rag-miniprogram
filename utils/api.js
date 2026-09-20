// utils/api.js —— 后端接口封装，与 backend/app.py 的路由一一对应
const { request } = require('./request')
const { uploadFileToServer } = require('./upload')

module.exports = {
  // ====== 账号 ======
  register: (username, password, nickname) =>
    request('/api/register', { method: 'POST', data: { username, password, nickname } }),

  login: (username, password) =>
    request('/api/login', { method: 'POST', data: { username, password } }),

  me: () => request('/api/me'),

  // ====== 会话 ======
  listSessions: () => request('/api/sessions'),

  sessionHistory: (sessionId) => request(`/api/sessions/${sessionId}/history`),

  renameSession: (sessionId, sessionName) =>
    request(`/api/sessions/${sessionId}`, { method: 'PUT', data: { session_name: sessionName } }),

  deleteSession: (sessionId) =>
    request(`/api/sessions/${sessionId}`, { method: 'DELETE' }),

  // ====== 对话 ======
  // session_id 传 "default" 时后端会新开会话，并在 data.session_id 返回真正的会话 id
  chat: (question, mode, sessionId) =>
    request('/api/chat', {
      method: 'POST',
      data: { question, mode: mode || 'default', session_id: sessionId || 'default' }
    }),

  // ====== 知识库文件 ======
  listFiles: () => request('/api/files'),

  deleteFile: (fileId) => request(`/api/files/${fileId}`, { method: 'DELETE' }),

  // file: {path, name, size}，来自 utils/upload.js 的 chooseFile()
  // scope: account=账号级（所有会话共享） / session=会话级（仅当前会话）
  uploadFile: (file, sessionId, scope) => uploadFileToServer(file, sessionId, scope)
}
