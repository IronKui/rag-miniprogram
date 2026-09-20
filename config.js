/**
 * 后端服务地址配置
 *
 * 使用前请根据运行环境修改 BASE_URL：
 *
 * 1. 开发者工具调试（默认）
 *    - 保持 http://localhost:8000
 *    - 必须在开发者工具勾选：详情 → 本地设置 → 不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书
 *
 * 2. 真机预览
 *    - 改成电脑的局域网 IP，例如 http://192.168.1.10:8000
 *    - 手机与电脑连同一个 WiFi，并允许防火墙放行 8000 端口
 *    - 后端启动时用 uvicorn app:app --reload --host 0.0.0.0 --port 8000
 *
 * 3. 正式发布
 *    - 必须是已备案的 HTTPS 域名，并在微信公众平台配置 request / uploadFile 合法域名
 */
const BASE_URL = 'http://localhost:8000'

module.exports = { BASE_URL }
