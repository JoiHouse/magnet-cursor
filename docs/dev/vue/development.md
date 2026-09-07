# vue 开发文档

> `@joihouse/magnet-cursor-vue`，core 的 Vue 3 生命周期封装。环境、命令、格式规范与 core 相同，见 [dev/core/development.md](../core/development.md#p1-环境与命令)，这里只写本包特有的部分。

## P1 职责边界

### P1.1 只做生命周期

与 react 包同一条规则：在正确的时机调用 core 的 `create*`，转发 options，销毁。**效果逻辑一律在 core 实现。**

### P1.2 目录

| 文件                                                                         | 职责                                                               |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `index.ts`                                                                   | 根出口；同时 re-export core 的全部公开符号                         |
| `entry-cursor.ts`、`entry-magnet.ts`、`entry-gravitational-liquid.ts`        | `/cursor`、`/magnet`、`/gravitational-liquid` 子路径入口           |
| `useMagnetCursor.ts`、`MagnetCursor.ts`                                      | 全局光标的组合式函数与无渲染组件                                   |
| `useMagnet.ts`、`Magnet.ts`、`directive.ts`                                  | 磁吸元素的组合式函数、包装组件、`v-magnet` 指令                    |
| `useGravitationalLiquid.ts`、`GravitationalLiquid.ts`、`liquid-directive.ts` | 引力液体的三种形态                                                 |
| `plugin.ts`                                                                  | `MagnetCursorPlugin`：注册两个指令与三个组件                       |
| `element.ts`                                                                 | `resolveElement`：把模板 ref、组件实例（`$el`）、getter 统一成元素 |

每种效果提供三种形态：组合式函数（拿到实例、可 `stop`）、组件（模板里传类型化 props）、指令（不想多一层组件时用）。新增效果按这个三件套来，缺一种就是不完整。

### P1.3 自检清单

- [ ] 新增能力先确认 core 已有对应 `create*`
- [ ] 三种形态齐全，并加进 `index.ts`、对应 `entry-*.ts`、`plugin.ts`

## P2 生命周期契约

### P2.1 组合式函数

- `useMagnetCursor`：`onMounted` 创建，`onScopeDispose` 销毁，`watch(() => toValue(options), …, { deep: true })` 推送 `setOptions`。
- `useMagnet` / `useGravitationalLiquid`：元素来源是 `MaybeRefOrGetter`，用 `flush: 'post'` 的 immediate watcher 监听 `resolveElement(element)`，元素变了就销毁重建，options 变了只 `setOptions`。

两者都返回 `stop()`，提前销毁后再走 scope dispose 不会二次销毁（`instance.value` 已置空）。

`<KeepAlive>` 停用组件时 scope 不会被销毁，实例保留；这是有意的，页面回来时拿到的是同一个实例。要在停用时暂停，调用方自己在 `onDeactivated` 里 `stop()`。

### P2.2 指令

`mounted` 创建、`updated` 在 `binding.value !== binding.oldValue` 时 `setOptions`、`unmounted` 销毁。实例存在模块级 `WeakMap<HTMLElement, Instance>` 里，元素回收后自动释放。

`getSSRProps: () => ({})` 必须保留，否则 Nuxt 与 `@vue/server-renderer` 会对客户端指令告警。

### P2.3 SSR

`onMounted` 在服务端不执行，但 **immediate watcher 会在服务端 `setup()` 里执行**。所以 `resolveElement` 一进来先判 `typeof HTMLElement === 'undefined'` 直接返回 null；否则一个返回 `{ $el }` 的 getter 会让 `instanceof HTMLElement` 在 Node 上抛 ReferenceError。这个分支有 `test/ssr.test.ts` 用真实 Node 环境（`@vitest-environment node`）锁住。

### P2.4 自检清单

- [ ] 组合式函数：创建 / 销毁配对，`stop()` 幂等
- [ ] 指令：三个钩子齐全，`getSSRProps` 在
- [ ] 新代码没有在 `setup()` 阶段碰 DOM 全局

## P3 组件 props 约定

### P3.1 `<Magnet>` 的 `target`

与 react 包相同：`<Magnet as="a" target="_blank">` 会把 `target` 当作磁吸目标；用 `magnet-target` 指定磁吸目标后，`target` 回到 DOM。`inheritAttrs: true`，非 props 的属性透传给 `as` 元素。

### P3.2 `<MagnetCursor>`

无渲染组件。props 的默认值都是 `undefined`，`setup` 里只把**已设置**的 props 组装进 options，未设置的不出现，避免遮盖 core 的默认值。布尔 props 必须写成 `{ type: Boolean, default: undefined }`，否则 Vue 会把缺省布尔转成 `false`。

`onItemChange` 通过 `emit('itemChange', …)` 转发，模板里用 `@item-change`。

### P3.3 自检清单

- [ ] 新的 options 字段加进组件 `props`，布尔用 `default: undefined`
- [ ] README 的 props 表同步更新

## P4 测试

### P4.1 环境

默认 jsdom。挂载用 `createApp({ render: () => h(Component, props, slots) }).mount(host)`，不依赖 `@vue/test-utils`。组合式函数绑定在 post-flush watcher 上，挂载后要 `await nextTick()` 实例才存在。

mock core 的写法见 [M5 guide P3.1](../../guides/M5-public-release-guide.md#p31-开发内容)。指令测试用 `withDirectives(h('button'), [[vMagnet, value]])`，值变化通过 `reactive` 驱动。

服务端行为用两种方式测：jsdom 下 `renderToString` 断言不触碰引擎、无 `console.warn`；真 Node 下（文件顶部 `// @vitest-environment node`）断言没有 `HTMLElement` 时不抛错。

### P4.2 注意

- `h(KeepAlive, null, { default: () => … })`：KeepAlive 的子节点要用插槽对象，直接传 vnode 过不了类型检查。
- 组件 props 变化后 `setOptions` 收到的是整个 options 对象（含 `onItemChange`），用 `toMatchObject` 断言关心的字段。

### P4.3 自检清单

- [ ] 组合式函数、组件、指令三种形态各有用例
- [ ] SSR 两条路径（jsdom renderToString、真 Node）都覆盖到

## P5 常见问题

| 现象                                       | 先看                                                                 |
| ------------------------------------------ | -------------------------------------------------------------------- |
| Nuxt 服务端报 `HTMLElement is not defined` | `resolveElement` 的环境判断（P2.3），或新代码在 `setup()` 里碰了 DOM |
| Nuxt 警告客户端指令                        | 指令对象缺 `getSSRProps`                                             |
| 布尔 prop 没传却生效成 `false`             | props 定义缺 `default: undefined`（P3.2）                            |
| `<KeepAlive>` 切走后光标还在               | 预期行为（P2.1），需要的话在 `onDeactivated` 里 `stop()`             |
| 指令值改了不生效                           | `updated` 只比较引用，原地修改同一个对象不会触发；传新对象           |
