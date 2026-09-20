# AI 知识库 · 微信小程序端

RAG 知识库问答系统的微信小程序前端，配套后端见
[IronKui/my-first-rag](https://github.com/IronKui/my-first-rag)。

功能与后端自带的 `chat.html` 对齐：登录注册、多会话管理、知识库文件管理、
四种对话模式（默认 / 学习 / 面试 / 角色扮演）。

## 目录结构

```
├── app.js / app.json / app.wxss    # 全局状态、页面与 tabBar 注册、设计变量
├── config.js                       # ★ 后端地址配置（换环境只改这里）
├── utils/
│   ├── request.js                  # wx.request / wx.uploadFile 封装 + token 注入 + 401 统一处理
│   ├── api.js                      # 接口层，与 app.py 路由一一对应
│   └── upload.js                   # 文件选择（聊天记录 / 相册）与上传前处理
└── pages/
    ├── login/                      # 登录 / 注册
    ├── chat/                       # 对话主页面（tab 1）
    └── files/                      # 知识库文件管理（tab 2）
```

## 快速开始

### 1. 启动后端

在[后端仓库](https://github.com/IronKui/my-first-rag)根目录执行：

```bash
uvicorn app:app --reload
```

确认 `http://localhost:8000` 能访问（可先用浏览器打开后端自带的 `chat.html` 验证）。

### 2. 用开发者工具打开小程序

微信开发者工具 → 导入项目 → 选择**本仓库的根目录**。

**关键一步**：勾选

> 详情 → 本地设置 → **不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书**

不勾选的话，`wx.request` 会拒绝请求 `http://localhost:8000` 并报「域名不合法」。

### 3. 真机预览

真机上不能用 `localhost`（那指的是手机自己）。需要：

1. 把 `config.js` 里的 `BASE_URL` 改成电脑的局域网 IP：

   ```js
   const BASE_URL = 'http://192.168.1.10:8000'   // 换成你自己的 IP（ipconfig 查看）
   ```

2. 后端改为监听所有网卡：

   ```bash
   uvicorn app:app --reload --host 0.0.0.0 --port 8000
   ```

3. 放行 Windows 防火墙的 8000 端口，手机与电脑连同一个 WiFi。

4. 真机预览同样需要开启「不校验合法域名」（开发版小程序可在
   右上角菜单 → 开发调试 中开启）。

## 实现说明

### 请求与鉴权

`utils/request.js` 统一注入 `Authorization: Bearer <token>`，token 存在
Storage 里。任何接口返回 401 都会清空登录态并 `reLaunch` 回登录页。

注意后端把业务错误也放在 200 响应里（`{code, message, data}`），所以
`request()` 只在网络层/HTTP 层出错时 reject，业务错误由调用方判断 `code`。

### 会话的延迟创建

后端的设计是：`session_id` 传 `"default"` 时新建会话，并在响应里返回真正的
`session_id`。所以小程序端在发第一条消息前不创建会话，拿到返回的 id 后才把
它加进会话列表并刷新标题。

### 上传的文件名

`wx.uploadFile` 拿「文件路径的 basename」当 multipart 里的 filename，而
`wx.chooseMessageFile` / `wx.chooseMedia` 返回的临时路径 basename 是随机串。
直接上传的话，后端会把文件名存成一串乱码，文件列表就没法看了。

`utils/upload.js` 的 `prepareLocalFile()` 会先把临时文件复制到
`USER_DATA_PATH/<原始文件名>` 再上传，复制失败时降级用原路径。

### 文件可见范围

- **账号级（account）**：所有会话都能检索到。对话页和知识库页都支持。
- **会话级（session）**：只有绑定的那个会话能检索到。

知识库页的上传固定用账号级 —— 那一页没有会话上下文，后端会把 `session_id`
当成 `"default"`，而真实会话在第一条消息后就换了新 id，会话级文件会变成检索
不到的孤儿数据。需要会话级上传请到对话页用输入框左侧的 ＋。

同理，对话页在「会话尚未创建」时会拦截会话级上传并提示。

### 中文输入法

`<textarea>` 采用受控写法（`value` 绑定 data，`bindinput` 里 setData），
这样发送后能可靠清空输入框。若在个别机型上遇到输入法组词时光标跳动，
可改为非受控（去掉 `value` 绑定、在 `bindinput` 里存到 `this.draft`），
代价是发送后无法用 setData 清空输入框。

## 设计变量

`app.wxss` 的 CSS 变量与后端 `chat.html` 保持一致（浅灰底 / 白色卡片 /
靛蓝 `#6366f1` 点缀），两端视觉统一。

## 已删除的模板文件

`pages/index/`、`pages/logs/`、`utils/util.js` 是微信开发者工具默认模板的
演示代码，与本项目无关，已移除。
