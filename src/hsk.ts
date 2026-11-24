/** Proper nouns in this speech — not marked as “hard.” */
export const PROPER_NOUNS = new Set([
  '张居信', '张学良', '杨虎城', '赵一荻',
  '西安', '北京', '台湾', '中国', '西安事变', '中华民族',
])

/**
 * Compact HSK 1–3 vocabulary (words and common single characters).
 * Used only as a rough “is this above HSK 3?” hint, not an official exam key.
 */
const HSK_13 = `
我 你 他 她 它 我们 你们 他们 大家 人 人们 人民 谁 这 那 哪 些 的 了 吗 呢 吧 啊
是 有 在 不 没 很 也 都 和 与 或 但 而且 因为 所以 如果 虽然 但是 然后 再 又 还 就 才 只
一 二 三 四 五 六 七 八 九 十 零 两 几 多 少 多少 些 个 位 本 次 年 月 日 天 号 岁 点 分
现在 今天 明天 昨天 早上 上午 中午 下午 晚上 时候 时间 小时 星期 周 去年 明年
去 来 到 回 进 出 上 下 里 外 前 后 左 右 边 这儿 那儿 哪里 从 向 往 离 对 给 为 跟
想 要 会 能 可以 应该 得 必须 请 让 叫 做 作 看 听 说 讲 谈 问 答 读 写 学 习 认识
知道 觉得 感觉 喜欢 爱 想 希望 怕 担心 高兴 快乐 开心 难过 生气 忙 累 好 坏 大 小
多 少 高 低 长 短 新 旧 热 冷 快 慢 早 晚 对 错 容易 难 重要 一样 真 假
吃 喝 睡 走 跑 坐 站 开 关 买 卖 用 拿 放 给 找 等 帮 送 带 玩 旅游 工作 学习 休息
开始 结束 告诉 介绍 欢迎 谢谢 对不起 没关系 再见 请 问
家 家里 父亲 母亲 爸爸 妈妈 哥哥 姐姐 弟弟 妹妹 孩子 儿子 女儿 先生 小姐 同学 老师 学生 朋友 医生
学校 课 教室 书 本子 笔 字 汉语 中文 英文 名字 问题 事情 工作 公司 钱 票 衣服 水 茶 咖啡 饭 菜 水果
苹果 米饭 面条 鸡蛋 牛奶 面包 鱼 肉 菜
国家 城市 北京 上海 中国 美国 人 世界 地方 路 车站 飞机 火车 车 出租车 公共汽车 地铁 自行车
天 天气 晴 雨 风 雪 冷 热 春 夏 秋 冬
身体 头 眼睛 口 手 脚 病 医院 药
颜色 红 黄 绿 蓝 白 黑
东西 桌子 椅子 电脑 手机 电视 门 窗 房间 床 商店 饭馆 银行 邮局 公园 电影院
一 一起 一下 一点 一些 第一 每 各 别的 其他 自己 别人
已经 正在 刚 刚才 常常 经常 总是 还是 或者 还 更 最 比较 非常 太 真 特别
怎么 怎样 为什么 什么 哪 哪里 谁 几 多少
年 去年 以后 以前 的时候 以前 后来 然后 先 后
说话 谈话 故事 话 意思 方法 办法 办法 问题 主意
高兴 快乐 忙 累 饿 渴 饱 舒服
帮助 关心 照顾 参加 运动 跑步 游泳 唱 歌 跳舞 音乐 电影 电视
买 便宜 贵 钱 块 元
东 西 南 北 中 中间 旁边 附近 远 近
开 关 门 灯
天气 温度
去年 今年 明年 每天 有时候
认为 以为 明白 懂 记得 忘记 决定 选择 准备 计划 需要 希望
同意 认为 可能 一定 当然 也许
变化 发展 提高 增加 减少 开始 继续 完成 结束 成功 失败
历史 文化 新闻 报纸 节目 杂志
社会 政府 经济 教育 科学 技术 环境 健康
简单 复杂 清楚 认真 努力 重要 特别 一般 一样 不同
为了 关于 经过 通过 根据 除了 如果 虽然 但是 不但 而且 因为 所以 于是 因此
原来 其实 当然 突然 马上 立刻 一边 一起 一直 总是 经常
得到 离开 回来 过来 过去 上去 下来 出来 进去 出来
见面 结婚 生日 礼物 节日 春节
永远 后来 当时 最近 将来
相信 了解 发现 注意 检查 解决 改变
请 让 被 把 对 向 跟 给 比
没有 不是 不要 不用 不能
平 安 和 平 安全
希望 愿
谢谢 请 对不起
看 看见 看起来
听 听说
说 说话
讲 讲话
住 生活
工作 工人
上学 毕业
电话 电子邮件
口 手 心 里
自己 别人 大家
这样 那样 怎么
时候 时间
地方
事情 问题
朋友
名字
国家
世界
人民
去年
以后
以前
开始
已经
还是
或者
还
更
最
非常
真
太
一起
一直
常常
每
各
次
遍
一些
有的
所有
别
其他
自己
先
再
就
才
只
都
也
还
再
又
`.trim().split(/\s+/).filter(Boolean)

export const HSK_1_3 = new Set(HSK_13)

export interface HardToken {
  text: string
  start: number
  end: number
  hard: boolean
  meaning?: string
}

/** Short English glosses for harder words that appear in this speech or its simpler options. */
export const HARD_MEANINGS: Record<string, string> = {
  事情: 'matter / affair',
  记住: 'to remember',
  一点: 'a bit',
  那么: 'so / that much',
  不能: 'cannot / must not',
  忘记: 'to forget',
  从来: 'never / always (with 没有: never)',
  明白: 'to understand',
  爱国将领: 'patriotic general',
  爱国: "patriotic / to love one's country",
  将领: 'a general / military commander',
  问心无愧: 'to have a clear conscience',
  怨恨: 'bitterness / resentment',
  尊敬: 'respected / to honor',
  各位: 'everyone here (formal)',
  领导: 'leaders',
  来宾: 'guests (formal)',
  将军: 'general',
  孙子: 'grandson',
  感谢: 'to thank (formal)',
  主办方: 'the organizers / hosts',
  邀请: 'to invite',
  来到: 'to arrive at',
  祖父: 'grandfather (formal)',
  祖母: 'grandmother (formal)',
  奶奶: 'grandma',
  为了: 'in order to',
  停止: 'to stop',
  内战: 'civil war',
  一致: 'as one / in unison',
  抗日: 'resist Japan',
  发动: 'to launch',
  事变: 'incident (historical)',
  此后: 'after that (formal)',
  后来: 'later',
  失去: 'to lose',
  自由: 'freedom',
  一直: 'all along / always',
  陪: 'to accompany',
  身边: 'by one’s side',
  看望: 'to visit (formal)',
  感受: 'to feel / sense',
  感到: 'to feel',
  深爱: 'to love deeply',
  同胞: 'compatriots',
  受苦: 'to suffer',
  心痛: 'heartache / deeply pained',
  难过: 'sad',
  原则: 'principle',
  道理: 'way / principle (simple)',
  做人: 'how one lives / conducts oneself',
  历史: 'history',
  下一代: 'the next generation',
  愿: 'may (a wish)',
  希望: 'to hope',
  团结: 'unity / to unite',
  和平: 'peace',
  繁荣: 'prosperity',
  富强: 'prosperous and strong',
  中华民族: 'the Chinese nation',
  主办: 'to host',
}

function isHan(ch: string): boolean {
  return /[\u4e00-\u9fff]/.test(ch)
}

/** Greedy longest-match segmentation, then tag tokens not in HSK 1–3 (except names). */
export function markHardWords(chinese: string): HardToken[] {
  const tokens: HardToken[] = []
  let i = 0
  while (i < chinese.length) {
    const ch = chinese[i]
    if (!isHan(ch)) {
      let j = i + 1
      while (j < chinese.length && !isHan(chinese[j])) j += 1
      tokens.push({ text: chinese.slice(i, j), start: i, end: j, hard: false })
      i = j
      continue
    }
    let matched = ch
    let end = i + 1
    const max = Math.min(chinese.length, i + 6)
    // Prefer multi-syllable set phrases (问心无愧, 爱国将领) over splitting into HSK characters.
    for (let j = max; j > i + 2; j--) {
      const slice = chinese.slice(i, j)
      if (HARD_MEANINGS[slice] || PROPER_NOUNS.has(slice)) {
        matched = slice
        end = j
        break
      }
    }
    if (end === i + 1) {
      for (let j = max; j > i; j--) {
        const slice = chinese.slice(i, j)
        if (PROPER_NOUNS.has(slice) || HSK_1_3.has(slice)) {
          matched = slice
          end = j
          break
        }
      }
    }
    // If this character is not itself HSK/name, try a longer hard-word or name.
    if (matched.length === 1 && !HSK_1_3.has(matched) && !PROPER_NOUNS.has(matched)) {
      for (let j = Math.min(chinese.length, i + 6); j > i + 1; j--) {
        const slice = chinese.slice(i, j)
        if (HARD_MEANINGS[slice] || PROPER_NOUNS.has(slice)) {
          matched = slice
          end = j
          break
        }
      }
    }
    const hard = !PROPER_NOUNS.has(matched) && !HSK_1_3.has(matched)
    tokens.push({
      text: matched,
      start: i,
      end,
      hard,
      meaning: hard ? HARD_MEANINGS[matched] : undefined,
    })
    i = end
  }
  return tokens
}
