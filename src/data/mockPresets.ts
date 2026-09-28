import { IngestItem, NamingOption } from '../types';

export const APP_NAMING_PROPOSALS: NamingOption[] = [
  {
    chineseName: '记言 Todo',
    englishName: 'VoxFlow',
    tagline: '言入心，行成事。智能通话与即时沟通的全能转化中枢。',
    vibe: '贴切干练，直接传递“言语记录”与“待办执行”的核心心智',
    recommendedRole: '主推正式名：易记、直达核心、适合上架安卓应用商店',
  },
  {
    chineseName: '声言智记',
    englishName: 'VoxLog',
    tagline: '原声留存，智汇成章。端侧大模型赋能的高效笔记。',
    vibe: '侧重声音与知识库沉淀，强调学术与深度笔记质感',
    recommendedRole: '偏重知识管理与 Obsidian 深度用户喜爱的品牌风格',
  },
  {
    chineseName: '语脉 Todo',
    englishName: 'PulseMemo',
    tagline: '抓取沟通脉络，理清事务要义。',
    vibe: '温润智能，体现从碎语中抽丝剥茧的脉络感',
    recommendedRole: '适合强调跨平台（微信/短信/通话）整合的商务人士',
  },
  {
    chineseName: '言枢',
    englishName: 'EchoPivot',
    tagline: '言语为枢，行止有度。将散落碎语化为核心生产力。',
    vibe: '极简极客，极具系统级中枢应用氛围',
    recommendedRole: '适合极客、开源生态与端侧离线 AI 拥趸',
  },
];

export const INITIAL_INGEST_ITEMS: IngestItem[] = [
  {
    id: 'ingest-phone-1',
    channel: 'phone',
    sender: 'Alex Davies (Silico Valley Partner)',
    senderPhone: '+1 (415) 882-9013',
    timestamp: '今天 10:24',
    language: 'en',
    isEnglishCall: true,
    audioDuration: '04:18',
    status: 'processed',
    summary: '讨论 Q3 核心交付物延期补偿方案，要求下周二前发送修正版 SLA 协议与发票凭证。',
    todosCount: 2,
    rawContent: `[00:15] Alex: Hey there! Thanks for taking my call on short notice. Regarding the API integration milestone, our engineering director asked if we could expedite the staging environment review.
[01:02] Me: Hello Alex! Yes, we have completed the core auth and webhooks.
[01:30] Alex: That's great! One critical request: please send us the revised SLA contract document and updated invoice before next Tuesday 5 PM PST. We need it for finance approval.
[02:45] Me: Absolutely, I will have our legal team double-check the clauses and submit it by Monday.
[03:20] Alex: Perfect. Also, could you schedule a 30-minute sync with our tech lead Marcus on Thursday morning?
[04:00] Me: Got it! Adding both items to my Todo immediately. Talk soon!`,
    extractedTodos: [
      {
        id: 'todo-p1-1',
        sourceId: 'ingest-phone-1',
        title: '向 Alex 发送修订版 SLA 服务协议与更新后发票 (财务审批用)',
        dueDate: '下周二 17:00 (PST)',
        priority: 'high',
        completed: false,
        channel: 'phone',
        sender: 'Alex Davies',
        tags: ['跨国合作', 'SLA协议', '财务发票'],
        createdAt: '今天 10:24',
      },
      {
        id: 'todo-p1-2',
        sourceId: 'ingest-phone-1',
        title: '预约与外方技术主管 Marcus 的 30 分钟联调对齐会议',
        dueDate: '本周四上午',
        priority: 'medium',
        completed: false,
        channel: 'phone',
        sender: 'Alex Davies',
        tags: ['会议预约', '技术对齐'],
        createdAt: '今天 10:24',
      },
    ],
    knowledgeNote: {
      id: 'kn-p1-1',
      sourceId: 'ingest-phone-1',
      title: '与硅谷伙伴 Alex 关于 API 交付与 SLA 协议修正通话',
      category: '商务合作 / 跨国项目',
      channel: 'phone',
      sender: 'Alex Davies',
      date: '2026-09-22',
      keyTakeaways: [
        'API 集成里程碑：认证层与 Webhooks 已就绪，外方急需预发环境测试接入。',
        '核心约束：财务审批必须在下周二下午 5 点（PST）前见到带有印章的 SLA 协议。',
        '后续技术接触点：Marcus 负责周四的整体联调。',
      ],
      tags: ['#商务/SilicoValley', '#待办/SLA', '#通话转写/英文', '#Gemma4提取'],
      rawSnippet: 'Alex: Please send us the revised SLA contract document and updated invoice before next Tuesday...',
      obsidianMarkdown: `---
title: "与硅谷伙伴 Alex 关于 API 交付与 SLA 协议修正通话"
date: 2026-09-22
source: "phone_call"
caller: "Alex Davies (+1 415-882-9013)"
language: "English (Real-time Translated)"
tags:
  - "#商务/SilicoValley"
  - "#待办/SLA"
  - "#通话转写/英文"
  - "#Gemma4提取"
status: "processed"
---

# 📞 通话纪要：与 Alex Davies (Silico Valley)

> **通话时长**: 04分18秒  
> **语言**: 英语 (双语实时转译)  
> **关联联系人**: [[联系人/Alex Davies]]  
> **关联合同**: [[项目/SilicoValley_API交付]]  

## 🎯 核心结论
- **进度确认**: API 核心集成与 Webhooks 回调已被双方技术负责人确认无阻碍。
- **财务审批阻塞点**: 对方 CFO 需要我们于 **下周二 17:00 PST** 前提交最终敲定的 [[SLA服务级别协议]] 及对账发票。

## ✅ 衍生待办事项
- [ ] #高优 **向 Alex 发送修订版 SLA 服务协议与更新后发票** 📅 2026-09-29 17:00
- [ ] #中优 **预约与技术主管 Marcus 的 30 分钟联调对齐会议** 📅 2026-09-24

## 🎙️ 重点双语对照
- *EN*: "Please send us the revised SLA contract document and updated invoice before next Tuesday 5 PM PST."
- *ZH*: "请在下周二下午5点前将修订后的SLA合同文件及更新的发票凭证发给我们，用于财务审批。"
`,
    },
  },
  {
    id: 'ingest-wechat-1',
    channel: 'wechat',
    sender: '研发协同群 · 架构推进委员会',
    timestamp: '今天 09:15',
    language: 'zh',
    status: 'processed',
    summary: '周会决议：本周三下午 18:00 冻结 API 接口并提交安全审计报告；请各端完成 Gemma 4 本地模型运行时测试。',
    todosCount: 2,
    rawContent: `【微信群消息记录】
[产品负责人-林峰 09:12] @全体成员 各位伙伴，昨晚复盘会议决议如下：
1. 本周三下午 18:00 准时冻结所有业务网关接口，请后端务必在明天中午前完成 Swagger 文档更新。
2. @移动端负责人 记言 Todo 安卓端需要完成本地 Gemma 4 离线 NPU 加速的推理延迟基准压测，周四晨会前给出数据报表。
3. 知识库模块与 Obsidian 本地目录双链解析已通过灰度测试，请设计同学同步更新 UI 规范切图。`,
    extractedTodos: [
      {
        id: 'todo-w1-1',
        sourceId: 'ingest-wechat-1',
        title: '完成安卓端本地 Gemma 4 离线 NPU 加速推理基准压测报告',
        dueDate: '本周四 09:30 晨会前',
        priority: 'high',
        completed: false,
        channel: 'wechat',
        sender: '产品负责人-林峰',
        tags: ['Gemma4', '安卓NPU', '压测基准'],
        createdAt: '今天 09:15',
      },
      {
        id: 'todo-w1-2',
        sourceId: 'ingest-wechat-1',
        title: '后端业务网关接口冻结前，复核 Obsidian 双链同步接口规范',
        dueDate: '本周三 18:00 前',
        priority: 'medium',
        completed: false,
        channel: 'wechat',
        sender: '研发协同群',
        tags: ['接口冻结', 'Obsidian双链'],
        createdAt: '今天 09:15',
      },
    ],
    knowledgeNote: {
      id: 'kn-w1-1',
      sourceId: 'ingest-wechat-1',
      title: '微信群研发决议：接口冻结规范与 Gemma 4 端侧适配里程碑',
      category: '项目研发 / 架构推进',
      channel: 'wechat',
      sender: '研发协同群',
      date: '2026-09-22',
      keyTakeaways: [
        '网关接口周三 18:00 准时代码冻结，严禁违规提交 hotfix。',
        'Gemma 4 端侧离线能力为应用核心卖点，需重点监控 FP16/INT4 在各机型上的启动与解析耗时。',
        'Obsidian 本地协同双向链结已验证通过，支持直接导出 `obsidian://` 协议深链。',
      ],
      tags: ['#项目/记言Todo', '#架构/Gemma4', '#工作流/Obsidian'],
      rawSnippet: '各位伙伴，昨晚复盘会议决议如下：1. 本周三下午 18:00 准时冻结所有业务网关接口...',
      obsidianMarkdown: `---
title: "微信群研发决议：接口冻结规范与 Gemma 4 端侧适配里程碑"
date: 2026-09-22
source: "wechat_group"
group: "研发协同群 · 架构推进委员会"
tags:
  - "#项目/记言Todo"
  - "#架构/Gemma4"
  - "#工作流/Obsidian"
status: "active"
---

# 🟢 微信群纪要：研发里程碑同步

> **发件群组**: [[项目组/架构推进委员会]]  
> **发起人**: 林峰 (产品负责人)  

## 📌 关键决议项
- **接口冻结**: [[里程碑/V1.2版本发布]] 阶段，周三 18:00 统一封版。
- **Gemma 4 性能标杆**: 必须确保中端骁龙与联发科芯片在 1.5 秒内完成 200 字对话文本的实体与待办抽离。

## ✅ 执行清单
- [ ] #高优 **完成安卓端本地 Gemma 4 离线 NPU 加速推理基准压测报告** 📅 2026-09-24
- [ ] #中优 **后端业务网关接口冻结前，复核 Obsidian 双链同步接口规范** 📅 2026-09-23 18:00
`,
    },
  },
  {
    id: 'ingest-sms-1',
    channel: 'sms',
    sender: '【招商银行】 / 【中国国际航空】',
    senderPhone: '95555 / 95583',
    timestamp: '今天 08:30',
    language: 'zh',
    status: 'processed',
    summary: '航班行程通知：CA1835 航班将于明日 07:45 起飞，需在今晚 20:00 前完成线上选座与行李额申报；信用卡账单待还款 ￥6,280.00。',
    todosCount: 2,
    rawContent: `【中国国航】尊敬的旅客：您预订的 9月23日 CA1835 北京首都-上海虹桥 航班，计划起飞时间 07:45。温馨提示：线上值机及选座通道已开放，请于今日 20:00 前完成电子登机牌办理。
【招商银行】您的信用卡9月账单已出，应还款额 RMB 6,280.00，最后还款日为 10月05日。可点击掌上生活APP一键还款。`,
    extractedTodos: [
      {
        id: 'todo-s1-1',
        sourceId: 'ingest-sms-1',
        title: '办理明日 CA1835 航班（北京首都-上海虹桥）线上值机与选座',
        dueDate: '今晚 20:00 前',
        priority: 'high',
        completed: false,
        channel: 'sms',
        sender: '中国国航 (95583)',
        tags: ['出行差旅', '国航值机'],
        createdAt: '今天 08:30',
      },
      {
        id: 'todo-s1-2',
        sourceId: 'ingest-sms-1',
        title: '偿还招商银行信用卡 9 月账单 (￥6,280.00)',
        dueDate: '10月05日 截止',
        priority: 'medium',
        completed: false,
        channel: 'sms',
        sender: '招商银行 (95555)',
        tags: ['财务账单', '信用卡还款'],
        createdAt: '今天 08:30',
      },
    ],
    knowledgeNote: {
      id: 'kn-s1-1',
      sourceId: 'ingest-sms-1',
      title: '差旅行程与银行账单提醒 (9月22日汇总)',
      category: '生活出行 / 财务管理',
      channel: 'sms',
      sender: '运营商与银行服务号',
      date: '2026-09-22',
      keyTakeaways: [
        '航班信息：9月23日 CA1835，起飞时间 07:45，北京首都 T3 航站楼。',
        '值机关键节点：今晚 20:00 前锁定安全出口或前排座位。',
        '信用卡周期：账单金额 ￥6,280.00，免息期至 10月05日。',
      ],
      tags: ['#出行/航班', '#财务/信用卡', '#短信提取'],
      rawSnippet: 'CA1835 北京首都-上海虹桥 计划起飞 07:45；招商银行账单 ￥6,280.00...',
      obsidianMarkdown: `---
title: "差旅行程与银行账单提醒 (9月22日汇总)"
date: 2026-09-22
source: "sms_carrier"
tags:
  - "#出行/航班"
  - "#财务/信用卡"
  - "#短信提取"
status: "logged"
---

# 💬 短信提取：行程与财务备忘

> **关联标签**: [[差旅/2026-09上海出差]] | [[财务/信用卡还款规划]]  

## ✈️ 行程明细
- **航班号**: CA1835 (国航)
- **行程**: 北京首都 (PEK) ✈️ 上海虹桥 (SHA)
- **起飞时间**: 2026-09-23 07:45

## 💳 财务账单
- **还款金额**: ￥6,280.00
- **截止日**: 2026-10-05

## ✅ 行动项
- [ ] #高优 **办理明日 CA1835 航班线上值机与选座** 📅 2026-09-22 20:00
- [ ] #中优 **偿还招商银行信用卡 9 月账单 (￥6,280.00)** 📅 2026-10-05
`,
    },
  },
];

export const DEMO_ENGLISH_CALL_LINES: Array<{
  speaker: 'Caller' | 'User';
  englishText: string;
  chineseText: string;
  timeOffset: number;
  hasActionItem?: boolean;
  actionItem?: string;
}> = [
  {
    speaker: 'Caller',
    englishText: "Hi there! This is Sarah Jenkins from London Global Logistics. Calling to follow up on the airfreight shipment.",
    chineseText: "你好！我是伦敦全球物流的莎拉·詹金斯，致电跟进关于空运货物的发运进展。",
    timeOffset: 0,
  },
  {
    speaker: 'User',
    englishText: "Hello Sarah, good afternoon! Glad you called. Has the customs clearance been completed?",
    chineseText: "你好莎拉，下午好！很高兴你的来电。海关清关手续完成了吗？",
    timeOffset: 4,
  },
  {
    speaker: 'Caller',
    englishText: "Yes! Customs cleared this morning. However, we urgently need your company's stamped commercial invoice by 4 PM today.",
    chineseText: "是的！今天早上海关已放行。不过，我们急需贵司在今天下午 4 点前提供加盖公章的商业发票。",
    timeOffset: 8,
    hasActionItem: true,
    actionItem: "在今天下午 4 点前向 Sarah 发送盖章商业发票",
  },
  {
    speaker: 'User',
    englishText: "Understood. I will notify our accounting department to stamp and PDF it right away.",
    chineseText: "收到。我马上通知我们财务部加盖印章并生成 PDF 发送。",
    timeOffset: 14,
  },
  {
    speaker: 'Caller',
    englishText: "Fantastic. Also, could you wire the customs duty deposit of two thousand eight hundred dollars before tomorrow noon?",
    chineseText: "太棒了。另外，能否在明天中午之前电汇 2800 美元的关税保证金？",
    timeOffset: 19,
    hasActionItem: true,
    actionItem: "在明天中午前安排电汇 2800 美元关税保证金",
  },
  {
    speaker: 'User',
    englishText: "Sure thing, our treasury will process the SWIFT wire first thing tomorrow morning. I'll email the slip.",
    chineseText: "没问题，我们资金部门明早第一时间就会办理 SWIFT 电汇，届时我会把水单发邮件给您。",
    timeOffset: 25,
  },
  {
    speaker: 'Caller',
    englishText: "Thank you so much! Looking forward to receiving the documents. Have a wonderful day!",
    chineseText: "非常感谢！期待收到文件。祝你今天过得愉快！",
    timeOffset: 31,
  },
];
