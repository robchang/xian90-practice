export interface SimplerOption {
  chinese: string
  english: string
}

/** 1–2 simpler options for each original line. Creed, names, and the core historical claim are preserved. */
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
    { chinese: '他常给我讲故事。', english: 'He often told me stories.' },
    { chinese: '他给我讲了很多故事。', english: 'He told me many stories.' },
  ],
  9: [
    { chinese: '从这些故事里，我知道他很爱中国，也很爱中国人民。', english: 'From these stories, I know he loved China very much, and also loved the Chinese people very much.' },
    { chinese: '这些故事让我感到，他很爱中国和中国人民。', english: 'These stories made me feel that he loved China and the Chinese people very much.' },
  ],
  10: [
    { chinese: '看到同胞受苦，他很难过。', english: 'Seeing his compatriots suffer, he was very sad.' },
    { chinese: '看到中国人受苦，他很难过。', english: 'Seeing Chinese people suffer, he was very sad.' },
  ],
  11: [
    { chinese: '他想的不是自己，是同胞。', english: 'What he thought of was not himself, but his compatriots.' },
    { chinese: '他心里先想的是同胞，不是自己。', english: 'In his heart he thought first of his compatriots, not of himself.' },
  ],
  12: [
    { chinese: '祖父做人的道理是："不怕死，不爱钱。"', english: 'My grandfather’s way of living was: “Not afraid of death, not loving money.”' },
    { chinese: '祖父常说，他做人的原则是："不怕死，不爱钱。"', english: 'Grandfather often said his principle was: “Not afraid of death, not loving money.”' },
  ],
  13: [
    { chinese: '我会把这段历史告诉年轻人。', english: 'I will tell this history to young people.' },
    { chinese: '我会把这段历史告诉下一代。', english: 'I will tell this history to the next generation.' },
  ],
  14: [
    { chinese: '希望中华民族团结、和平、繁荣！谢谢大家！', english: 'I hope the Chinese nation will be united, peaceful, and prosperous! Thank you all!' },
    { chinese: '愿中华民族团结、和平、繁荣！谢谢！', english: 'May the Chinese nation be united, peaceful, and prosperous! Thank you!' },
  ],
}

export const CREED = '不怕死，不爱钱'
export const PROTECTED_NAMES = ['张居信', '张学良', '杨虎城', '赵一荻'] as const
