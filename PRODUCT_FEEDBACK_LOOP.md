# 产品反馈自进化 Loop

## 当前能力

- 使用者在 `/feedback` 提交产品建议。
- 建议进入 `product_feedback` 数据表。
- 系统基于关键词和影响范围做第一轮初筛：
  - `candidate`：疑似缺陷或核心流程高影响建议，进入优化候选。
  - `needs-review`：先合并相似反馈、确认收益。
- `scripts/loop-verify.mjs` 会验证反馈提交、读取和初筛结果。

## 每日自动化

- Codex 自动化 ID：`okr-loop`。
- 频率：每天运行一次。
- 固定读取线上反馈：`https://okr-weekly-workbench.leodong.chatgpt.site/api/feedback`。
- 固定生产站点：`https://okr-weekly-workbench.leodong.chatgpt.site`。
- 每天最多选择 1 条高价值、可验证、低风险反馈进入产品迭代。
- 如果当天没有合格反馈，只记录“已检查、无发布”，不为了凑版本做无意义改动。

## 多 Agent 协作分工

1. 收集 Agent：读取新增反馈，合并重复问题，标记影响范围。
2. 产品 Agent：判断是否值得改，写清楚用户路径、预期收益和不改的代价。
3. 工程 Agent：只处理通过判断的候选项，做最小可验证改动。
4. 验收 Agent：跑真实用户路径、静态资源路径、并发保存、导入导出和反馈路径。
5. 发布 Agent：只有在验证通过后发布，并记录版本与原因。

## 安全边界

反馈可以自动进入分析和任务队列，但不能让任意用户反馈直接改生产站点。自动发布必须满足：

- 变更范围清楚；
- 有可执行验收标准；
- 本地测试通过；
- 正式站点 loop 通过；
- 记录到共享记忆。

## 每日发布验收

每次自动发布前必须通过：

- `npm run lint`
- `npm test`
- `npm run build`
- `npm run verify:layout`
- `OKR_SITE_URL=https://okr-weekly-workbench.leodong.chatgpt.site npm run verify:loop`

涉及页面体验时，还必须验证 `/`、`/legacy/tracker.html`、`/progress` 和 `/feedback` 的真实线上路径。`/progress` 这类横向鱼骨图必须额外确认：月度区域可横向滑动、卡片不会挤压右侧信息、长文本能换行、不出现重叠。
