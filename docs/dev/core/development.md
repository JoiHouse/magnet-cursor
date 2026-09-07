# core 开发文档

> `@joihouse/magnet-cursor-core`，框架无关的引擎，零依赖。这里写**日常怎么开发**；里程碑怎么做见 [guides/](../../guides/)，什么时候做什么见 [roadmap.md](../../roadmap.md)。

## P1 环境与命令

### P1.1 前置

Node `>=18.18`，pnpm `10.x`（根 `package.json` 的 `packageManager` 锁定精确版本，`corepack enable` 后自动匹配）。根目录 `pnpm install` 一次装完三个包。

### P1.2 命令

都在仓库根目录执行；只针对本包时加 `--filter ./packages/core`。

| 命令                 | 作用                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------- |
| `pnpm dev`           | 三个包 `tsup --watch`，改 core 后 react / vue 的 workspace 链接立即拿到新产物          |
| `pnpm build`         | `clean-dist` → tsup。core 另有 `publicDir: 'public'`，`style.css` 随 ESM 构建拷入 dist |
| `pnpm test`          | vitest，jsdom 环境，`packages/*/test/**/*.test.ts`                                     |
| `pnpm test:watch`    | 同上，watch 模式                                                                       |
| `pnpm typecheck`     | `tsc --noEmit`，`include` 含 `src` 与 `test`                                           |
| `pnpm lint`          | `eslint .` 再 `prettier --check`                                                       |
| `pnpm lint:fix`      | 两者的自动修复                                                                         |
| `pnpm check:exports` | 构建后跑 publint 与 are-the-types-wrong，打包真实 `dist` 检查                          |

单跑一个测试文件：`pnpm exec vitest run packages/core/test/morph.test.ts`。

### P1.3 自检清单

- [ ] 改完 `src/` 跑过 `pnpm test` 与 `pnpm typecheck`
- [ ] 改了 `package.json` 或 `tsup.config.ts` 跑过 `pnpm build && pnpm check:exports`

## P2 目录约定

### P2.1 源码

| 文件                      | 职责                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| `index.ts`                | 唯一的公开出口；类型也从这里 re-export                                                   |
| `cursor.ts`               | `createMagnetCursor`：跟随、液体形变、拖尾、item 态、与 morph / underline / theme 的编排 |
| `magnet.ts`               | `createMagnet`：磁吸元素                                                                 |
| `gravitational-liquid.ts` | `createGravitationalLiquid`：引力液体的运动学                                            |
| `liquid-surface.ts`       | 引力液体的绘制层（SVG 与滤镜）                                                           |
| `morph.ts`                | 光标融入目标元素：填充 / 边框揭示、圆角读取                                              |
| `underline.ts`            | 下划线效果                                                                               |
| `theme.ts`                | 主题判定与监听（`detectTheme`、`createThemeWatcher`）                                    |
| `spring.ts`               | 二维阻尼弹簧，半隐式欧拉，子步长 `1/240`                                                 |
| `frame.ts`                | 全库共享的动画帧：`scheduleTick` / `cancelTick`，先全部 `measure` 再全部 `commit`        |
| `geometry.ts`             | 读取元素实际绘制几何：祖先 transform 合成、屏幕坐标盒                                    |
| `env.ts`                  | `isBrowser`、`isPointerDevice`、`prefersReducedMotion`、`lerp`、`clamp`                  |

`public/style.css` 是随包发布的样式表，构建时原样拷入 `dist/style.css`。

### P2.2 产物与入口

`tsup.config.ts` 三个配置并行：

| 配置 | 入口                                                | 格式 | 说明                                                         |
| ---- | --------------------------------------------------- | ---- | ------------------------------------------------------------ |
| ESM  | `index`、`cursor`、`magnet`、`gravitational-liquid` | esm  | 开 `splitting`，共享的 env / frame 落在 chunk 里，保证单实例 |
| CJS  | `index`                                             | cjs  | 只有根入口；esbuild 不能拆 CJS。不带 sourcemap               |
| IIFE | `magnet-cursor`                                     | iife | `globalName: 'MagnetCursor'`，给 `<script src>` 与 CDN       |

`exports` 里子路径 `./cursor`、`./magnet`、`./gravitational-liquid` 只声明 `import`，是 ESM-only；`check:exports` 忽略 `cjs-resolves-to-esm` 就是为此。`./style.css` 与 `./package.json` 直接映射。

所有配置 `clean: false`，清理由 `scripts/clean-dist.mjs` 在 tsup 之前做一次。**不要给任一配置加回 `clean: true`**，两个 DTS 构建并行时会互删产物。

### P2.3 自检清单

- [ ] 新模块的公开符号已加进 `index.ts`
- [ ] 新增子路径入口时同时改 `tsup.config.ts` 的 ESM `entry` 与 `package.json` 的 `exports`，并跑 `check:exports`

## P3 编码规范

### P3.1 SSR 契约

每个效果都是纯客户端的，SSR 契约不是「能在服务端渲染」而是「服务端 `import` 什么都不做、什么都不抛」。规则：

- `window`、`document`、`navigator` 只能出现在函数体内，且在 `isBrowser()` 守卫之后。模块顶层碰到它们会被 eslint 的 `no-restricted-syntax` 拦下。
- `create*` 在非浏览器、触控设备、`prefers-reduced-motion` 下返回**惰性实例**：同样的方法签名，全部 no-op。调用方不需要判空。

### P3.2 帧与读写分离

任何每帧要读布局又要写样式的效果都通过 `frame.ts` 接入，实现 `FrameTick` 的 `measure()` 与 `commit()`，不要自己 `requestAnimationFrame`。同一帧内先跑完所有 tick 的 measure 再跑所有 commit，多实例并存时不会互相触发同步重排。

循环必须能停：静止时不再调度下一帧。「休眠条件」在 `cursor.ts` 的 render 循环里，新增效果要给它提供「我是否还在动」的判断。

### P3.3 时间积分

不用与帧率绑定的朴素 `lerp(a, b, k)`。跟随把系数换算成时间常数，按 `1 - exp(-dt / tau)` 积分；弹簧走 `spring.ts`。这样 60 / 120 / 240Hz 行为一致。

### P3.4 样式与 DOM

- 用户可覆盖的值一律通过 `--mc-*` 自定义属性暴露（现有：`--mc-size`、`--mc-color`、`--mc-item-color`、`--mc-scale`、`--mc-item-scale`、`--mc-pin-scale`、`--mc-blur`、`--mc-blend`、`--mc-z-index`、`--mc-radius`、`--mc-wave`、`--mc-fill-amount`、`--mc-trail-box`、`--mc-morph-color`、`--mc-morph-width`、`--mc-underline-color`、`--mc-underline-width`、`--mc-override-color`），写在 `style.css`，JS 只改属性值。
- 页面侧的声明式钩子用 `data-magnet-cursor-*` 属性（`-color`、`-item`、`-morph`、`-underline`、`-gravitating`）。新增钩子沿用这个前缀。
- 拖尾滤镜内的元素不得申请独立合成层（`will-change`、`translate3d`），Safari 会按层分别应用滤镜导致水滴不融合。滤镜内用 2D `translate`。
- `feColorMatrix` 的 alpha 乘数必须小于 128，WebKit 按有符号字节解释。

### P3.5 风格

Prettier 负责格式（无分号、单引号、宽 100）。`tsconfig.base.json` 开了 `strict`、`noUncheckedIndexedAccess`、`verbatimModuleSyntax`，索引访问要处理 `undefined`，类型导入写 `import type`。

注释解释**为什么**，不复述代码。`cursor.ts` 与 `magnet.ts` 里现有的注释是标杆：只写非显然的决定。

### P3.6 自检清单

- [ ] 没有模块顶层的浏览器全局
- [ ] 每帧逻辑走 `FrameTick`，且有停止条件
- [ ] 新的可调值走 `--mc-*` 与 `data-magnet-cursor-*`
- [ ] 与 WebKit 相关的改动在真机 Safari 看过一眼（无头 WebKit 测不出合成层问题）

## P4 测试

### P4.1 环境

vitest + jsdom。jsdom 没有布局，需要的几何自己 stub：

```ts
el.getBoundingClientRect = () =>
  ({ left: 100, top: 100, width: 200, height: 100, right: 300, bottom: 200 }) as DOMRect
```

动画帧同步化：

```ts
vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
  cb(0)
  return 1
})
vi.stubGlobal('cancelAnimationFrame', () => {})
```

`afterEach` 里 `vi.unstubAllGlobals()`，并销毁实例、移除挂载节点，模块级状态（frame 的 pending 集合）才不会串到下一个用例。

创建实例时传 `{ detectPointer: false, respectReducedMotion: false }`，否则 jsdom 被判为非指针设备，拿到的是惰性实例。

### P4.2 写什么

- 每个公开选项至少一个用例锁默认值与生效路径。
- 涉及浏览器差异的常量（如 alpha 乘数上限）用测试锁住约束，不只靠注释。
- 行为断言到 DOM 结果（`style.transform`、class、自定义属性），不断言内部变量。

### P4.3 自检清单

- [ ] 新选项有测试
- [ ] 用例之间不共享实例，`afterEach` 清干净
- [ ] `pnpm test` 全绿且没有新增的 console 警告

## P5 调试与常见问题

### P5.1 现象对照

| 现象                           | 先看                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| 光标完全不出现                 | `isPointerDevice()` / `prefersReducedMotion()` 是否返回了惰性实例；style.css 是否引入 |
| 开拖尾后 Safari 上整个光标消失 | `cursor.ts` 的 `SOLID_ALPHA` 必须 `< 128`                                             |
| Safari 上拖尾散成圆点          | 滤镜内元素被提升为合成层，检查 `will-change` / `translate3d`                          |
| 指针静止 CPU 不降              | 某个效果的「还在动」判断没归零，看 render 循环的休眠条件                              |
| 融合目标被删除后光标卡住       | 目标 `isConnected` 检查，在 render 循环每帧做                                         |
| 构建后 `index.d.cts` 缺失      | 有人把 `clean: true` 加回了 tsup 配置，或有并行构建                                   |

### P5.2 本地联调

`pnpm dev` 后在任意项目 `pnpm link ../magnet-cursor/packages/core`，或直接打开一个只引 `dist/magnet-cursor.global.js` 与 `dist/style.css` 的静态页面，用 `MagnetCursor.createMagnetCursor()` 试。

### P5.3 自检清单

- [ ] 调试超过 30 分钟的问题记进当前里程碑 guide 的踩坑
- [ ] 新的「现象 → 先看」条目补进 P5.1
