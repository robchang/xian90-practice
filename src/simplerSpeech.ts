export interface SimplerOption {
  chinese: string
  english: string
}

/** 1–2 simpler options for each original line. Names, 问心无愧, and the core historical claim are preserved. */
export const SIMPLER_OPTIONS: Record<number, SimplerOption[]> = {
  1: [
    { chinese: '各位领导、各位朋友：大家好！', english: 'Leaders and friends: hello, everyone!' },
    { chinese: '大家好！各位领导，各位朋友！', english: 'Hello, everyone! Leaders, friends!' },
  ],
  2: [
    { chinese: '我叫张居信。我是张学良将军的孙子。', english: 'My name is Zhang Juxin. I am General Zhang Xueliang’s grandson.' },
    { chinese: '我叫张居信，张学良将军是我的祖父。', english: 'My name is Zhang Juxin. General Zhang Xueliang is my grandfather.' },
  ],
  3: [
    { chinese: '谢谢你们请我来北京。', english: 'Thank you for inviting me to Beijing.' },
    { chinese: '谢谢邀请我来北京。', english: 'Thank you for the invitation to Beijing.' },
  ],
  4: [
    {
      chinese: '九十年前，我的祖父和杨虎城将军发动了西安事变。他们想停止内战，一起抗日。',
      english: 'Ninety years ago, my grandfather and General Yang Hucheng launched the Xi’an Incident. They wanted to stop the civil war and resist Japan together.',
    },
    {
      chinese: '九十年前，祖父和杨虎城将军为了停止内战、一起抗日，发动了西安事变。',
      english: 'Ninety years ago, my grandfather and General Yang Hucheng launched the Xi’an Incident in order to stop the civil war and resist Japan together.',
    },
  ],
  5: [
    { chinese: '后来，他失去自由五十多年。', english: 'Later, he lost his freedom for more than fifty years.' },
    { chinese: '这以后，他没有自由五十多年。', english: 'After that, he did not have freedom for more than fifty years.' },
  ],
  6: [
    { chinese: '我的奶奶赵一荻，一直陪着他。', english: 'My grandmother Zhao Yidi stayed with him all along.' },
    { chinese: '祖母赵一荻一直陪在他身边。', english: 'Grandmother Zhao Yidi stayed by his side all along.' },
  ],
  7: [
    { chinese: '从一岁开始，我每年都去台湾看祖父。', english: 'From the age of one, I went to Taiwan every year to see my grandfather.' },
    { chinese: '我一岁以后，每年都去台湾看祖父。', english: 'After I turned one, I went to Taiwan every year to see my grandfather.' },
  ],
  8: [
    { chinese: '他失去了那么多，可是我从没看到他怨恨。', english: 'He had lost so much, but I never saw him bitter.' },
    { chinese: '他失去了很多，但我从来没看见他心里有恨。', english: 'He had lost a great deal, but I never saw hatred in his heart.' },
  ],
  9: [
    { chinese: '后来我懂了。祖父九十岁时说：做事情，要问心无愧。', english: 'Later I understood. At ninety, grandfather said: in whatever you do, keep a clear conscience.' },
    { chinese: '后来我明白了。祖父九十岁说过：做事要问心无愧。', english: 'Later I understood. At ninety, grandfather said: whatever you do, keep a clear conscience.' },
  ],
  10: [
    { chinese: '因为他想的不是自己，是国家和同胞。', english: 'Because what he thought of was not himself, but his country and his people.' },
    { chinese: '因为他心里先想的是国家和同胞，不是自己。', english: 'Because in his heart he thought first of his country and his people, not of himself.' },
  ],
  11: [
    { chinese: '我们不能忘记像他这样爱国的将军。', english: 'We must not forget a patriotic general like him.' },
    { chinese: '这样的爱国将领，我们不能忘记。', english: 'Patriotic generals like him, we must not forget.' },
  ],
  12: [
    { chinese: '也要让年轻人记住这段历史。', english: 'And we must let young people remember this history.' },
    { chinese: '我们还要让下一代记住这段历史。', english: 'We must also let the next generation remember this history.' },
  ],
  13: [
    { chinese: '希望中华民族团结、和平、繁荣！谢谢大家！', english: 'I hope the Chinese nation will be united, peaceful, and prosperous! Thank you all!' },
    { chinese: '愿中华民族团结、和平、繁荣！谢谢！', english: 'May the Chinese nation be united, peaceful, and prosperous! Thank you!' },
  ],
}

/** Key phrase that must not be rewritten away (line 9). */
export const CREED = '问心无愧'
export const PROTECTED_NAMES = ['张居信', '张学良', '杨虎城', '赵一荻'] as const
export const PROTECTED_PHRASES = [CREED] as const
