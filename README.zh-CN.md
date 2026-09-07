<p align="center">
  <img src=".github/logo.svg" width="96" alt="magnet-cursor logo">
</p>

<h1 align="center">磁踪 · magnet-cursor</h1>

<p align="center">
  <strong>让鼠标成为网页交互的一部分。</strong>
  <br>
  <sub>一个轻量、可组合的 Web 光标与磁吸交互库，为 Vue 3、React 和原生 JavaScript 打造。</sub>
</p>

<p align="center">
  <a href="https://github.com/JoiHouse/magnet-cursor">
    <img src="https://img.shields.io/github/stars/JoiHouse/magnet-cursor?style=flat-square&logo=github" alt="GitHub stars">
  </a>
  <a href="https://www.npmjs.com/package/@joihouse/magnet-cursor-core">
    <img src="https://img.shields.io/npm/v/@joihouse/magnet-cursor-core?style=flat-square&logo=npm&logoColor=white&color=cb3837" alt="npm">
  </a>
  <a href="https://github.com/JoiHouse/magnet-cursor/actions/workflows/ci.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/JoiHouse/magnet-cursor/ci.yml?style=flat-square&logo=githubactions&logoColor=white&label=CI" alt="CI">
  </a>
  <img src="https://img.shields.io/badge/dependencies-0-2563eb?style=flat-square" alt="Zero dependencies">
  <img src="https://img.shields.io/badge/TypeScript-ready-3178c6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/license-MIT-f97316?style=flat-square" alt="MIT License">
</p>

<p align="center">
  <a href="https://cursor.joia.cn">
    <img src="https://img.shields.io/badge/在线体验与文档-cursor.joia.cn-2563eb?style=for-the-badge&logo=googlechrome&logoColor=white" alt="在线体验与文档">
  </a>
</p>

<p align="center">
  <a href="./README.md">English</a>
  ·
  <a href="./README.zh-CN.md">简体中文</a>
</p>

---

## 为什么是 magnet-cursor？

传统网页里的鼠标只是一个「指针」。

它告诉用户：“你正在指向这里。”

magnet-cursor 想做得更多：

> **让指针真正参与页面交互。**

它可以跟随鼠标移动、产生惯性和拖尾；

可以吸附按钮，让元素朝鼠标轻轻倾斜；

可以在悬停时融入按钮、描出链接轮廓；

也可以像一团液体一样，被鼠标拖拽、拉伸，并穿过元素表面。

你不需要重新设计页面。

**只需要给已有元素增加一点交互。**

---

## 你可以做什么？

### 磁吸

让按钮、卡片、图片等元素对鼠标产生「吸引力」。

鼠标靠近时，元素会轻轻朝向指针；

鼠标离开后，自然弹回。

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/merge-dark.gif">
    <img src=".github/merge-light.gif" width="600" alt="磁吸与融合效果">
  </picture>
</p>

<p align="center">
  <sub>元素会响应鼠标移动，而不是简单地等待 hover。</sub>
</p>

---

### 融合

让光标和页面元素产生「融合」效果。

光标可以：

- 接管按钮的形状
- 变成按钮的背景
- 描出元素的边框
- 在链接下方划出动态下划线

特别适合：

- Landing Page
- Portfolio
- SaaS 官网
- 创意网站
- 品牌官网
- 产品展示页

```html
<button data-magnet-cursor-morph="fill">Hover me</button>
```

---

### 液态拖尾

让光标拥有类似液体的运动轨迹。

光标速度越快，形状越明显；

停止移动后，液体自然收缩。

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/trail-dark.gif">
    <img src=".github/trail-light.gif" width="600" alt="液态光标拖尾效果">
  </picture>
</p>

<p align="center">
  <sub>液滴通过 SVG goo 效果融合成一个连续的液态轨迹。</sub>
</p>

---

### 引力液体

如果你想要更加大胆的视觉效果，可以让一团液体追随鼠标。

它不仅仅是「跟随」。

它会：

- 被鼠标拉动
- 根据速度产生形变
- 延迟跟随
- 穿过元素表面
- 在移动过程中产生腐蚀感

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/liquid-dark.gif">
    <img src=".github/liquid-light.gif" width="600" alt="引力液体效果">
  </picture>
</p>

---

## 你不需要从零开始实现

magnet-cursor 已经把常见的光标交互封装成可以直接使用的 API。

| 能力                 | 用途                 |
| -------------------- | -------------------- |
| Follow               | 光标平滑跟随鼠标     |
| Magnet               | 元素磁吸与倾斜       |
| Morph                | 光标与元素融合       |
| Underline            | 动态链接下划线       |
| Trail                | 液态拖尾             |
| Gravitational Liquid | 引力液体             |
| Frame Scheduler      | 按需更新动画         |
| Reduced Motion       | 自动适配减少动态效果 |
| Touch Safe           | 移动端自动降级       |
| SSR Safe             | SSR 环境安全         |

---

# 📦 安装

根据你的项目选择对应的方式。

| 技术栈          | 引入方式                        | 适合                |
| --------------- | ------------------------------- | ------------------- |
| Vue 3 / Nuxt    | `@joihouse/magnet-cursor-vue`   | Vue 项目            |
| React / Next.js | `@joihouse/magnet-cursor-react` | React 项目          |
| 原生 JavaScript | 引入一个 js 文件                | 原生 Web / 任意框架 |

框架项目从 npm 安装：

```bash
# Vue 3 / Nuxt
pnpm add @joihouse/magnet-cursor-vue

# React / Next.js
pnpm add @joihouse/magnet-cursor-react
```

原生 JavaScript 不需要安装，也不需要 Node.js 和构建工具。引入一个 js 文件就可以：

```html
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/@joihouse/magnet-cursor-core@0.1.0/dist/style.css"
/>

<script src="https://cdn.jsdelivr.net/npm/@joihouse/magnet-cursor-core@0.1.0/dist/magnet-cursor.global.js"></script>
```

这个文件会挂载一个全局变量 `MagnetCursor`，所有 API 都在它上面。

> 一般情况下，一个项目只需要一种引入方式。

---

# ⚡ 5 分钟开始使用

## Vue 3

如果你正在使用 Vue 3 或 Nuxt，这是最简单的方式：

```vue
<script setup lang="ts">
import { MagnetCursor, vMagnet } from '@joihouse/magnet-cursor-vue'
import '@joihouse/magnet-cursor-vue/style.css'
</script>

<template>
  <!-- 整个应用通常只需要一个 -->
  <MagnetCursor color="#000" />

  <!-- 给元素增加磁吸效果 -->
  <button v-magnet>Hover me</button>
</template>
```

就这样。

不需要自己处理：

- `requestAnimationFrame`
- 鼠标坐标
- 元素位置
- 动画插值
- 生命周期
- 事件清理

---

## React

```tsx
import { Magnet, MagnetCursor } from '@joihouse/magnet-cursor-react'
import '@joihouse/magnet-cursor-react/style.css'

export default function App() {
  return (
    <>
      <MagnetCursor color="#000" />

      <Magnet>
        <button>Hover me</button>
      </Magnet>
    </>
  )
}
```

### Next.js

如果使用 App Router，请将 `MagnetCursor` 和 `Magnet` 放在 `'use client'` 边界内。

---

## 原生 JavaScript

不使用 React / Vue？

引入 js 文件之后，所有 API 都在全局变量 `MagnetCursor` 上：

```html
<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/@joihouse/magnet-cursor-core@0.1.0/dist/style.css"
/>

<button>Hover me</button>

<script src="https://cdn.jsdelivr.net/npm/@joihouse/magnet-cursor-core@0.1.0/dist/magnet-cursor.global.js"></script>

<script>
  const cursor = MagnetCursor.createMagnetCursor({
    lerp: 0.2,
    color: '#000',
  })

  const magnet = MagnetCursor.createMagnet(document.querySelector('button'), {
    strength: 0.35,
  })

  // 不再需要时释放资源
  // cursor.destroy()
  // magnet.destroy()
</script>
```

不需要 `type="module"`，不需要打包器，也不需要 import map。

---

# 从简单开始，逐渐增加效果

你不需要一次打开所有效果。

### ① 只使用光标

```ts
createMagnetCursor()
```

### ② 给按钮增加磁吸

```ts
createMagnet(button, {
  strength: 0.35,
})
```

### ③ 让光标融合按钮

```html
<button data-magnet-cursor-morph="fill">Get Started</button>
```

### ④ 增加液态拖尾

```ts
createMagnetCursor({
  trail: true,
})
```

### ⑤ 创建完整的创意交互

将 Follow、Magnet、Morph、Trail 等能力组合起来，就可以构建完整的高级光标系统。

**所有能力都是独立的，你可以自由组合。**

---

# 🌐 在线体验

如果你只是想看看效果，不需要安装任何东西。

**在线 Playground**

在浏览器里直接调整参数、查看效果，并复制配置。

**完整文档**

查看所有 API、配置项、CSS 变量以及使用示例。

---

# 支持多种使用方式

magnet-cursor 不绑定某一种框架。

```text
                    magnet-cursor
                          │
             ┌────────────┼────────────┐
             │            │            │
           Vue 3        React        Core
             │            │            │
           Nuxt        Next.js      Vanilla JS
```

框架层只负责提供更符合框架习惯的 API。

底层交互能力由 Core 统一提供。

因此你可以：

- 在 Vue 中使用
- 在 React 中使用
- 在 Next.js 中使用
- 在 Nuxt 中使用
- 在原生 HTML 中使用
- 在自己的框架封装中使用

---

# ⚡ 轻量，但不牺牲体验

magnet-cursor 的目标不是「让页面一直动画」。

而是：

> **需要动的时候才动。**

因此它不会让页面长期运行一个空的动画循环。

### 按需渲染

当：

- 鼠标停止
- 光标静止
- 元素动画收敛
- 页面进入后台

渲染循环会自动暂停。

下一次需要更新时再恢复。

### 共享帧调度

多个磁吸元素不会各自创建一套动画循环。

所有元素共享同一个更新过程：

```text
Pointer Event
     ↓
Frame Scheduler
     ↓
Read Layout
     ↓
Update Elements
     ↓
Write Transform
```

即使页面中存在多个磁吸元素，也不需要为每个元素创建独立的 `requestAnimationFrame`。

---

# 📦 极小体积

Core 采用模块化设计。

你可以只引入自己需要的能力：

```ts
/cursor
/magnet
/gravitational-liquid
```

最小入口约 **1.36 KB gzip**。

如果你只需要一个简单的磁吸效果，就没有必要把完整的液态效果全部加载进来。

按需引入需要打包器，所以它适用于从 npm 安装 core 的项目。直接引入 js 文件时拿到的是完整构建，约 **10.9 KB gzip**——换来的是不需要 Node.js、打包器和模块解析。

---

# ♿ 默认考虑真实网站环境

动画库最容易被忽略的问题，是「不应该动画的时候怎么办」。

magnet-cursor 默认处理这些情况：

| 环境                     | 行为             |
| ------------------------ | ---------------- |
| SSR                      | 安全返回空实例   |
| 纯触控设备               | 自动禁用         |
| `prefers-reduced-motion` | 自动禁用         |
| 浏览器后台               | 暂停动画         |
| 鼠标静止                 | 停止渲染         |
| 光标尚未定位             | 不绘制自定义光标 |

这意味着业务代码通常不需要写：

```ts
if (typeof window !== 'undefined') {
  // ...
}
```

也不需要额外判断：

```ts
if (isMobile) {
  // ...
}
```

API 仍然保持一致。

---

# 🖱️ 不会影响正常操作

自定义光标只是视觉层。

它不会：

- 拦截点击
- 阻止 hover
- 抢占键盘焦点
- 影响表单操作
- 修改原生指针行为

自定义光标使用：

```css
pointer-events: none;
```

同时带有：

```html
aria-hidden="true"
```

**键盘用户依然按照原来的方式使用页面。**

---

# 不需要构建工具也能使用

如果你只是想在一个 HTML 页面里尝试 magnet-cursor，不需要安装 Node.js，也不需要打包器。

一个完整可运行的页面：

```html
<!doctype html>
<html>
  <head>
    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/@joihouse/magnet-cursor-core@0.1.0/dist/style.css"
    />
  </head>

  <body>
    <button data-magnet-cursor-morph="fill">Hover me</button>

    <script src="https://cdn.jsdelivr.net/npm/@joihouse/magnet-cursor-core@0.1.0/dist/magnet-cursor.global.js"></script>

    <script>
      MagnetCursor.createMagnetCursor({
        size: 100,
        morph: {
          mode: 'fill',
        },
      })
    </script>
  </body>
</html>
```

`magnet-cursor.global.js` 是为这种场景单独构建的：一个文件，一个全局变量，不依赖任何模块解析。

> [!IMPORTANT]
>
> 生产环境建议锁定具体版本。
>
> 不要依赖不带版本号的 CDN 地址，否则新版本发布后可能会影响你的线上页面。

---

# 📚 文档与 Playground

如果你想进一步调整效果：

- 光标大小
- 跟随速度
- 磁吸强度
- 阻尼
- 融合模式
- 下划线样式
- 液态拖尾
- 动画参数
- CSS 自定义属性

可以直接进入在线 Playground 调整。

### 👉 在线体验

**cursor.joia.cn**

### 👉 Playground

**cursor.joia.cn/playground**

### 👉 API 文档

**cursor.joia.cn/docs**

这里不仅可以查看 API，还可以直接修改参数并观察实时效果。

---

# 🛠️ 开发

```bash
# 安装依赖
pnpm install

# 构建所有包
pnpm build

# 运行测试
pnpm test

# 类型检查
pnpm typecheck

# 代码检查与格式检查
pnpm lint

# 自动修复可修的部分
pnpm lint:fix

# 校验发布产物的导出映射与类型解析
pnpm check:exports
```

项目结构：

```text
magnet-cursor/
├── packages/
│   ├── core/              # 核心引擎
│   ├── vue/               # Vue 3 / Nuxt
│   └── react/             # React / Next.js
│
├── docs/
│   ├── roadmap.md         # 里程碑与验收标准
│   ├── guides/            # 每个里程碑一份 guide：怎么做、踩坑、进度
│   └── dev/               # 各包的日常开发文档
├── .github/
│   └── workflows/
│
├── README.md
├── README.zh-CN.md
└── LICENSE
```

---

# 参与贡献

欢迎提交：

- Bug 修复
- 新的交互效果
- 性能优化
- Framework Adapter
- 文档改进
- Demo / Example
- API 建议

如果你发现了问题，欢迎提交 Issue。

如果你希望贡献代码，请先阅读：

`CONTRIBUTING.md`

---

# 🔐 安全问题

如果你发现了安全漏洞，请通过 GitHub Security Advisory 私下报告。

**请不要直接创建公开 Issue。**

这样可以避免漏洞在修复之前被公开传播。

---

# 📄 License

MIT © joihouse

---

<p align="center">
  <strong>Make the cursor part of the experience.</strong>
  <br>
  <sub>让鼠标不只是指针，而是交互的一部分。</sub>
</p>

<p align="center">
  ⭐ 如果 magnet-cursor 对你的项目有帮助，欢迎 Star。
</p>

---

<p align="center">
  <img
    src="https://api.star-history.com/svg?repos=JoiHouse/magnet-cursor&type=Date"
    alt="Star History"
  >
</p>
