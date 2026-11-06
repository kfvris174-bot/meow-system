# 喵档（MEOW SYSTEM）依赖与部署环境说明

| 项目 | 内容 |
| --- | --- |
| 文档版本 | v1.0 |
| 日期 | 2026-11-05 |
| 适用版本 | 单文件 App v1.0 + 本地 data.json 服务 |
| 结论 | **没有第三方 Python / npm 依赖**，只需 Python 3 运行时和现代浏览器 |
| 相关文档 | [README.md](README.md) |

---

## 1. 结论先行

喵档的运行时依赖很少：

| 运行方式 | 必需环境 | 是否需要联网 |
| --- | --- | --- |
| 直接打开 `meow-system.html` | 现代浏览器 | 否 |
| 本地服务 + `data.json` | Python 3 + 现代浏览器 | 否（仅局域网） |
| 重新构建单文件 | Node.js（仅开发时） | 否 |

**不需要：**

- `pip install` 任何第三方包
- `npm install` 任何依赖
- 数据库（MySQL / PostgreSQL / SQLite）
- Redis、Nginx、Docker
- 云服务、账号系统、域名、HTTPS 证书

`server.py` 只使用 Python 标准库。

**新设备最小配置：Python 3.9+ + 现代浏览器。** Node.js 18+ 仅用于重新构建，不是运行依赖。

---

## 2. 当前已验证环境

以下版本是当前实际运行和测试环境：

| 组件 | 当前版本 | 用途 |
| --- | --- | --- |
| macOS | 26.6.2（arm64） | 当前开发/运行环境 |
| Python | 3.9.6 | 运行 `server.py`、端口检测 |
| Google Chrome | 156.0.8078.80 | 页面渲染与自动化检查 |
| Safari | 26.6.2 | 系统浏览器（未做自动化回归） |
| Node.js | 23.11.0 | 仅用于 `node build.mjs` 重新构建 |
| npm | 10.9.2 | 未使用 |
| zsh | 5.9 | 运行 `start-phone.command` |
| Bash | 3.2.57（macOS 自带） | 运行 `start-phone.sh` 的兼容验证 |

> Linux 启动脚本已按 Linux 命令编写，但当前没有在具体 Linux 发行版上做完整实测。Linux 端请按本文第 4 节确认 Python、Bash 和可选网络工具。

---

## 3. 运行时依赖

### 3.1 Python 3（服务模式必需）

- **推荐版本**：Python 3.9 或更高
- **当前验证**：Python 3.9.6
- **最低理论版本**：Python 3.7+（使用了 `ThreadingHTTPServer` 等标准库能力，但未逐一验证低版本）
- **第三方包**：无
- **虚拟环境**：不强制需要；系统 Python 即可

检查命令：

```bash
python3 --version
```

如果 Linux 没有 Python 3：

```bash
# Ubuntu / Debian
sudo apt update && sudo apt install -y python3

# Fedora / RHEL
sudo dnf install -y python3
```

`server.py` 使用的标准库模块：

```text
http.server, socketserver, json, os, sys, tempfile,
datetime, pathlib, urllib.parse
```

没有 `requirements.txt` 需要安装；`pip install -r requirements.txt` 不适用于本项目。

### 3.2 现代浏览器（前端运行环境）

推荐：

| 浏览器 | 推荐最低版本 | 说明 |
| --- | --- | --- |
| Safari / iOS Safari | 16.4+ | 目标手机浏览器；支持 `dvh`、`color-mix`、Pointer Events |
| Chrome / Edge | 111+ | 支持 `color-mix`、`dvh`、`backdrop-filter` |
| Firefox | 113+ | 支持 `color-mix`；非主要目标 |

如果浏览器过旧，页面仍可能显示，但部分半透明背景、主题色和圆角效果会降级。

前端没有：

- 外部字体
- CDN 脚本
- 图片外链
- 前端框架（React/Vue 等）
- 构建后的 runtime 依赖

### 3.3 Node.js（仅重新构建时需要）

只有在修改 `src/` 后重新生成 `meow-system.html` 时才需要 Node.js。

- **推荐**：Node.js 18 LTS 或更高
- **当前验证**：Node.js 23.11.0
- **不是运行 App 的必需项**
- **没有 npm 依赖**

构建命令：

```bash
cd meow-system
node build.mjs
```

### 3.4 Shell 与系统工具

#### macOS 启动器 `start-phone.command`

依赖：

- macOS
- `zsh`（macOS 默认）
- `ipconfig`
- `scutil`
- `pbcopy`
- `open`
- `lsof`
- Python 3

#### Linux / 通用启动器 `start-phone.sh`

依赖：

- Bash
- `python3`
- 常用文本工具：`awk`、`grep`、`head`、`tr`
- IP 检测：`ip` 或 `hostname`（至少一个）；也兼容 `ifconfig`
- 端口检测：`ss` 或 `lsof`；都没有时使用 Python 检查
- 可选：`xdg-open`（自动打开浏览器）
- 可选：`wl-copy` / `xclip` / `xsel`（复制访问地址到剪贴板）

无桌面 Linux 服务器使用：

```bash
NO_OPEN=1 ./start-phone.sh
```

---

## 4. 新设备部署清单

### 4.1 macOS 新设备

1. 复制整个 `meow-system/` 文件夹，**包含 `data.json`**。
2. 安装 Python 3（如果 `python3 --version` 不可用）。
3. 给脚本执行权限：

   ```bash
   chmod +x start-phone.command start-phone.sh
   ```

4. 双击 `start-phone.command`，或在终端运行：

   ```bash
   ./start-phone.command
   ```

5. 打开终端打印的地址。
6. 如需手机访问，确认手机与 Mac 在同一 Wi-Fi / 热点。

### 4.2 Linux 新设备

1. 复制整个 `meow-system/` 文件夹，**包含 `data.json`**。
2. 确认 Python 3：

   ```bash
   python3 --version
   ```

3. 给脚本执行权限：

   ```bash
   chmod +x start-phone.sh
   ```

4. 启动：

   ```bash
   ./start-phone.sh
   ```

5. 记下终端打印的局域网地址。
6. 放行防火墙端口，例如 8080：

   ```bash
   # Ubuntu / Debian
   sudo ufw allow 8080/tcp

   # Fedora / RHEL
   sudo firewall-cmd --add-port=8080/tcp --permanent
   sudo firewall-cmd --reload
   ```

7. 手机与 Linux 处于同一网络后，用手机浏览器访问打印的地址。

### 4.3 Windows（未提供专用脚本）

可以手动运行，但需要自己处理防火墙：

```powershell
py -3 server.py 8080
# 或
python server.py 8080
```

然后在 Windows 防火墙中允许 Python 或开放 TCP 8080 入站。数据仍在 `data.json`。

---

## 5. 端口与网络

| 项目 | 默认值 |
| --- | --- |
| 服务端口 | 8080 |
| 端口被占用时 | 8088 → 8000 → 8008 |
| 自定义端口 | `PORT=8090 ./start-phone.sh` |
| 监听地址 | `0.0.0.0` |
| 协议 | HTTP（无 TLS） |
| 访问范围 | 建议仅可信局域网 |

同一个 `data.json` 不要同时被两个服务写入。多设备同时编辑时，保存采用“后写入覆盖”。

---

## 6. 文件与权限

| 文件/目录 | 权限要求 |
| --- | --- |
| `meow-system/` | 当前用户可读、可写、可进入 |
| `data.json` | 运行服务的用户可读、可写 |
| `data.json.bak` | 运行服务的用户可写 |
| `start-phone.command` | 可执行（`chmod +x`） |
| `start-phone.sh` | 可执行（`chmod +x`） |
| `server.py` | 可读即可；不需要可执行位 |

如果复制后脚本没有执行权限：

```bash
chmod +x start-phone.command start-phone.sh
```

数据文件建议单独备份：

```bash
cp data.json data.json.manual-backup
```

---

## 7. 环境变量

| 变量 | 适用脚本 | 说明 |
| --- | --- | --- |
| `PORT` | `start-phone.command` / `start-phone.sh` | 指定端口 |
| `NO_OPEN` | `start-phone.sh` | 设为 `1` 时不自动打开浏览器 |
| `MEOW_DATA` | `server.py` | 自定义 `data.json` 路径，默认当前目录 |

示例：

```bash
PORT=8090 ./start-phone.sh
NO_OPEN=1 ./start-phone.sh
MEOW_DATA=/srv/meow/data.json python3 server.py 8080
```

---

## 8. 可选组件

这些不是必需，但能改善体验：

| 组件 | 用途 | 是否必需 |
| --- | --- | --- |
| `xdg-open` | Linux 自动打开浏览器 | 否 |
| `wl-copy` / `xclip` / `xsel` | 复制手机地址到剪贴板 | 否 |
| `ss` / `lsof` | 检测端口占用 | 否（Python 可回退） |
| `ip` / `hostname` | 检测局域网 IP | 建议有 |
| `ufw` / `firewalld` | 放行手机访问端口 | 手机访问时需要 |
| `node` / `npm` | 仅重新构建单文件 | 否 |
| `curl` | 手动检查服务 | 否 |

---

## 9. 不需要的依赖

以下内容均不需要：

- Python `pip` 包
- Node `npm` 包
- 数据库
- ORM
- 后端框架（Django/Flask/FastAPI）
- Nginx/Apache
- Docker
- Redis
- HTTPS 证书
- 域名
- 云托管
- 外部 CDN
- 外部字体
- 身份认证服务

---

## 10. 升级与迁移

### 升级代码但保留数据

1. 备份 `data.json`。
2. 替换 `meow-system.html`、`server.py`、启动脚本。
3. 保留原有 `data.json` 和 `data.json.bak`。
4. 重新启动服务。
5. 在浏览器中强制刷新一次。

### 迁移到另一台电脑

复制整个文件夹：

```bash
scp -r meow-system user@new-host:/path/
```

至少包括：

```text
meow-system.html
server.py
data.json
start-phone.sh（Linux）
start-phone.command（macOS）
```

### 只迁移数据

在「我的 → 导出 JSON 备份」导出，然后在新设备的「导入 JSON 备份」导入。

---

## 11. 故障排查

| 现象 | 检查 |
| --- | --- |
| `python3: command not found` | 安装 Python 3，或使用 `python3 --version` 确认路径 |
| 手机打不开 | 手机和电脑是否同一网络；端口是否被防火墙拦截 |
| 地址能打开但没有数据 | 是否用了 `data.json` 服务模式；是否复制了数据文件 |
| 数据没有更新 | 是否在两台设备同时编辑；刷新页面；确认只有一个服务在写 `data.json` |
| 端口被占用 | 脚本会自动尝试 8088/8000/8008；也可 `PORT=8090` 指定 |
| 脚本没有执行权限 | `chmod +x start-phone.sh` |
| Linux 没有 `ss`/`lsof` | 脚本会自动回退到 Python 端口检测 |
| Safari 直接打开本地 HTML | 使用本地服务地址；不要依赖 Files 预览 |
| 自选系统色后个别文字发灰 | 浏览器过旧不支持 `color-mix()`；升级 Safari/Chrome |

---

## 12. 版本记录

| 版本 | 日期 | 变更 |
| --- | --- | --- |
| v1.0 | 2026-11-05 | 首次整理依赖与部署环境：无第三方包；Python 3 + 现代浏览器；Node 仅构建；macOS/Linux 启动器；data.json 与服务端口说明 |
