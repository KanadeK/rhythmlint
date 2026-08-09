# RhythmLint

**把日历当作可执行策略：导出 ICS，在本地审计一周的真实形状，再生成可复核的修复建议。**

[English](README.md) · [在线合成示例报告](https://kanadek.github.io/rhythmlint/) ·
[修改前后差异](https://kanadek.github.io/rhythmlint/demo-diff.html) · [规则说明](docs/RULES.md)

普通日历能显示时间冲突，但很少回答这些问题：一周是否真的留出了受保护的专注时间，
会议之间有没有转场，午休是否可用，会议总量是否越界，空闲时间是否被切成无法工作的碎片。
RhythmLint 读取 Google Calendar、Outlook 或 Apple Calendar 导出的 `.ics` 文件，不需要
OAuth、账号或上传。

它不是日历界面空壳，而是可运行的 CLI 和 TypeScript 引擎：展开 RFC 5545 重复事件，
应用例外事件，合并重复导出，执行九条稳定规则，对比修改前后，并且只在确实空闲的位置
生成 `TENTATIVE` 修复日历。

## 可复现的示例

仓库中的 `before.ics` 是一个完全合成的过载工作周：3 个错误、20 个警告、23 小时 50 分
会议、只有一个达标的受保护专注块。`after.ics` 把协作集中，并保留五个专注块。

| 指标           |        修改前 |       修改后 |           变化 |
| -------------- | ------------: | -----------: | -------------: |
| 分数           |         0/100 |      100/100 |           +100 |
| 错误           |             3 |            0 |             -3 |
| 警告           |            20 |            0 |            -20 |
| 会议时间       | 23 小时 50 分 | 9 小时 10 分 | -14 小时 40 分 |
| 受保护专注时间 |  2 小时 30 分 | 7 小时 30 分 |        +5 小时 |
| 碎片时间       |  9 小时 40 分 |        30 分 |  -9 小时 10 分 |

```bash
npm ci
npm run build
node dist/cli.js audit examples/before.ics \
  --config examples/rhythmlint.config.json --from 2026-08-03 --fail-on none
node dist/cli.js diff examples/before.ics examples/after.ics \
  --config examples/rhythmlint.config.json --from 2026-08-03 --fail-on none
```

## 安装

### GitHub Release 单文件包

从最新 Release 下载 `rhythmlint-0.1.0-standalone.mjs`。它已经打包运行时解析器，
只需要 Node.js 20 或更高版本：

```bash
node rhythmlint-0.1.0-standalone.mjs --version
node rhythmlint-0.1.0-standalone.mjs audit calendar.ics \
  --config rhythmlint.config.json --from 2026-08-03 --format html --out report.html
```

运行前请用 `SHA256SUMS.txt` 校验文件。v0.1.0 的正式分发渠道是 GitHub Release；仓库
不声称该版本已发布到 npm 注册表。

### 从源码运行

```bash
git clone https://github.com/KanadeK/rhythmlint.git
cd rhythmlint
npm ci
npm run check
node dist/cli.js --help
```

运行时和普通测试支持 Node 20+；强制覆盖率门需要 Node 22.8+，正式发布门使用 Node 24。

## 实际工作流

1. 从一个或多个日历导出 ICS。
2. 生成完整策略，修改前先阅读每个阈值：

   ```bash
   node dist/cli.js init --out rhythmlint.config.json
   ```

3. 审计固定窗口；公开分享时启用脱敏：

   ```bash
   node dist/cli.js audit work.ics personal.ics \
     --config rhythmlint.config.json --from 2026-08-03 --days 14 \
     --format html --out audit.html --redact --redact-locations
   ```

4. 只利用已有空闲位置生成候选专注/午休占位：

   ```bash
   node dist/cli.js overlay work.ics personal.ics \
     --config rhythmlint.config.json --from 2026-08-03 --days 14 \
     --out proposed-holds.ics
   ```

   返回码 `1` 表示文件已经生成，但剩余专注缺口必须靠移动会议解决。RhythmLint 不会为了
   报告变绿而生成冲突占位。

5. 再次导出修改后的日历并比较：

   ```bash
   node dist/cli.js diff before.ics after.ics \
     --config rhythmlint.config.json --from 2026-08-03 --days 14 \
     --format html --out calendar-diff.html
   ```

## 命令与返回码

| 命令                    | 真正执行的功能                                                |
| ----------------------- | ------------------------------------------------------------- |
| `audit <ics...>`        | 合并导出、展开重复事件、执行规则，输出终端/JSON/Markdown/HTML |
| `diff <before> <after>` | 使用相同窗口重新审计，输出指标变化以及已解决/新增 finding     |
| `overlay <ics...>`      | 只在确认空闲的时间生成确定性、可导入的候选占位 ICS            |
| `init`                  | 写入版本化 JSON 策略；除非 `--force`，否则不覆盖已有文件      |
| `rules`                 | 输出稳定规则 ID，便于 CI 和其他工具集成                       |

`--fail-on error|warning|none` 只控制返回码，不隐藏 finding。`--redact` 把标题替换为
稳定的本地标签，`--redact-locations` 删除报告中的地点。返回码 `0` 表示通过，`1` 表示
策略未通过或修复容量仍不足，`2` 表示参数、文件、配置或解析错误。

## 九条规则

| ID    | 检查内容                                   |
| ----- | ------------------------------------------ |
| RL001 | 活跃的定时事件重叠                         |
| RL002 | 连续事件之间没有足够转场时间               |
| RL003 | 单日会议时间超预算                         |
| RL004 | 一周会议时间超预算，部分周按工作日比例缩放 |
| RL005 | 连续会议区间过长                           |
| RL006 | 受保护专注块不足，部分周按工作日比例缩放   |
| RL007 | 短空档总量超过单日碎片预算                 |
| RL008 | 午休窗口里没有足够长的连续空档             |
| RL009 | 事件超出配置的工作时间                     |

精确的合并、裁剪、重复事件、严重性和修复语义见 [规则文档](docs/RULES.md)。

## 隐私与安全边界

- 没有网络客户端、OAuth、遥测、分析、远程字体、CDN 或上传接口。
- 只读取命令中指定的文件，只写入明确的输出路径或初始化路径。
- HTML 完全自包含、无脚本、转义用户数据，并设置限制性 CSP。
- 事件标题和地点本身可能敏感；私有本地报告默认保留标题，分享前请主动开启脱敏。
- 分数是公开、可解释的启发式指标，不是疲劳或职业倦怠的医学判断。
- 修复 ICS 中的事件是 `TENTATIVE`；工具不会修改原日历、拒绝邀请或通知参会人。

请在处理真实日历前阅读 [完整隐私说明](docs/PRIVACY.md)。

## 支持边界

RhythmLint 通过 `ical.js` 支持 VEVENT、UTC/浮动/TZID 时间、VTIMEZONE、RRULE、
RDATE、EXDATE 和 RECURRENCE-ID 例外。未知 TZID 会产生诊断并回退到配置时区。
取消、透明、标题忽略和全天事件仍保留作证据，但不计入定时负载。

单个重复系列最多展开 25,000 次，审计窗口最多 366 天，防止恶意或错误规则无限消耗资源。

## 验收与修复

- [验收命令](docs/ACCEPTANCE.md)：干净克隆、CLI、确定性、打包、校验和、线上发布。
- [失败修复流程](docs/REPAIR_GUIDE.md)：安装、解析、时区、测试、覆盖率、示例、CI、Pages、Release。
- [竞品扫描](docs/COMPETITOR_SCAN.md)：相邻项目、被否决的构思、搜索限制和诚实的差异化结论。

完整发布前自检：

```bash
npm run release:check
```

当前门禁包含 28 个测试，整体覆盖率为 95.34% 行、89.08% 分支、96.92% 函数，另有
字节级示例复现、静态隐私/密钥检查、单文件打包、npm tarball 和 SHA-256 清单。

RhythmLint 源码采用 MIT；单文件包包含 MPL-2.0 的 `ical.js` 2.2.1，详见
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
