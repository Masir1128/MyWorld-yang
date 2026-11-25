# 第三方组件与素材说明

本文件根据当前源码中的署名与许可记录整理，不将本项目的自有内容统一改为第三方许可。

| 组件 / 素材 | 作者 / 项目 | 许可与仓库位置 |
| --- | --- | --- |
| Three.js r169 与附加模块 | three.js authors | MIT，原文见 [`shared/vendor/three/LICENSE`](shared/vendor/three/LICENSE) |
| lil-gui 0.20.0 | George Michael Brower | MIT，原始许可头保留在 `shared/vendor/lil-gui.esm.min.js` |
| 水下花园程序化模型与合成音景 | Abyssal Garden，Maksymilian Dendura | MIT，原文见 [`meadow/abyssal/LICENSE`](meadow/abyssal/LICENSE)，改编说明见 [`meadow/abyssal/README.md`](meadow/abyssal/README.md) |
| Knight 角色 | KayKit Adventurers，Kay Lousberg | CC0；`meadow/models/Knight.glb`，署名记录见首页与草原源码 |
| 恐龙模型 | Quaternius | CC0；`dino/models/`，署名记录见 `dino/dino-data.js` 与恐龙图鉴页面 |

## 集成与改编

- 水下模块将原项目的程序化模型与合成音景接入现有 Three.js 场景，适配湖底、游泳交互、光照与相机；具体改动见对应 README。
- `shared/offline-modules.js` 和 `meadow/abyssal-offline.js` 为兼容路径所用的打包文件；第三方作品的许可继续适用。
- `coast/index.html` 通过 CDN 加载 Three.js 与 lil-gui，其许可与上述组件一致。
- 分句旁白、页面文案和项目封面未声明为 CC0 或 MIT，不适用上述第三方组件许可。
- 私人使用的 `meadow/music/` 背景音乐及推广视频未纳入此公开仓库，也不在此授予其使用许可。
