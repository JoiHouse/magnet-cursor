# M5 首次公开发布 0.1.0 Guide

> 状态：**进行中**（2026-09-06 启动）。范围与验收口径见 [roadmap.md](../roadmap.md#m5-首次公开发布-010)，编写规范见 [README.md](./README.md)。

## 范围与执行顺序

把已经完成功能开发的三个包以一次干净的初始提交公开，并发布 0.1.0 到 npm。顺序固定：先把仓库内的问题清零（P1–P4），再做仓库外的设置（P5），最后重建公开仓库并发布（P6）。P5 依赖 P1–P4 全部完成，P6 依赖 P5。

当前仓库 `JoiHouse/magnet-cursor` 已设为私有，作为 P1–P5 的验证场；P6 时以同名或新名重建公开仓库。

## P1 开源前审查

对工作区做一次泄露与一致性审查，输出问题清单。不改代码，只产出 P2–P4 的待办。

### P1.1 开发内容

按下面的顺序扫，每一步都是一条命令，结果直接决定后面的待办：

```bash
# 密钥、令牌、私钥
git grep -nIiE '(api[_-]?key|secret|token|password|AKIA[0-9A-Z]{16}|ghp_|npm_|BEGIN .* PRIVATE)' -- . ':(exclude)pnpm-lock.yaml'
# 邮箱与本机路径
git grep -nIE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}' -- . ':(exclude)pnpm-lock.yaml'
git grep -nIE '/Users/|/home/|C:\\\\' -- . ':(exclude)pnpm-lock.yaml'
# 私有目录、内网地址、遗留标记
git grep -nIE 'localhost:[0-9]+|127\.0\.0\.1|marketing/|site/|development/' -- . ':(exclude)pnpm-lock.yaml' ':(exclude).gitignore'
git grep -nIE '\b(TODO|FIXME|HACK|XXX)\b' -- . ':(exclude)pnpm-lock.yaml'
# 未跟踪文件里同样扫一遍（git grep 不覆盖）
git ls-files --others --exclude-standard
# 提交作者
git log --format='%an <%ae>'
```

然后跑全量检查，所有失败都进待办：

```bash
pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm build && pnpm test && pnpm check:exports
```

最后核对 README、CONTRIBUTING、SECURITY、issue / PR 模板、changeset 之间的版本号、命令、目录名是否一致。

### P1.2 发现与处置

| 发现                                                                      | 严重度 | 处置                         |
| ------------------------------------------------------------------------- | ------ | ---------------------------- |
| tsup 双配置并行，`clean: true` 删掉另一配置已产出的 `.d.cts`，约 1/4 概率 | 阻塞   | P2.1                         |
| 一份文档含 17 处 `file:///Users/...` 本机链接，且未过 prettier            | 阻塞   | 先改相对路径，后整份移出仓库 |
| 包版本 0.1.0 + changeset `minor` → 首发变 0.2.0，与 README CDN 链接不符   | 阻塞   | P2.2                         |
| release workflow 发布前不跑任何检查                                       | 应修   | P2.3                         |
| eslint 配置引用私有 `site/`，`eslint-plugin-react-hooks` 只为它存在       | 应修   | P2.4                         |
| `playwright` devDependency 只被已忽略的本地脚本使用                       | 应修   | P2.4                         |
| CONTRIBUTING 列出私有 `development` 目录、lint 描述过时                   | 应修   | P2.5                         |
| 框架包各只有 2 个测试                                                     | 可选   | P3                           |

没有密钥、邮箱、TODO；提交作者是 GitHub noreply 邮箱；私有目录均已忽略。

### P1.3 验收与进度

- [x] 扫描命令全部跑过，结果记录在 P1.2
- [x] 全量检查跑过，失败项进入待办
- [x] 文档一致性核对完成

状态：**已完成**（2026-09-06）

## P2 构建与发布加固

把 P1 的阻塞项和应修项清零，让 CI 与 Release 两条流水线确定性地通过。依赖 P1。

### P2.1 构建确定性

三个包的 `tsup.config.ts` 都是两个配置并行：ESM 多入口 + 拆分，CJS 单 bundle。原来 ESM 配置带 `clean: true`，与 CJS 的 DTS 产出竞争。

改法：所有配置 `clean: false`；新增 `scripts/clean-dist.mjs`，在 `build` 脚本里先跑它：

```json
"build": "node ../../scripts/clean-dist.mjs && tsup"
```

react / vue 的 `build` 后面还跟 `use-client.mjs`（给产物打 `'use client'`）和 `copy-style.mjs`。

验证方法是连续构建五次，每次检查三个包的 `dist/index.d.cts` 都在：

```bash
for i in 1 2 3 4 5; do pnpm build >/dev/null 2>&1; ls packages/*/dist/index.d.cts | wc -l; done
```

**踩坑**：修复后有一次又缺了 react 的 `.d.cts`，排查发现是另一个会话在同一目录并行跑构建，它的 clean 步骤删了这边的产物。多会话共用工作区时，任何「随机」的构建失败先怀疑并行。

### P2.2 版本与导出

- `exports["."]` 改为 `import` / `require` 各带自己的 `types`，CJS 指向 `index.d.cts`。
- 三个包 `version` 改为 `0.0.0`，`changeset status` 确认 `minor` 产出 0.1.0。
- 三个包加 `engines.node >= 18.18.0`。
- `check:exports` 脚本：`publint --strict && attw --pack . --profile node16 --ignore-rules cjs-resolves-to-esm --exclude-entrypoints ./style.css`。子路径是 ESM-only，`cjs-resolves-to-esm` 是预期。

### P2.3 发布流水线

`release.yml` 在 changesets 动作之前加入 lint、build、typecheck、test、check:exports 五步；`release` 脚本改为 `pnpm build && pnpm check:exports && changeset publish`；changesets 环境加 `NPM_CONFIG_PROVENANCE: 'true'`，依赖已有的 `id-token: write`。

changelog 生成器换成 `@changesets/changelog-github`，`.changeset/config.json` 里填 `repo: JoiHouse/magnet-cursor`。本地跑 `pnpm version-packages` 需要 `GITHUB_TOKEN`，CI 自带。

新增 `.github/dependabot.yml`：npm 与 Actions 每周，devDependencies 合并一个 PR，忽略 vue / react / react-dom，TypeScript 只提小版本。

**踩坑**：dependabot 上线当天就开了 devDependencies 组 PR，把 TypeScript 提到 7.0.2，CI 在 `pnpm lint` 报 `typescript-eslint does not support TS 7.0`。typescript-eslint 的 peer 是 `<6.1.0`，tsup 的 DTS 构建同样绑 TS 大版本。处置是 dependabot 对 `typescript` 加 `update-types: ['version-update:semver-major']` 忽略，大版本跟 typescript-eslint 一起手动升。看到 CI 红先确认是哪个分支、哪个触发源，main 的 lockfile 锁的是 5.9.3。

### P2.4 工具链去私有化

- `eslint.config.js`：删除 react-hooks 插件与 `site/**` 专属块；`site/**`、`marketing/**`、`development/**` 进 ignores，本地 `eslint .` 不会碰它们，公开仓库也不引用不存在的目录。
- 根 `package.json` 移除 `eslint-plugin-react-hooks`、`playwright`。基准与 WebKit 校验脚本不在仓库里，保留依赖没有意义；文档里注明需自行安装。

### P2.5 文档一致性

CONTRIBUTING 的布局表、lint 描述、PR 前清单，PR 模板的检查项，SECURITY 的版本措辞，三处对齐到当前脚本与版本策略。

**踩坑**：一次 `git add a b c d` 里有一个路径已被 `git rm` 暂存，git 对整条命令报 `pathspec did not match` 且**一个文件都不加**，随后的 `git commit` 只提交了之前暂存的删除。提交后要看 `git show --stat HEAD` 核对文件数，而不是只看 push 成功。

### P2.6 验收与进度

- [x] 连续五次构建 `.d.cts` 三包齐全
- [x] `changeset status` 显示首发 0.1.0
- [x] `pnpm check:exports` 三包通过
- [x] release.yml 含五步检查与 provenance
- [x] dependabot、changelog-github、engines 就位
- [x] eslint 与依赖不再引用私有目录
- [x] CONTRIBUTING / PR 模板 / SECURITY 一致

状态：**已完成**（2026-09-06）

## P3 框架层测试补齐

core 有 180 余个用例，react / vue 各 2 个，框架层的生命周期契约没有被锁住。依赖 P2（测试要在确定性的构建上跑）。

### P3.1 开发内容

mock core 的 `createMagnetCursor` / `createMagnet` / `createGravitationalLiquid`，只断言调用次数、参数和返回实例上的 `setOptions` / `destroy` / `reset`，不测动效本身：

```ts
const engine = vi.hoisted(() => {
  const instances: Array<{
    setOptions: ReturnType<typeof vi.fn>
    destroy: ReturnType<typeof vi.fn>
  }> = []
  const createMagnetCursor = vi.fn(() => {
    const instance = { setOptions: vi.fn(), destroy: vi.fn() }
    instances.push(instance)
    return instance
  })
  return { instances, createMagnetCursor }
})

vi.mock('@joihouse/magnet-cursor-core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@joihouse/magnet-cursor-core')>()),
  createMagnetCursor: engine.createMagnetCursor,
}))
```

所有源码都从 core 的根入口引入，一个 `vi.mock('@joihouse/magnet-cursor-core')` 即可覆盖三个 `create*`。如果某个文件改成从子路径引入（如 `.../gravitational-liquid`），vitest 按模块 ID 匹配，得单独再 mock 那个子路径。

新增文件：

| 包    | 文件                      | 覆盖                                                                           |
| ----- | ------------------------- | ------------------------------------------------------------------------------ |
| react | `test/cursor.test.ts`     | 创建 / 销毁、StrictMode 双挂载、options 走 setOptions、回调代理、SSR           |
| react | `test/use-magnet.test.ts` | 回调 ref 绑定、options 变更、三个回调代理、reset、ref 换元素时重建             |
| vue   | `test/cursor.test.ts`     | 组件只传已设 props、setOptions、itemChange emit、卸载、SSR、KeepAlive 停用保留 |
| vue   | `test/directive.test.ts`  | 两个指令的 mounted / updated / unmounted、值不变不推、SSR 无警告               |
| vue   | `test/plugin.test.ts`     | 默认注册、自定义名、跳过组件                                                   |

### P3.2 注意事项

- React 19 下 `act` 从 `react` 引入；`IS_REACT_ACT_ENVIRONMENT` 要在 `globalThis` 上置 true。
- Vue 的 `<KeepAlive>` 在 `h()` 里要用具名插槽对象 `{ default: () => ... }`，直接传子节点过不了类型检查。
- `useOptionsSignature` 在首次渲染就会让 `setOptions` 跑一次，计数断言要从挂载后的次数起算。
- 验证「不传回调给 setOptions」时先断言 `setOptions` 至少被调过一次，否则循环体为空也能过。

### P3.3 验收与进度

- [x] react 16 个用例、vue 23 个用例通过（含并行会话补的 `ssr.test.ts`）
- [x] 全量 221 个用例通过
- [x] `pnpm typecheck` 对 test 目录也通过（tsconfig `include` 含 `test`）

状态：**已完成**（2026-09-06）

## P4 文档重组

原 `docs/` 是八份中文设计文档，其中一份对自身代码标注「高危缺陷」，结论又被实测文档修正。决定：全部移入私有 `development/`，`docs/` 重建为 roadmap / guides / dev 三部分。依赖 P1。

### P4.1 开发内容

```bash
for f in docs/*.md; do mv "$f" development/; done
git rm -r --cached docs
```

然后处理引用：

- 源码注释里 7 处 `See docs/safari-compat.md` / `docs/performance-benchmark.md` 改为指向 `development/`，并注明「maintainer notes, not published」。改完按周围注释宽度重新折行，不留超长行。
- README 两份的目录树、CONTRIBUTING 的文档指引改为新结构。
- 新建 `docs/roadmap.md`、`docs/guides/README.md`、本文、`docs/dev/{core,react,vue}/development.md`。

### P4.2 验收与进度

- [x] `docs/` 下只剩 roadmap.md、guides/、dev/
- [x] `git grep 'docs/'` 在 packages 下无残留
- [x] `pnpm lint` 通过（prettier 覆盖 md）

状态：**已完成**（2026-09-06）

## P5 仓库与 npm 设置

仓库外的手工操作，全部在网页或 npm 账号侧。依赖 P1–P4。

### P5.1 开发内容

GitHub `JoiHouse/magnet-cursor`：

1. Settings → Code security → **Private vulnerability reporting** → Enable。SECURITY.md、issue 模板、行为准则的举报链接都指向 `security/advisories/new`，未开启时 404。公开 API 已确认当前为 `enabled: false`。
2. Settings → Actions → General → Workflow permissions → 勾选 **Allow GitHub Actions to create and approve pull requests**。changesets 靠它开 Version Packages PR。
3. Settings → Environments → New environment，名字 **`npm`**：Required reviewers 加自己；在这个 environment 下添加 secret `NPM_TOKEN`，**不要**放 repository secrets。token 用 Granular Access Token，权限 Read and write，scope 限定 `@joihouse`，勾选 bypass 2FA（CI 无法交互），有效期上限 90 天。release.yml 的 `publish` job 声明 `environment: npm`，所以发布前必须有人在 Actions 页批准部署，secret 也只在批准后可见；开版本 PR 的 `version` job 不带 environment，无人值守。
4. 仓库首页 About 齿轮：Description、Website `https://cursor.joia.cn`、Topics `cursor`、`custom-cursor`、`magnetic`、`animation`、`typescript`、`vue`、`react`。
5. 推送后 Settings → Branches → main 加保护：Require a pull request before merging（单人维护 review 数可为 0）、Require status checks（选 CI 的 `verify`）、Do not allow force pushes。配合 `.github/CODEOWNERS`（workflows、`.changeset/`、各 `package.json`、lockfile 归维护者），改发布链的 PR 必须过维护者。

npm：

```bash
npm login
npm whoami
npm org ls joihouse          # 或 npm access list packages @joihouse
```

确认 `@joihouse` scope 归当前账号。三个包目前 `npm view` 404 是预期。

演示站，在不经本机代理的环境执行：

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://cursor.joia.cn/
curl -sS -o /dev/null -w '%{http_code}\n' https://cursor.joia.cn/docs
curl -sS -o /dev/null -w '%{http_code}\n' https://cursor.joia.cn/playground
```

三个都应为 200，且证书由公共 CA 签发。本机代理会把该域名解析到 198.18.x.x 假 IP，在那种环境下的结果无效。

### P5.2 验收与进度

- [ ] Private vulnerability reporting 已开启（API 返回 `enabled: true`）
- [ ] Actions 可开 PR
- [ ] environment `npm` 已建，required reviewer 与 `NPM_TOKEN` 都在它下面
- [ ] About 三项已填
- [ ] main 分支保护要求 CI 通过
- [ ] `@joihouse` scope 归属确认
- [ ] 演示站三个路径 200 且证书有效

状态：**未开始**

## P6 重建公开仓库与首发

以一次干净的初始提交公开，并合并版本 PR 完成 0.1.0 发布。依赖 P5。

### P6.1 开发内容

1. **停掉所有并行会话**，确认 `git status` 干净或只剩要提交的内容。
2. 最后一次全量验证，并连续构建三次核对 `.d.cts`：

   ```bash
   pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm build && pnpm test && pnpm check:exports
   ```

3. 重新跑一遍 P1.1 的扫描命令，确认没有新引入的泄露。
4. 压成一个初始提交并推到新仓库（新仓库创建时不要初始化 README）：

   ```bash
   git checkout --orphan release
   git add -A
   git commit -m "chore: initial public release"
   git remote set-url origin https://github.com/JoiHouse/magnet-cursor.git   # 或新仓库地址
   git push -u origin release:main --force
   ```

   `--force` 只在目标仓库为空或明确要覆盖时使用。

5. 在新仓库重复 P5.1 的 GitHub 五项设置，然后把仓库设为 Public。
6. 等 Release workflow 的 `version` job 开出 "chore: version packages" PR，核对三个包版本均为 0.1.0、CHANGELOG 内容正确，合并。
7. 合并触发的 Release 跑到 `publish` job 会停下等审批：Actions 页 → 该 run → Review deployments → 勾 `npm` → Approve。发布完成后验证：

   ```bash
   npm view @joihouse/magnet-cursor-core version      # 0.1.0
   npm view @joihouse/magnet-cursor-core dist.attestations   # provenance 存在
   mkdir /tmp/smoke && cd /tmp/smoke && npm init -y >/dev/null && npm i @joihouse/magnet-cursor-core @joihouse/magnet-cursor-vue @joihouse/magnet-cursor-react
   node -e "console.log(Object.keys(require('@joihouse/magnet-cursor-core')))"
   ```

8. 打 tag `v0.1.0` 推上去，GitHub Release 由 changesets 自动创建则不再手建。
9. 三个包存在后切 Trusted Publishing：每个包 Settings → Trusted Publisher → GitHub Actions，仓库 `JoiHouse/magnet-cursor`、workflow `release.yml`、environment `npm`。然后删掉 release.yml 里的 `NODE_AUTH_TOKEN` 行和 environment 里的 `NPM_TOKEN`，从此没有长期 token。

### P6.2 注意事项

- README 的 npm 徽章与 CDN 链接在发布前是 404，属预期，不要为了徽章提前发布。
- `NPM_CONFIG_PROVENANCE` 要求 `repository.url` 与实际仓库一致；如果 P6.1 第 4 步换了仓库名，先改三个包的 `repository.url`、`homepage`、`bugs.url` 再推。
- Version Packages PR 合并前不要再往 main 推别的提交，否则 changesets 会重开 PR。

### P6.3 验收与进度

- [ ] 新仓库只有一个初始提交，CI 绿
- [ ] Version Packages PR 显示三包 0.1.0 并已合并
- [ ] 三个包 `npm view` 返回 0.1.0 且带 provenance
- [ ] 空项目安装三包并 `require` 成功
- [ ] `v0.1.0` tag 存在

状态：**未开始**

## P7 里程碑验收与进度总表

| P   | 主题               | 状态   | 完成日期   |
| --- | ------------------ | ------ | ---------- |
| P1  | 开源前审查         | 已完成 | 2026-09-06 |
| P2  | 构建与发布加固     | 已完成 | 2026-09-06 |
| P3  | 框架层测试补齐     | 已完成 | 2026-09-06 |
| P4  | 文档重组           | 已完成 | 2026-09-06 |
| P5  | 仓库与 npm 设置    | 未开始 | —          |
| P6  | 重建公开仓库与首发 | 未开始 | —          |

里程碑收尾条件：P5、P6 全部验收项勾选，且 roadmap M5 的验收逐条对得上。
