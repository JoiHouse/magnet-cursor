# Roadmap

> 回答**什么时候做什么**：里程碑划分、依赖、验收标准。每个里程碑怎么落地写在 [guides/](./guides/)，日常怎么开发写在 [dev/](./dev/)。三者职责见 [guides/README.md](./guides/README.md#p1-文档分工)。

## 总表

| 里程碑 | 主题               | 依赖   | 状态                 | Guide                                                             |
| ------ | ------------------ | ------ | -------------------- | ----------------------------------------------------------------- |
| M0     | 核心引擎           | —      | 已完成               | 无（早于 guide 制度）                                             |
| M1     | 框架绑定           | M0     | 已完成               | 无                                                                |
| M2     | 融合与下划线       | M0, M1 | 已完成               | 无                                                                |
| M3     | 拖尾与引力液体     | M0, M1 | 已完成               | 无                                                                |
| M4     | 跨浏览器与性能     | M2, M3 | 已完成（2026-09-06） | 无                                                                |
| M5     | 首次公开发布 0.1.0 | M4     | **进行中**           | [M5-public-release-guide.md](./guides/M5-public-release-guide.md) |
| M6+    | 待定               | M5     | 未立项               | —                                                                 |

M0–M4 早于本文档，只记录范围与验收口径，不补写 guide；它们的设计取舍与踩坑记录保留在维护者的私有笔记里，不入库。

## M0 核心引擎

**范围**：`packages/core`。跟随光标（时间常数积分的指数逼近）、速度驱动的液体形变、磁吸元素（弹簧积分）、单帧读写分离的调度器（`frame.ts`）、SSR 与触控设备与减弱动态的守卫（`env.ts`）。

**验收**

- 静止指针不占用动画帧：循环在到达阈值后自行停止。
- 60Hz / 120Hz / 240Hz 下动效速率一致。
- 服务端 `import` 不抛错，返回惰性实例。
- 单元测试覆盖弹簧、环境判定、磁吸几何。

## M1 框架绑定

**范围**：`packages/vue`、`packages/react`。组件、组合式函数 / hook、Vue 指令与插件；每个包暴露 `/cursor`、`/magnet`、`/gravitational-liquid` 子路径。

**验收**

- 框架包只做生命周期：创建、转发 options、卸载销毁，不含效果逻辑。
- React StrictMode 双挂载后实例仍存活；Vue `<KeepAlive>` 停用时实例保留。
- options 变化走 `setOptions`，不重建实例。

## M2 融合与下划线

**范围**：光标融入被指元素（`morph.ts`：填充 / 边框两种揭示）、下划线（`underline.ts`）、空闲脉冲、主题跟随（`theme.ts`）。

**验收**

- 融合过程中目标元素被移出 DOM 时释放引用。
- 主题监听只观察 `<html>` 与 `<body>` 的属性变化，不监听全页子树。
- 融合期间光标本体让位，下划线叠加不替代。

## M3 拖尾与引力液体

**范围**：SVG goo 滤镜驱动的水滴队列拖尾（`cursor.ts` 的 trail 部分）、被指针吸引并侵蚀表面的引力液体（`gravitational-liquid.ts`、`liquid-surface.ts`）。

**验收**

- 拖尾与引力液体各自可通过子路径单独引入。
- 拖尾关闭时不注入滤镜。

## M4 跨浏览器与性能

**范围**：Safari / WebKit 渲染修复；性能实测并按「只修可感知卡顿」取向落地。

**验收**

- 开启拖尾时光标在 WebKit 上可见且水滴融合。
- Safari 17 及以下的 `backdrop-filter` 与 `mask-composite` 有前缀回退。
- 性能结论来自 Playwright + CDP 实测，不来自源码推断。

## M5 首次公开发布 0.1.0

**范围**：开源前审查、发布流水线、框架层测试补齐、仓库与 npm 侧设置、以干净的初始提交重建公开仓库并发布。

**验收**

- 仓库内无密钥、本机路径、私有目录引用；`site/`、`development/`、本地脚本均被忽略。
- `pnpm lint`、`typecheck`、`build`、`test`、`check:exports` 在 CI 全绿；构建产物确定性（`.d.cts` 不再随机缺失）。
- Release workflow 在 changesets 前跑完整检查，发布带 npm provenance。
- 首发版本号为 0.1.0，与 README 的 CDN 链接一致。
- GitHub：私有漏洞报告开启、Actions 可开 PR、`NPM_TOKEN` 就位、About 信息填写。
- 演示站 cursor.joia.cn 首页、`/docs`、`/playground` 可访问且证书有效。
- 三个包在 npm 上可安装，`@joihouse/*` scope 归属确认。

详细步骤与进度见 [M5 guide](./guides/M5-public-release-guide.md)。

## M6 及之后

未立项。候选方向记录在此，立项时转为正式条目并编写 guide：

- 其他框架绑定（Svelte、Solid）。
- 无障碍：`prefers-reduced-motion` 之外的可配置降级、焦点态跟随。
- 文档站与演练场从私有 `site/` 中拆出可公开的部分。
