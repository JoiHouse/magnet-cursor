# react 开发文档

> `@joihouse/magnet-cursor-react`，core 的 React 生命周期封装。环境、命令、格式规范与 core 相同，见 [dev/core/development.md](../core/development.md#p1-环境与命令)，这里只写本包特有的部分。

## P1 职责边界

### P1.1 只做生命周期

这个包只负责三件事：在正确的时机调用 core 的 `create*`，把 options 转发下去，卸载时 `destroy`。**效果逻辑一律在 core 实现**，如果发现自己在这里写动效、几何或样式计算，那段代码属于 core，写到 core 之后 Vue 包也会同时获得它。

### P1.2 目录

| 文件                                                                  | 职责                                                              |
| --------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `index.ts`                                                            | 根出口；同时 re-export core 的全部公开符号，用户不需要单独装 core |
| `entry-cursor.ts`、`entry-magnet.ts`、`entry-gravitational-liquid.ts` | `/cursor`、`/magnet`、`/gravitational-liquid` 子路径入口          |
| `useMagnetCursor.ts`、`MagnetCursor.ts`                               | 全局光标的 hook 与无渲染组件                                      |
| `useMagnet.ts`、`Magnet.ts`                                           | 磁吸元素的 hook 与包装组件                                        |
| `useGravitationalLiquid.ts`、`GravitationalLiquid.ts`                 | 引力液体的 hook 与包装组件                                        |
| `internal.ts`                                                         | `useLatest`、`withoutFunctions`、`useOptionsSignature`            |

### P1.3 自检清单

- [ ] 新增能力先确认 core 已有对应 `create*`，这里只加封装
- [ ] 新增 hook 与组件同时加进 `index.ts` 和对应的 `entry-*.ts`

## P2 生命周期契约

### P2.1 创建与销毁在同一个 effect

实例在 `useEffect` 里创建，清理函数里销毁，两者必须在**同一个** effect。React 18+ StrictMode 会对 effect 做「挂载、清理、再挂载」，但稳定的 callback ref 只附着一次；如果在 ref 回调里创建、在另一个 effect 里销毁，StrictMode 的清理会销毁实例且没有任何东西重建它，元素就静默失效。

`useMagnet` 因此把元素通过 `useState` 传递：callback ref 只做 `setNode`，effect 依赖 `node`，创建与销毁自然共享一个生命周期。

### P2.2 options 变化走 setOptions

options 通常是内联对象，每次渲染身份都变。`useOptionsSignature` 只在**非函数字段的值**变化时递增计数，effect 依赖这个计数去调 `setOptions(withoutFunctions(options))`，所以：

- 同值换对象不会推送。
- 回调永远不进 `setOptions`。创建时传给 core 的是代理函数，代理从 `useLatest` 的 ref 读最新回调，用户换回调不会重建实例。

新增 hook 沿用这三个工具，不要自己 `useMemo` options。

### P2.3 SSR 与客户端边界

所有导出都是 hook 或基于 hook 的组件，整个包是客户端边界。构建后 `scripts/use-client.mjs` 给每个产物文件顶部写入 `'use client'`，Next.js App Router 才能直接引入。源码里不要写这条指令，esbuild 会丢掉它。

`renderToString` 下 `useEffect` 不执行，core 不会被调用；`<MagnetCursor>` 渲染为空。

### P2.4 自检清单

- [ ] 创建与销毁在同一个 `useEffect`
- [ ] options 通过 `useOptionsSignature` + `withoutFunctions` 推送
- [ ] 回调通过 `useLatest` 代理
- [ ] `test/strict-mode.test.ts` 与 `test/cursor.test.ts` 的 StrictMode 用例仍通过

## P3 组件 props 约定

### P3.1 `<Magnet>` 的 `target`

`target` 在锚点上有两个含义。`<Magnet as="a" target="_blank">` 会把 `target` 当作磁吸目标读走；要让它回到 DOM，用 `magnetTarget` 指定磁吸目标，此时 `target` 原样转发给元素。`MAGNET_OPTION_KEYS` 列出哪些 props 属于 options，其余全部透传给 `as` 指定的元素。

### P3.2 `<MagnetCursor>`

无渲染组件，props 即 `MagnetCursorOptions`。放在应用根附近渲染一次；App Router 里需要在 `'use client'` 文件中使用。

### P3.3 自检清单

- [ ] 新的 options 字段加进 `MAGNET_OPTION_KEYS`（或对应组件的键表），否则会被当作 DOM 属性透传
- [ ] README 的 props 表同步更新

## P4 测试

### P4.1 两种写法

- **真引擎**：`magnet.test.ts`、`strict-mode.test.ts`。用 core 的真实实现，stub 布局与 rAF，断言 DOM 上的 transform。适合验证「组件把正确的元素和 options 交给了 core」。
- **mock 引擎**：`cursor.test.ts`、`use-magnet.test.ts`。`vi.mock('@joihouse/magnet-cursor-core')` 替换 `create*`，断言调用次数、参数、`setOptions` / `destroy` 次数。适合验证生命周期契约。

mock 写法见 [M5 guide P3.1](../../guides/M5-public-release-guide.md#p31-开发内容)。

### P4.2 React 19 注意

- `act` 从 `react` 引入，不是 `react-dom/test-utils`。
- `beforeEach` 里设置 `globalThis.IS_REACT_ACT_ENVIRONMENT = true`。
- `createRoot` 与 `root.unmount()` 都包在 `act` 里。
- 首次渲染 `useOptionsSignature` 就会触发一次 `setOptions`，计数断言从挂载后的次数起算。

### P4.3 自检清单

- [ ] 生命周期改动同时有 StrictMode 用例
- [ ] 新 hook 至少覆盖：创建、options 推送、回调代理、卸载

## P5 常见问题

| 现象                                  | 先看                                                                                            |
| ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| StrictMode 下元素不吸                 | 创建与销毁是否在同一个 effect（P2.1）                                                           |
| 每次渲染都重建实例                    | effect 依赖里是否放了 options 对象本身而不是 signature                                          |
| 换了回调不生效                        | 是否绕过了 `useLatest` 直接把回调传给 core                                                      |
| Next.js 报 hooks 只能在客户端组件使用 | 用的是本地 `src` 而非构建产物，或 `use-client.mjs` 没跑；`pnpm build` 后看 `dist/index.js` 首行 |
| 外链 `target="_blank"` 丢失           | 改用 `magnetTarget`（P3.1）                                                                     |
