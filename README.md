# MDWriter

MDWriter 是一款基于 Electron 的 Markdown 编辑器与预览工具，目标是像 Typora 一样在预览模式下直接编辑，同时保留源码查看和分栏预览能力。

## 当前版本

- 产品版本：V1.0.0.4
- Windows 便携版产物：`MDWriter-1.0.0.4-portable.exe`
- macOS DMG 产物：`MDWriter-1.0.0.4.dmg`
- 最低支持：Windows 10
- macOS：当前作为开发环境使用，支持 `dmg` 打包

## 技术栈

- Electron 43
- React 18 + TypeScript
- Vite + electron-vite
- Milkdown：预览编辑模式
- CodeMirror：源码编辑模式
- highlight.js + marked：Markdown 渲染
- Mermaid：图表渲染
- electron-builder：桌面端打包

## 功能概览

- 三种编辑模式：源码、分栏、预览编辑
- 打开文件夹作为工作区，侧边栏文件树与多标签页
- Markdown 文件打开、保存、新建、复制、删除、重命名
- 应用状态持久化，重启后恢复上次工作区、标签页和主题
- 代码高亮、GFM 表格、Mermaid 默认渲染
- 图片粘贴到 Markdown 项目图片目录，双击图片预览
- PDF 导出与独立 PDF 预览
- 快捷键：保存、标题、代码块等，顶部可查看快捷键弹窗
- 浅色 / 深色主题

## 开发环境

需要 Node.js 20+，推荐使用 Node.js 22 LTS。

```bash
npm install
npm run dev
```

常用校验命令：

```bash
npm run typecheck
npm run build
```

## Windows 打包 EXE

在 Windows 10+ 原生环境中执行：

```powershell
npm install
npm run typecheck
npx electron-vite build
npx electron-builder --win portable --publish never
```

打包完成后，可执行文件位于：

```text
dist/MDWriter-1.0.0.4-portable.exe
```

这个 EXE 无需安装，复制到其他 Windows 10+ 电脑后双击即可运行。

### 打包注意事项

**必须先构建再打包**：`electron-vite build` 把 `src/` 编译到 `out/`，`electron-builder` 只负责把 `out/` 打进 EXE。如果跳过构建步骤，打包产物会是旧代码。

**Electron 下载慢**：首次打包时 `electron-builder` 需要下载 Electron 二进制文件（约 90MB），国内网络可能很慢。设置镜像源：

```powershell
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
npx electron-builder --win portable --publish never
```

如需永久生效：

```powershell
[System.Environment]::SetEnvironmentVariable("ELECTRON_MIRROR", "https://npmmirror.com/mirrors/electron/", "User")
```

**`npm warn deprecated` 警告**：`npm install electron-builder` 时出现的 deprecated 警告是上游依赖的弃用提示，不影响功能，可以忽略。

**`@sindresorhus/is` 缺失报错**：如果打包时出现 `Cannot find module '@sindresorhus/is'`，执行以下命令修复：

```powershell
npm install @sindresorhus/is@4.6.0 --save-dev
```

**开发环境下 Electron 二进制丢失**：打包流程可能会清理 `node_modules/electron/dist`，导致 `npm run dev` 报 `Electron uninstall`。修复：

```powershell
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
node node_modules/electron/install.js
```

## macOS 打包

```bash
npm install
npm run typecheck
npm run build
npx electron-builder --mac
```

如果 Electron 和 electron-builder 下载慢，可以先设置国内镜像：

```bash
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
export ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"
npx electron-builder --mac dmg --publish never
```

打包完成后，DMG 位于：

```text
dist/MDWriter-1.0.0.4.dmg
```

macOS 开发时通常直接使用 `npm run dev` 预览，不需要每次都打包。

## 版本号说明

`package.json` 中的 npm 版本使用 `1.0.4`，因为 npm 不接受四段版本号（对应产品版本 `1.0.0.4`）。
`electron-builder.yml` 中的 `buildVersion: 1.0.0.4` 会映射到 Windows 文件版本和 macOS `CFBundleVersion`，因此打包产物使用 `1.0.0.4`。

## 目录结构

```text
src/main      Electron 主进程、IPC、文件服务、PDF 服务
src/preload   contextBridge API
src/renderer  React 界面、编辑器、Markdown 渲染
src/shared    主进程与渲染进程共享类型
resources     Claude 风格设计系统资源
```

## 注意事项

- 应用状态存储在 `C:\Users\<用户名>\AppData\Roaming\MDWriter\ui-state.json`，删除该文件可重置为初始状态（用于测试首次打开体验）。
- `node_modules/`、`out/`、`dist/` 已加入 `.gitignore`，不会进入版本控制。
- `PLAN.md` 属于本地计划文档，不纳入版本控制。
