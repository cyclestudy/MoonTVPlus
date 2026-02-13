# MoonTVPlus (Public Access Edition)

<div align="center">
  <img src="public/logo.png" alt="MoonTVPlus Logo" width="120">
</div>

> MoonTVPlus 是基于 [MoonTVPlus](https://github.com/mtvpls/MoonTVPlus) 的公开访问修改版。无需注册或登录即可浏览和观看内容，仅管理后台需要认证。

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-14-000?logo=nextdotjs)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-38bdf8?logo=tailwindcss)
![TypeScript](https://img.shields.io/badge/TypeScript-4.x-3178c6?logo=typescript)
![License](https://img.shields.io/badge/License-MIT-green)
![Docker Ready](https://img.shields.io/badge/Docker-ready-blue?logo=docker)

</div>

---

## 与上游的区别

本 Fork 的核心改动：**除管理员功能外，所有内容均可公开访问**。

| 功能 | 上游 (原版) | 本版本 |
|------|------------|--------|
| 首页浏览 | 需要登录 | 公开访问 |
| 搜索视频 | 需要登录 | 公开访问 |
| 视频详情/播放 | 需要登录 | 公开访问 |
| 源站搜索 | 需要登录 | 公开访问 |
| TMDB/豆瓣信息 | 需要登录 | 公开访问 |
| 私人影库/小雅 | 需要登录 | 公开访问 |
| 求片列表 | 需要登录 | 公开查看 |
| 收藏/播放记录/搜索历史 | 需要登录 | 需要登录 |
| 管理后台 | 需要管理员 | 需要管理员 |

### 改动涉及的文件

- **Middleware** — 仅对 `/admin` 和 `/api/admin` 路由强制认证
- **22 个内容 API 路由** — 认证改为可选（search/detail/tmdb/openlist/xiaoya 等）
- **TokenRefreshManager** — 未登录用户不再强制跳转登录页
- **UserMenu** — 未登录显示登录按钮，已登录显示完整菜单
- **fetchWithAuth** — 401 时仅清除 cookie，不强制跳转

## 功能特性

- 🔍 **多源聚合搜索** — 一次搜索返回全源结果
- ▶️ **流畅在线播放** — 集成 HLS.js & ArtPlayer
- 🎮 **外部播放器跳转** — PotPlayer、VLC、MPV、IINA 等
- ✨ **视频超分 (Anime4K)** — WebGPU 实时画质增强
- 💬 **弹幕系统** — 弹幕搜索、匹配、加载、屏蔽
- 📝 **豆瓣评论** — 自动抓取豆瓣短评
- 🎭 **观影室** — 多人同步观影、实时聊天（实验性）
- 📥 **M3U8 下载** — 合并 m3u8 片段完整下载
- 💾 **服务器离线下载** — 支持断点续传
- 📚 **私人影库** — 接入 OpenList 或 Emby
- ❤️ **收藏 + 继续观看** — 多端同步进度
- 📱 **PWA** — 安装到桌面/主屏
- 🌗 **响应式布局** — 桌面侧边栏 + 移动底部导航
- 👿 **智能去广告** — 自动跳过切片广告

> 部署后为空壳项目，无内置播放源和直播源，需要自行收集。

## 部署

### Docker 部署（Kvrocks 存储，推荐）

```yml
services:
  moontv-core:
    image: ghcr.io/cyclestudy/moontvplus:latest
    container_name: moontv-core
    restart: on-failure
    ports:
      - '3000:3000'
    environment:
      - USERNAME=admin
      - PASSWORD=admin_password
      - NEXT_PUBLIC_STORAGE_TYPE=kvrocks
      - KVROCKS_URL=redis://moontv-kvrocks:6666
    networks:
      - moontv-network
    depends_on:
      - moontv-kvrocks
  moontv-kvrocks:
    image: apache/kvrocks
    container_name: moontv-kvrocks
    restart: unless-stopped
    volumes:
      - kvrocks-data:/var/lib/kvrocks/data
    networks:
      - moontv-network
networks:
  moontv-network:
    driver: bridge
volumes:
  kvrocks-data:
```

### Docker 部署（Redis 存储）

```yml
services:
  moontv-core:
    image: ghcr.io/cyclestudy/moontvplus:latest
    container_name: moontv-core
    restart: on-failure
    ports:
      - '3000:3000'
    environment:
      - USERNAME=admin
      - PASSWORD=admin_password
      - NEXT_PUBLIC_STORAGE_TYPE=redis
      - REDIS_URL=redis://moontv-redis:6379
    networks:
      - moontv-network
    depends_on:
      - moontv-redis
  moontv-redis:
    image: redis:alpine
    container_name: moontv-redis
    restart: unless-stopped
    networks:
      - moontv-network
    volumes:
      - ./data:/data
networks:
  moontv-network:
    driver: bridge
```

### Docker 部署（Upstash 存储）

1. 在 [Upstash](https://upstash.com/) 注册并新建 Redis 实例
2. 复制 HTTPS ENDPOINT 和 TOKEN

```yml
services:
  moontv-core:
    image: ghcr.io/cyclestudy/moontvplus:latest
    container_name: moontv-core
    restart: on-failure
    ports:
      - '3000:3000'
    environment:
      - USERNAME=admin
      - PASSWORD=admin_password
      - NEXT_PUBLIC_STORAGE_TYPE=upstash
      - UPSTASH_URL=你的 HTTPS ENDPOINT
      - UPSTASH_TOKEN=你的 TOKEN
```

## 配置文件

部署后需在管理后台填写配置文件。示例：

```json
{
  "cache_time": 7200,
  "api_site": {
    "example": {
      "api": "http://xxx.com/api.php/provide/vod",
      "name": "示例资源",
      "detail": "http://xxx.com"
    }
  },
  "custom_category": [
    { "name": "华语", "type": "movie", "query": "华语" }
  ]
}
```

支持标准苹果 CMS V10 API 格式。

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `USERNAME` | 站长账号（必填） | — |
| `PASSWORD` | 站长密码（必填） | — |
| `NEXT_PUBLIC_STORAGE_TYPE` | 存储方式（必填） | — |
| `KVROCKS_URL` / `REDIS_URL` | 数据库连接 URL | — |
| `UPSTASH_URL` / `UPSTASH_TOKEN` | Upstash 连接信息 | — |
| `SITE_BASE` | 站点 URL | — |
| `NEXT_PUBLIC_SITE_NAME` | 站点名称 | MoonTV |
| `CRON_PASSWORD` | 定时任务 API 密码 | mtvpls |
| `TMDB_API_KEY` | TMDB API 密钥 | — |
| `DANMAKU_API_BASE` | 弹幕 API 地址 | http://localhost:9321 |
| `DANMAKU_API_TOKEN` | 弹幕 API Token | 87654321 |
| `ENABLE_TVBOX_SUBSCRIBE` | 启用 TVBOX 订阅 | false |
| `TVBOX_SUBSCRIBE_TOKEN` | TVBOX 订阅 Token | — |
| `WATCH_ROOM_ENABLED` | 启用观影室 | false |
| `NEXT_PUBLIC_ENABLE_OFFLINE_DOWNLOAD` | 启用离线下载 | false |
| `NEXT_PUBLIC_ENABLE_SOURCE_SEARCH` | 启用源站寻片 | true |

完整环境变量列表请参考[上游文档](https://github.com/mtvpls/MoonTVPlus)。

## 自动更新

可使用 [watchtower](https://github.com/containrrr/watchtower) 自动更新容器镜像。

## License

[MIT](LICENSE)

## 致谢

- [MoonTVPlus](https://github.com/mtvpls/MoonTVPlus) — 上游项目
- [MoonTV](https://github.com/MoonTechLab/LunaTV) — 原始灵感
- [ArtPlayer](https://github.com/zhw2590582/ArtPlayer) — 视频播放器
- [HLS.js](https://github.com/video-dev/hls.js) — HLS 流媒体支持
