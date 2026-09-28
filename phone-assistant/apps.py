# -*- coding: utf-8 -*-
"""
应用名 → 包名 映射（从设备 `pm list packages` 权威导出，2026-09-25）

包名来自真机查询，准确无误；中文名/别名是我标注的，可自行增改。
用法：打开 X 时，用「包含匹配」命中这里的 key。
"""

APP_MAP = {
    # ── 系统 / 高频 ──
    "设置": "com.android.settings",
    "电话": "com.google.android.dialer",
    "短信": "com.google.android.apps.messaging",
    "相机": "com.google.android.GoogleCamera",
    "浏览器": "com.android.chrome",
    "chrome": "com.android.chrome",
    "图库": "com.google.android.apps.photos",
    "相册": "com.google.android.apps.photos",
    "photos": "com.google.android.apps.photos",
    "gmail": "com.google.android.gm",
    "play商店": "com.android.vending",
    "应用商店": "com.android.vending",
    "时钟": "com.google.android.deskclock",
    "计算器": "com.google.android.calculator",
    "日历": "com.google.android.calendar",
    "文件": "com.google.android.apps.nbu.files",
    "通讯录": "com.google.android.contacts",
    "联系人": "com.google.android.contacts",

    # ── 社交 / 通讯 ──
    "微信": "com.tencent.mm",
    "wechat": "com.tencent.mm",
    "qq": "com.tencent.mobileqq",
    "飞书": "com.ss.android.lark",
    "lark": "com.ss.android.lark",
    "推特": "com.twitter.android",
    "twitter": "com.twitter.android",
    "instagram": "com.instagram.android",
    "linkedin": "com.linkedin.android",
    "reddit": "com.reddit.frontpage",
    "tiktok": "com.ss.android.ugc.trill",
    "抖音": "com.ss.android.ugc.aweme",
    "小红书": "com.xingin.xhs",
    "哔哩哔哩": "tv.danmaku.bilibilihd",
    "bilibili": "tv.danmaku.bilibilihd",
    "b站": "tv.danmaku.bilibilihd",
    "telegram": "org.telegram.messenger",

    # ── AI 助手 ──
    "claude": "com.anthropic.claude",
    "chatgpt": "com.openai.chatgpt",
    "deepseek": "com.deepseek.chat",
    "grok": "ai.x.grok",
    "gemini": "com.google.android.apps.bard",
    "perplexity": "ai.perplexity.app.android",
    "genspark": "ai.mainfunc.genspark",
    "qwen": "ai.qwenlm.chat.android",
    "通义": "ai.qwenlm.chat.android",
    "扣子": "com.coze.space",
    "coze": "com.coze.space",
    "stella": "com.facebook.stella",
    "edge gallery": "com.google.ai.edge.gallery",
    "agent space": "com.google.android.apps.agentspace",
    "proactive": "com.proactive.agent",
    "nova": "com.larus.nova",

    # ── 效率 / 笔记 ──
    "obsidian": "md.obsidian",
    "notion": "notion.id",
    "keep": "com.google.android.keep",
    "维基百科": "org.wikipedia",
    "wikipedia": "org.wikipedia",
    "github": "com.github.android",

    # ── 办公 ──
    "outlook": "com.microsoft.office.outlook",
    "excel": "com.microsoft.office.excel",
    "powerpoint": "com.microsoft.office.powerpoint",
    "office": "com.microsoft.office.officehubrow",
    "docs": "com.google.android.apps.docs.editors.docs",
    "课堂": "com.google.android.apps.classroom",
    "classroom": "com.google.android.apps.classroom",

    # ── 购物 / 生活 ──
    "淘宝": "com.taobao.taobao",
    "美团": "com.sankuai.meituan",
    "大众点评": "com.dianping.v1",
    "点评": "com.dianping.v1",
    "翻译": "com.google.android.apps.translate",
    "translate": "com.google.android.apps.translate",
    "keep": "com.google.android.keep",

    # ── 出行 ──
    "高德": "com.autonavi.minimap",
    "高德地图": "com.autonavi.minimap",
    "百度地图": "com.baidu.BaiduMap",
    "航旅纵横": "com.umetrip.android.msky.app",
    "中国国航": "com.rytong.airchina",
    "国航": "com.rytong.airchina",

    # ── 工具 / 其他 ──
    "百度网盘": "com.baidu.drive.app",
    "网盘": "com.baidu.drive.app",
    "记言": "com.voxflow.todo",
    "记言todo": "com.voxflow.todo",
    "voxflow": "com.voxflow.todo",
    "shizuku": "moe.shizuku.privileged.api",
    "clash": "com.github.metacubex.clash.meta",
    "uu远程": "com.netease.uuremote",
    "trae": "com.bytedance.trae.cn",
    "fitbit": "com.fitbit.FitbitMobile",
    "gopay": "com.gojek.gopay",
    "marvis": "com.tencent.android.marvis",
    "联想家庭存储": "com.lenovo.smartpan",
    "应用宝": "com.tencent.android.qqdownloader",
    "钱包": "com.google.android.apps.walletnfcrel",
    "google home": "com.google.android.apps.chromecast.app",
    "手表": "com.google.android.apps.wear.companion",
    "tailwind": "com.google.android.apps.labs.language.tailwind",
}
