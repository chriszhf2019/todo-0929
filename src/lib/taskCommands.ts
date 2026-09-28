export type TaskAction =
  | 'back'
  | 'home'
  | 'recents'
  | 'scrollUp'
  | 'scrollDown'
  | 'tap'
  | 'openApp'
  | 'findAndTap'
  | 'typeText'
  | 'wait'
  | 'scrollUntilText'
  | 'dial'
  | 'sendSms';

export interface TaskStep {
  action: TaskAction;
  x?: number;
  y?: number;
  packageName?: string;
  target?: string;
  delayMs?: number;
}

export interface TaskExecutionResult {
  success: boolean;
  failedIndex?: number;
  failedStep?: TaskStep;
}

export type PerformAction = (
  action: string,
  options?: { x?: number; y?: number; packageName?: string; target?: string; delayMs?: number }
) => Promise<boolean>;

export const APP_PACKAGES: Record<string, string> = {
  // 高频 / 系统
  电话: 'com.google.android.dialer',
  短信: 'com.google.android.apps.messaging',
  信息: 'com.google.android.apps.messaging',
  设置: 'com.android.settings',
  相机: 'com.google.android.GoogleCamera',
  浏览器: 'com.android.chrome',
  图库: 'com.google.android.apps.photos',
  相册: 'com.google.android.apps.photos',
  // 社交 / 通讯
  微信: 'com.tencent.mm',
  qq: 'com.tencent.mobileqq',
  飞书: 'com.ss.android.lark',
  钉钉: 'com.alibaba.android.rimet',
  telegram: 'org.telegram.messenger',
  whatsapp: 'com.whatsapp',
  推特: 'com.twitter.android',
  小红书: 'com.xingin.xhs',
  抖音: 'com.ss.android.ugc.aweme',
  哔哩哔哩: 'tv.danmaku.bilibilihd',
  // 生活 / 出行
  大众点评: 'com.dianping.v1',
  点评: 'com.dianping.v1',
  淘宝: 'com.taobao.taobao',
  美团: 'com.sankuai.meituan',
  高德: 'com.autonavi.minimap',
  高德地图: 'com.autonavi.minimap',
  百度地图: 'com.baidu.BaiduMap',
  // AI / 效率
  deepseek: 'com.deepseek.chat',
  claude: 'com.anthropic.claude',
  chatgpt: 'com.openai.chatgpt',
  obsidian: 'md.obsidian',
};

export const CHANNEL_PACKAGES: Record<'phone' | 'sms' | 'wechat', string> = {
  phone: 'com.google.android.dialer',
  sms: 'com.google.android.apps.messaging',
  wechat: 'com.tencent.mm',
};

export const ACTION_LABELS: Record<TaskAction, string> = {
  back: '返回',
  home: '桌面',
  recents: '最近任务',
  scrollUp: '上滑',
  scrollDown: '下滑',
  openApp: '打开应用',
  tap: '点击坐标',
  findAndTap: '点击界面文字',
  typeText: '输入文字',
  wait: '等待',
  scrollUntilText: '滚动查找文字',
  dial: '拨号',
  sendSms: '发短信',
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const normalize = (value: string) => value.trim().toLowerCase();

const isKnownPackage = (text: string): TaskStep | null => {
  for (const [label, packageName] of Object.entries(APP_PACKAGES)) {
    if (text.includes(label.toLowerCase())) {
      return { action: 'openApp', packageName };
    }
  }
  return null;
};

export const parseSingleCommand = (raw: string): TaskStep | null => {
  const text = normalize(raw);
  if (!text) return null;

  if (/返回|后退|back/.test(text)) return { action: 'back' };
  if (/桌面|主页|home|回到桌面/.test(text)) return { action: 'home' };
  if (/最近|多任务|recents|任务列表/.test(text)) return { action: 'recents' };
  if (/向上|上滑|scroll\s*up/.test(text)) return { action: 'scrollUp' };
  if (/向下|下滑|scroll\s*down/.test(text)) return { action: 'scrollDown' };

  const tapMatch = text.match(/(?:点击|tap|click)\s*\(?\s*(\d+)\s*[,，\s]\s*(\d+)/);
  if (tapMatch) {
    return { action: 'tap', x: Number(tapMatch[1]), y: Number(tapMatch[2]) };
  }

  const waitMatch = text.match(/(?:等待?|wait)\s*(\d+(?:\.\d+)?)\s*(秒|s|ms|毫秒)?/);
  if (waitMatch) {
    const value = Number(waitMatch[1]);
    const unit = waitMatch[2];
    const delayMs = unit === '毫秒' || unit === 'ms' ? value : value * 1000;
    return { action: 'wait', delayMs: Math.round(delayMs) };
  }

  const scrollMatch = text.match(/(?:滚动到|滑到|滚动直到|scroll\s*until)\s*(.+)$/);
  if (scrollMatch) {
    return { action: 'scrollUntilText', target: scrollMatch[1].trim() };
  }

  const typeMatch = text.match(/^(?:输入|填写|键入|type)\s*(.+)$/);
  if (typeMatch) {
    return { action: 'typeText', target: typeMatch[1].trim() };
  }

  const findMatch = text.match(/(?:点击|点|tap|click)\s*[“”"']?(.+?)[””"']?\s*$/);
  if (findMatch) {
    const target = findMatch[1].trim().replace(/^(文字|按钮|选项|链接)\s*/g, '');
    if (target) return { action: 'findAndTap', target };
  }

  // 拨号 / 发短信（Intent 类动作，放在 openApp 之前，避免「短信」被误判成打开短信应用）
  const dialMatch = text.match(/(?:拨号|拨打|打电话给|dial|call)\s*([\d+#*]+)/);
  if (dialMatch) {
    return { action: 'dial', target: dialMatch[1] };
  }

  const smsMatch = text.match(/(?:发短信给|发短信|短信给|send\s*sms|text)\s*([\d+#*]+)/);
  if (smsMatch) {
    return { action: 'sendSms', target: smsMatch[1] };
  }

  const knownPackage = isKnownPackage(text);
  if (knownPackage) return knownPackage;

  const openMatch = text.match(/^(?:打开|启动|open)\s*(.+)$/);
  if (openMatch) return null;

  return null;
};

export const parseTask = (raw: string): TaskStep[] => {
  const parts = raw
    .split(/(?:然后|接着|再|；|;|\n)/)
    .map((part) => part.trim())
    .filter(Boolean);

  const steps: TaskStep[] = [];
  for (const part of parts) {
    const step = parseSingleCommand(part);
    if (step) steps.push(step);
  }
  return steps;
};

const delayBeforeStep = (previous: TaskStep, next: TaskStep): number => {
  if (previous.action === 'openApp') return 1200;
  if (next.action === 'typeText') return 900;
  return 800;
};

export const executeTaskSteps = async (
  steps: TaskStep[],
  performAction: PerformAction,
  onStep?: (index: number, step: TaskStep, success: boolean) => void
): Promise<TaskExecutionResult> => {
  const retryable = new Set<TaskAction>(['findAndTap', 'typeText']);

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    if (index > 0) {
      await sleep(delayBeforeStep(steps[index - 1], step));
    }

    const attempts = retryable.has(step.action) ? 3 : 1;
    let success = false;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (attempt > 0) await sleep(700);
      success = await performAction(step.action, {
        x: step.x,
        y: step.y,
        packageName: step.packageName,
        target: step.target,
        delayMs: step.delayMs,
      });
      if (success) break;
    }

    onStep?.(index, step, success);
    if (!success) {
      return { success: false, failedIndex: index, failedStep: step };
    }
  }

  return { success: true };
};

interface TodoLike {
  title: string;
  channel?: string;
  sender?: string;
  senderPhone?: string;
  sourcePackage?: string;
}

const isGenericSender = (sender?: string) =>
  !sender ||
  /^(原始消息|手动快捷添加|系统|屏幕对话|微信当前|未知)/.test(sender);

const messagingSearchSteps = (packageName: string, contact: string, body: string): TaskStep[] => {
  const steps: TaskStep[] = [
    { action: 'openApp', packageName },
    { action: 'findAndTap', target: '搜索' },
    { action: 'typeText', target: contact },
    { action: 'findAndTap', target: contact },
  ];
  if (body && body !== contact) steps.push({ action: 'typeText', target: body });
  return steps;
};

/**
 * Builds a conservative starter task from a todo. Messaging apps are opened and
 * the conversation is prepared in the draft; sending is intentionally left to
 * the user so no message goes out without a final look.
 */
export const buildTodoTask = (todo: TodoLike): TaskStep[] => {
  const channel = (todo.channel || '') as keyof typeof CHANNEL_PACKAGES;
  const packageName = todo.sourcePackage || CHANNEL_PACKAGES[channel];
  const title = todo.title.trim();
  const contact = isGenericSender(todo.sender) ? '' : (todo.sender || '').trim();
  const number = (todo.senderPhone || '').replace(/\s/g, '');
  const body = title
    .replace(/^(给|回复|联系|提醒|通知)\s*/, '')
    .replace(/^[:：,，\s]+/, '')
    .trim();

  const explicitSteps = parseTask(title);
  if (explicitSteps.length > 0) {
    if (!packageName || explicitSteps[0].action === 'openApp') return explicitSteps;
    return [{ action: 'openApp', packageName }, ...explicitSteps];
  }

  if (!packageName) return [];

  const usesChatSearch =
    channel === 'wechat' ||
    /tencent\.mm|mobileqq|wework|lark|telegram|whatsapp|rimet/.test(packageName);

  if (usesChatSearch && contact) {
    return messagingSearchSteps(packageName, contact, body);
  }

  if (channel === 'sms') {
    if (number) {
      const steps: TaskStep[] = [{ action: 'sendSms', target: number }];
      if (body) steps.push({ action: 'typeText', target: body });
      return steps;
    }
    if (contact) return messagingSearchSteps(packageName, contact, body);
  }

  if (channel === 'phone' && number) {
    return [{ action: 'dial', target: number }];
  }

  return [{ action: 'openApp', packageName }];
};

export interface DiningPreferences {
  people: string;
  cuisine: string;
  budget: string;
  location: string;
}

export const DEFAULT_DINING_PREFERENCES: DiningPreferences = {
  people: '2',
  cuisine: '不限',
  budget: '不限',
  location: '附近',
};

export const isRestaurantTodo = (title: string) =>
  /聚餐|聚会|吃饭|订餐|餐厅|团建|请客|大众点评/.test(title);

export const buildDiningPlan = (
  preferences: DiningPreferences,
  todo: TodoLike
): TaskStep[] => {
  const extra = todo.title
    .replace(/聚餐|聚会|吃饭|订餐|餐厅|团建|请客|大众点评/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const query = [
    preferences.location !== '不限' ? preferences.location : '',
    preferences.cuisine !== '不限' ? preferences.cuisine : '',
    preferences.budget !== '不限' ? preferences.budget : '',
    preferences.people ? `${preferences.people}人` : '',
    extra,
    '聚餐',
  ]
    .filter(Boolean)
    .join(' ');

  return [
    { action: 'openApp', packageName: 'com.dianping.v1' },
    { action: 'findAndTap', target: '搜索' },
    { action: 'typeText', target: query },
    { action: 'wait', delayMs: 1400 },
    { action: 'findAndTap', target: '搜索' },
    { action: 'wait', delayMs: 1400 },
  ];
};
