import type { CommunityMember, CommunityStory, StoryComment } from "../types";

/**
 * 社区 / 朋友 / 留言 mock(2026-08-29)
 * 纯前端占位数据:Community 信息流、Friends 列表、故事评论都来自这里。
 * 后端就绪后只换数据源(F5Spaces / StoryDetail 的 props 结构不变),勿在组件里写死数据。
 */

export const COMMUNITY_MEMBERS: CommunityMember[] = [
  { id: "m-annie", name: "阿棉", characterId: "mira", bio: "在练习把话说完", isFriend: true },
  { id: "m-renn", name: "任任", characterId: "renn", bio: "收集黄昏的人", isFriend: false },
  { id: "m-tola", name: "老托", characterId: "tola", bio: "慢慢来,比较快", isFriend: true },
  { id: "m-sena", name: "小森", characterId: "sena", bio: "今天也在路边捡故事", isFriend: false },
  { id: "m-ivo", name: "一沃", characterId: "ivo", bio: "观察,然后记下来", isFriend: false },
  { id: "m-pico", name: "皮师傅", characterId: "pico", bio: "守着一间小房间", isFriend: true },
];

/** 朋友的留言 / 路过的人的留言,挂在社区故事下 */
const c = (
  id: string,
  authorName: string,
  authorCharacterId: StoryComment["authorCharacterId"],
  relation: StoryComment["relation"],
  text: string,
  date: string
): StoryComment => ({ id, authorName, authorCharacterId, relation, text, date });

export const COMMUNITY_STORIES: CommunityStory[] = [
  {
    id: "cs-1",
    ownerId: "m-annie",
    title: "把辞职信删掉了",
    date: "2026年8月25日",
    cover: "sage",
    excerpt: "写好了辞职信,存在草稿箱里三天。今天把它删了,不是不敢走,是想清楚了自己要去哪。",
    transcript:
      "写好了辞职信,存在草稿箱里三天。每天上班路上都看一遍。今天把它删了。不是不敢走,是忽然想清楚了一件事:我不是想逃离这里,我是想去一个地方。想明白这个之后,心就静了。",
    comments: [
      c("cm-1", "老托", "tola", "friend", "删得好。想清楚再走,比逃走强一百倍。", "8月26日"),
      c("cm-2", "皮师傅", "pico", "friend", "等你找好了,来我房间讲讲。", "8月26日"),
      c("cm-3", "路过的人", "ivo", "visitor", "「不是想逃离,是想去一个地方」——这句真好。", "8月27日"),
    ],
  },
  {
    id: "cs-2",
    ownerId: "m-annie",
    title: "雨天的公交站",
    date: "2026年8月18日",
    cover: "lavender",
    excerpt: "下大雨,没伞。旁边有个阿姨往我这边挪了挪,把伞分了我一半。",
    transcript:
      "下大雨,我没带伞,在公交站干等。旁边有个阿姨什么也没说,往我这边挪了挪,把伞分了我一半。车来了她先上的车,我都没来得及说谢谢。记在这里,怕忘了。",
    comments: [c("cm-4", "老托", "tola", "friend", "不会忘的,写下来就不会忘了。", "8月19日")],
  },
  {
    id: "cs-3",
    ownerId: "m-renn",
    title: "追上了那场日落",
    date: "2026年8月22日",
    cover: "blush",
    excerpt: "骑车追了二十分钟,总算在桥上追上了今天的日落。气喘如牛,值了。",
    transcript:
      "看到云烧起来就冲出门骑车,追了二十分钟,总算在桥上追上了今天的日落。扶着车把气喘如牛。旁边钓鱼的大爷看了我一眼,说:天天都有,急什么。我说:今天的好看。",
    comments: [
      c("cm-5", "小森", "sena", "visitor", "「今天的好看」!我懂!", "8月22日"),
      c("cm-6", "阿棉", "mira", "visitor", "大爷也没说错,你也没说错。", "8月23日"),
    ],
  },
  {
    id: "cs-4",
    ownerId: "m-tola",
    title: "给爸修好了收音机",
    date: "2026年8月20日",
    cover: "sage",
    excerpt: "其实没什么毛病,就是接触不良。但他看我的眼神,像我修好了全世界。",
    transcript:
      "爸的老收音机不响了,让我看看。其实没什么大毛病,就是电池仓接触不良,拿橡皮擦了擦就好了。但他看我的那个眼神,像我修好了全世界。他抱着收音机听了一下午戏。",
    comments: [
      c("cm-7", "阿棉", "mira", "friend", "橡皮擦修好的不是收音机。", "8月21日"),
      c("cm-8", "皮师傅", "pico", "friend", "看得眼眶热热的。", "8月21日"),
    ],
  },
  {
    id: "cs-5",
    ownerId: "m-sena",
    title: "路边的猫认识我了",
    date: "2026年8月24日",
    cover: "lavender",
    excerpt: "连续投喂第十四天,它今天主动走过来,用头蹭了蹭我的裤脚。",
    transcript:
      "连续投喂第十四天。之前它都是等我走远才出来吃,今天主动走过来了,用头蹭了蹭我的裤脚。我蹲在那儿一动不敢动,像通过了什么重要的面试。",
    comments: [c("cm-9", "任任", "renn", "visitor", "恭喜通过面试,面试官很严格。", "8月24日")],
  },
  {
    id: "cs-6",
    ownerId: "m-ivo",
    title: "观察日记:广场舞",
    date: "2026年8月15日",
    cover: "blush",
    excerpt: "楼下广场舞队伍里有个总慢半拍的爷爷,但他笑得最开心。",
    transcript:
      "观察楼下广场舞第三十天。队伍里有个总是慢半拍的爷爷,动作从来没对过,但他笑得最开心。今天领队阿姨把他调到了第一排。我想,慢一点的人也有自己的位置。",
    comments: [c("cm-10", "老托", "tola", "visitor", "慢一点的人也有自己的位置。记下了。", "8月16日")],
  },
  {
    id: "cs-7",
    ownerId: "m-pico",
    title: "房间亮着灯",
    date: "2026年8月27日",
    cover: "sage",
    excerpt: "没什么大事。就是今晚把房间收拾干净了,灯开着,等人来坐坐。",
    transcript:
      "今天没什么大事。就是把房间收拾了一遍,换了新桌布,烧了水。灯开着,门没锁。谁路过都可以进来坐坐。",
    comments: [
      c("cm-11", "阿棉", "mira", "friend", "这就来。", "8月27日"),
      c("cm-12", "小森", "sena", "visitor", "带点心来的那种路过。", "8月27日"),
    ],
  },
];

export const memberById = (id: string): CommunityMember =>
  COMMUNITY_MEMBERS.find((m) => m.id === id) ?? COMMUNITY_MEMBERS[0];

export const storiesByMember = (memberId: string): CommunityStory[] =>
  COMMUNITY_STORIES.filter((s) => s.ownerId === memberId);

export const communityStoryById = (id: string): CommunityStory | undefined =>
  COMMUNITY_STORIES.find((s) => s.id === id);

/** 自己的历史故事下的留言(种子故事的 mock;新 Keep 的故事默认无留言) */
export const OWN_STORY_COMMENTS: Record<string, StoryComment[]> = {
  "seed-1": [
    c("own-1", "阿棉", "mira", "friend", "两个人点头诶,这个开头已经很了不起了。", "2024年6月13日"),
    c("own-2", "路过的人", "sena", "visitor", "手抖着也把话说完的人,最厉害。", "2024年6月14日"),
  ],
  "seed-3": [
    c("own-3", "老托", "tola", "friend", "写下来就是第一步。明天要是不拨,也没关系。", "2026年8月22日"),
  ],
};
