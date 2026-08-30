import type { CommunityMember, CommunityStory, StoryComment } from "../types";

/**
 * 社区 / 朋友 / 留言 mock(2026-08-30 换真实素材版)
 * 社区 5 个故事来自 Downloads/归档(1)/故事5-9,纯前端占位数据;
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
    id: "cs-5",
    ownerId: "m-annie",
    title: "不再一味迁就",
    date: "2026年8月28日",
    cover: "/covers/com-5.png",
    video: "/videos/story-5.mp4",
    excerpt: "室友吵闹又不爱卫生,我一直习惯性忍让,越忍越委屈。回看相处细节才明白:是对方没有边界感,不是我过分。",
    transcript:
      "室友日常作息吵闹、不爱维护公共卫生,我一直习惯性忍让。每次闹完小矛盾,我还会自我怀疑是不是自己太小气、太矫情,越忍越委屈,反复内耗。但客观回看和讨论日常相处的所有细节,是对方没有边界感,不是我过分。想通之后不再自我否定,也知道之后要主动划清边界,不再一味迁就委屈自己。",
    comments: [
      c("cm-51", "欢欢", "sena", "friend", "真的别一味包容,树立自己的底线", "8月28日"),
      c("cm-52", "芙芙", "renn", "visitor", "学着优先顾及自己的感受,真的很重要", "8月29日"),
    ],
  },
  {
    id: "cs-6",
    ownerId: "m-renn",
    title: "轻飘飘的几句话",
    date: "2026年8月27日",
    cover: "/covers/com-6.png",
    video: "/videos/story-6.mp4",
    excerpt: "家庭聚餐被亲戚随口评判工作和生活,我耿耿于怀好几天。站在对方视角才看懂:他们只是习惯性攀比,根本不了解我。",
    transcript:
      "家庭聚餐被亲戚随意评判我的工作和生活,几句话轻飘飘的,却让我耿耿于怀。之后几天反复回想,不停怀疑自己的选择是不是真的错了,越想越焦虑。站在对方视角我看懂了,他们只是习惯性随口攀比、随意评价,根本不了解我的生活,也不用为我的人生负责。没必要因为外人的随口之言否定自己。",
    comments: [
      c("cm-61", "一一", "sena", "friend", "成年人真的很容易被别人的闲话影响情绪,但要逐步学会坚定自己", "8月28日"),
    ],
  },
  {
    id: "cs-7",
    ownerId: "m-tola",
    title: "不惩罚从前的自己",
    date: "2026年8月26日",
    cover: "/covers/com-7.png",
    video: "/videos/story-7.mp4",
    excerpt: "总拿现在的认知批判过去那个做得不够好的自己。代入当时的处境才看见:那时候我手里本来就没有更好的选项。",
    transcript:
      "之前的工作被我处理得很糟糕,事情早就结束了,但我总反复回想当时的场面。拿现在拥有的认知不停批判过去的自己,不停脑补如果重来,我一定可以做得完美,越回想又只会越懊恼。但代入当时自己全部的信息与处境。我看见那时候我手里本身就没有更好选项。我依然承认当时结果不够好,但我不再持续用现在的标准惩罚从前的自己。可以坦然复盘教训,而不是陷入无尽自我否定。",
    comments: [
      c("cm-71", "一一", "sena", "friend", "吸取教训,不等于要不停责怪过去的自己~", "8月27日"),
      c("cm-72", "兜兜", "mira", "friend", "我们对别人都很宽容,唯独对自己格外苛刻", "8月27日"),
      c("cm-73", "芙芙", "renn", "visitor", "真的别总苛责自己,放过自己吧", "8月28日"),
    ],
  },
  {
    id: "cs-8",
    ownerId: "m-sena",
    title: "删掉聊天记录之后",
    date: "2026年8月25日",
    cover: "/covers/com-8.png",
    video: "/videos/story-8.mp4",
    excerpt: "分开两个月,深夜还在复盘争吵的片段。彻底回顾之后,不再执着揪出一个「错误源头」,也想清了下一段关系的底线。",
    transcript:
      "分开两个月,我删掉全部聊天记录。但深夜总会不停复盘过去争吵的片段,不停纠结到底是哪一句话毁掉这段关系。一会觉得全是对方的问题,一会又开始疯狂反省自己是不是做得不够好。 我彻底回顾了这段经历,不再执着非要揪出一个 \"错误源头\"。我看清两个人各自的局限,也想明白我下一段关系里哪些底线是我绝对不能退让的。心里不再反复拉扯折磨自己。",
    comments: [
      c("cm-81", "兜兜", "mira", "friend", "告别反复内耗开始新故事吧", "8月26日"),
      c("cm-82", "呆呆", "tola", "friend", "下一段更美!", "8月26日"),
      c("cm-83", "欢欢", "sena", "visitor", "仿佛看到了我的故事,但现在我已经遇到了更合适的他,祝福你也是~", "8月27日"),
    ],
  },
  {
    id: "cs-9",
    ownerId: "m-ivo",
    title: "慢慢不分享日常了",
    date: "2026年8月24日",
    cover: "/covers/com-9.png",
    video: "/videos/story-9.mp4",
    excerpt: "很要好的朋友渐渐疏远,没有吵架,只是不再分享日常。站在她的角度看见了她生活的变化,不是谁做错了什么。",
    transcript:
      "曾经很要好的朋友渐渐疏远,没有激烈吵架,只是慢慢不再分享日常。反复回忆我们的聊天记录和最后几次对话,我还是没想明白是哪一步把我们的关系推远了。站在她的角度,我看见了对方生活发生的变化,不是谁做错了什么。我想清楚我该主动去聊聊,也接受就算就此疏远也是一种合理结果。不再困在猜测里反复折磨自己。",
    comments: [
      c("cm-91", "欢欢", "sena", "friend", "想好自己要不要行动,接下来勇敢冲就行了!", "8月25日"),
      c("cm-92", "一一", "sena", "visitor", "珍惜现在,勇敢开口~", "8月25日"),
    ],
  },
];

export const communityStoryById = (id: string): CommunityStory | undefined =>
  COMMUNITY_STORIES.find((s) => s.id === id);

export const memberById = (id: string): CommunityMember =>
  COMMUNITY_MEMBERS.find((m) => m.id === id) ?? COMMUNITY_MEMBERS[0];

export const storiesByMember = (memberId: string): CommunityStory[] =>
  COMMUNITY_STORIES.filter((s) => s.ownerId === memberId);

/** 自己历史故事下别人留下的留言(归档 4 个,来自各自故事的「留言」) */
export const OWN_STORY_COMMENTS: Record<string, StoryComment[]> = {
  "seed-1": [
    c("om-11", "呆呆", "tola", "friend", "不用追求事事完美,松弛一点反而更好~", "8月29日"),
    c("om-12", "贝贝", "pico", "friend", "谁懂啊!社交后复盘真的是专属内耗行为", "8月29日"),
    c("om-13", "一一", "sena", "visitor", "发现大家都更专注自己之后瞬间轻松很多", "8月30日"),
  ],
  "seed-2": [
    c("om-21", "兜兜", "mira", "friend", "没必要硬融不属于自己的圈子,舒服最重要", "8月27日"),
    c("om-22", "贝贝", "pico", "friend", "简单看待小事,心情都顺畅很多", "8月28日"),
  ],
  "seed-3": [c("om-31", "芙芙", "renn", "friend", "学着优先顾及自己的感受是特别重要的事情!", "8月26日")],
  "seed-4": [c("om-41", "呆呆", "tola", "friend", "理解不等于妥协,这点真的很难得", "8月25日")],
};
