// 答题模式 - 全局题库
// 每个模型 8-10 题（少儿兴趣题库 10-12 题），题型混合（既有二选一也有四选一）；
// 进入答题模式时随机抽取 5 题。错题本按 category（化学 / 生物 / 地理 / 少儿兴趣）归类。

import type { ModelInfoCategory } from './modelInfoProfiles';

export type QuizCategory = ModelInfoCategory | '少儿兴趣' | 'model-warmup';

export interface QuizQuestion {
  id: string;
  modelUrl: string; // 唯一对应模型
  subject: string; // UI 上显示的中文名称
  category: QuizCategory;
  question: string;
  options: string[]; // 长度为 2（二选一）或 4（四选一）
  correctIndex: number;
  explanation: string;
  /** 2 = 二选一题，4 = 四选一题。UI 根据此字段决定排版与统计。 */
  optionType: 2 | 4;
}

export interface WarmupQuestion extends QuizQuestion {
  category: 'model-warmup';
  modelPartKeys: string[];
  lessonId: string;
  difficulty: '基础' | '进阶';
  enabled: boolean;
  source: 'generated' | 'teacher-edited';
  objectiveIds?: string[];
  activityId?: string;
}

export interface QuizSession {
  questions: QuizQuestion[];
  currentIndex: number;
  answers: (number | null)[];
  startTime: number;
}

// ─────────────── 心 脏 模 型（生物） ───────────────
const HEART_QUESTIONS: QuizQuestion[] = [
  {
    id: 'heart-1', modelUrl: '/models/heart-optimized.glb', subject: '心脏模型',
    category: '生物', optionType: 4,
    question: '人体心脏有几个腔室？',
    options: ['两个腔室', '三个腔室', '四个腔室', '五个腔室'],
    correctIndex: 2,
    explanation: '人体心脏分为左心房、左心室、右心房、右心室四个腔室。',
  },
  {
    id: 'heart-2', modelUrl: '/models/heart-optimized.glb', subject: '心脏模型',
    category: '生物', optionType: 2,
    question: '心脏中哪个腔室的肌肉壁最厚？',
    options: ['左心室', '右心室'],
    correctIndex: 0,
    explanation: '左心室负责将血液泵向全身（体循环），需要更大的压力，因此肌肉壁最厚。',
  },
  {
    id: 'heart-3', modelUrl: '/models/heart-optimized.glb', subject: '心脏模型',
    category: '生物', optionType: 4,
    question: '血液从右心室泵出后，首先进入哪个血管？',
    options: ['主动脉', '肺动脉', '肺静脉', '上腔静脉'],
    correctIndex: 1,
    explanation: '右心室将血液泵入肺动脉，进行肺循环，在肺部进行气体交换后经肺静脉回到左心房。',
  },
  {
    id: 'heart-4', modelUrl: '/models/heart-optimized.glb', subject: '心脏模型',
    category: '生物', optionType: 4,
    question: '左心房和左心室之间的瓣膜叫什么？',
    options: ['二尖瓣', '三尖瓣', '主动脉瓣', '肺动脉瓣'],
    correctIndex: 0,
    explanation: '左心房与左心室之间是二尖瓣，它能防止血液倒流回心房。',
  },
  {
    id: 'heart-5', modelUrl: '/models/heart-optimized.glb', subject: '心脏模型',
    category: '生物', optionType: 4,
    question: '心脏自身跳动的电信号起源于哪里？',
    options: ['窦房结', '房室结', '浦肯野纤维', '房室束'],
    correctIndex: 0,
    explanation: '窦房结被称为心脏的天然起搏器，它产生电信号引发心脏收缩。',
  },
  {
    id: 'heart-6', modelUrl: '/models/heart-optimized.glb', subject: '心脏模型',
    category: '生物', optionType: 4,
    question: '一个健康成年人安静时的心率大约是？',
    options: ['每分钟 20-40 次', '每分钟 60-100 次', '每分钟 150-200 次', '每分钟 250-300 次'],
    correctIndex: 1,
    explanation: '健康成年人安静时心率通常在 60-100 次/分钟，运动员可能更低。',
  },
  {
    id: 'heart-7', modelUrl: '/models/heart-optimized.glb', subject: '心脏模型',
    category: '生物', optionType: 2,
    question: '心脏为人体提供的是什么动力？',
    options: ['血液循环的动力', '消化食物的动力'],
    correctIndex: 0,
    explanation: '心脏通过节律性收缩为血液循环提供动力，把血液输送到全身。',
  },
  {
    id: 'heart-8', modelUrl: '/models/heart-optimized.glb', subject: '心脏模型',
    category: '生物', optionType: 4,
    question: '给心脏自身肌肉供应血液的血管叫什么？',
    options: ['肺动脉', '冠状动脉', '颈动脉', '肾动脉'],
    correctIndex: 1,
    explanation: '冠状动脉像一顶"冠"一样环绕在心脏表面，专门给心肌提供血液和氧气。',
  },
  {
    id: 'heart-9', modelUrl: '/models/heart-optimized.glb', subject: '心脏模型',
    category: '生物', optionType: 4,
    question: '下列哪一种血管里通常流的是动脉血（含氧丰富）？',
    options: ['肺动脉', '肺静脉', '上腔静脉', '下腔静脉'],
    correctIndex: 1,
    explanation: '肺静脉把在肺里完成气体交换后含氧丰富的血液带回左心房，因此流的是动脉血。',
  },
  {
    id: 'heart-10', modelUrl: '/models/heart-optimized.glb', subject: '心脏模型',
    category: '生物', optionType: 4,
    question: '心电图（ECG）主要用来检查什么？',
    options: ['肝脏功能', '心脏电活动', '肾脏滤过率', '肺活量大小'],
    correctIndex: 1,
    explanation: '心电图通过记录心脏的电活动来评估心跳节律和心脏健康状况。',
  },
];

// ─────────────── HIV 病 毒 模 型（生物） ───────────────
const HIV_QUESTIONS: QuizQuestion[] = [
  {
    id: 'hiv-1', modelUrl: '/models/hiv-virus.glb', subject: 'HIV 病毒模型',
    category: '生物', optionType: 2,
    question: 'HIV 病毒的遗传物质是什么？',
    options: ['RNA', 'DNA'],
    correctIndex: 0,
    explanation: 'HIV 是一种逆转录病毒，其核心包含两条单链 RNA 作为遗传物质。',
  },
  {
    id: 'hiv-2', modelUrl: '/models/hiv-virus.glb', subject: 'HIV 病毒模型',
    category: '生物', optionType: 4,
    question: 'HIV 病毒主要攻击人体免疫系统中的哪种细胞？',
    options: ['辅助性 T 细胞', 'B 淋巴细胞', '红细胞', '血小板'],
    correctIndex: 0,
    explanation: 'HIV 主要感染并破坏带有 CD4 受体的辅助性 T 细胞（CD4+ T 细胞）。',
  },
  {
    id: 'hiv-3', modelUrl: '/models/hiv-virus.glb', subject: 'HIV 病毒模型',
    category: '生物', optionType: 4,
    question: 'HIV 病毒表面用于附着宿主细胞的关键蛋白是什么？',
    options: ['gp120 蛋白', '血凝素蛋白', '胰岛素', '胶原蛋白'],
    correctIndex: 0,
    explanation: 'HIV 表面的包膜糖蛋白 gp120 能够与宿主细胞的 CD4 受体特异性结合。',
  },
  {
    id: 'hiv-4', modelUrl: '/models/hiv-virus.glb', subject: 'HIV 病毒模型',
    category: '生物', optionType: 4,
    question: 'HIV 病毒在细胞内复制时，利用哪种特殊的酶将 RNA 转化为 DNA？',
    options: ['逆转录酶', 'RNA 聚合酶', 'DNA 聚合酶', '解旋酶'],
    correctIndex: 0,
    explanation: 'HIV 病毒携带逆转录酶，进入宿主细胞后将自身的 RNA 逆转录成 DNA 并整合到宿主基因组中。',
  },
  {
    id: 'hiv-5', modelUrl: '/models/hiv-virus.glb', subject: 'HIV 病毒模型',
    category: '生物', optionType: 4,
    question: 'HIV 病毒衣壳通常呈现什么形状？',
    options: ['正方体', '圆锥形', '正八面体', '螺旋管'],
    correctIndex: 1,
    explanation: '成熟的 HIV 病毒粒子内部有一个特征性的圆锥形（锥状）核心衣壳，包裹着 RNA 和酶。',
  },
  {
    id: 'hiv-6', modelUrl: '/models/hiv-virus.glb', subject: 'HIV 病毒模型',
    category: '生物', optionType: 2,
    question: 'HIV 主要通过哪些途径传播？',
    options: ['血液和体液传播', '日常拥抱传播'],
    correctIndex: 0,
    explanation: 'HIV 通过血液、体液和母婴等途径传播，日常接触如拥抱、握手不会传播。',
  },
  {
    id: 'hiv-7', modelUrl: '/models/hiv-virus.glb', subject: 'HIV 病毒模型',
    category: '生物', optionType: 4,
    question: '未经治疗的 HIV 感染持续发展，可能导致哪种综合征？',
    options: ['获得性免疫缺陷综合征（AIDS）', '唐氏综合征', '帕金森综合征', '代谢综合征'],
    correctIndex: 0,
    explanation: '未经有效治疗时，HIV 会持续破坏 CD4+ T 细胞，最终可能发展为艾滋病（AIDS）。',
  },
  {
    id: 'hiv-8', modelUrl: '/models/hiv-virus.glb', subject: 'HIV 病毒模型',
    category: '生物', optionType: 4,
    question: '下列哪种行为不会传播 HIV？',
    options: ['共用注射器', '与感染者握手', '无保护性行为', '母婴传播'],
    correctIndex: 1,
    explanation: '握手、拥抱、共用餐具等日常接触都不会传播 HIV。',
  },
  {
    id: 'hiv-9', modelUrl: '/models/hiv-virus.glb', subject: 'HIV 病毒模型',
    category: '生物', optionType: 4,
    question: 'HIV 的"窗口期"指的是什么？',
    options: ['病毒感染后到能被检出抗体之间的时间', '病毒在空气中存活的时间', '感染者恢复的时间', '病毒休眠的时间'],
    correctIndex: 0,
    explanation: '"窗口期"是指感染后到现有检测方法能可靠查出抗体之间的时间段。',
  },
  {
    id: 'hiv-10', modelUrl: '/models/hiv-virus.glb', subject: 'HIV 病毒模型',
    category: '生物', optionType: 4,
    question: '国际上用红丝带象征什么？',
    options: ['关注艾滋病防治', '环境保护', '节约用水', '交通安全'],
    correctIndex: 0,
    explanation: '红丝带是世界艾滋病防治的标志，象征对感染者的关爱与防治意识的普及。',
  },
];

// ─────────────── 金 刚 石 模 型（化学） ───────────────
const DIAMOND_QUESTIONS: QuizQuestion[] = [
  {
    id: 'dia-1', modelUrl: '/models/diamond.glb', subject: '金刚石模型',
    category: '化学', optionType: 4,
    question: '金刚石中每个碳原子与周围几个碳原子成键？',
    options: ['2 个', '3 个', '4 个', '6 个'],
    correctIndex: 2,
    explanation: '每个碳原子以 sp3 杂化，与周围 4 个碳原子形成坚固的共价键。',
  },
  {
    id: 'dia-2', modelUrl: '/models/diamond.glb', subject: '金刚石模型',
    category: '化学', optionType: 4,
    question: '金刚石的碳原子空间排列构成了什么几何形状？',
    options: ['正四面体', '正六边形', '正五边形', '正三角形'],
    correctIndex: 0,
    explanation: '碳原子之间以共价键相连，形成连续的、高度对称的正四面体立体网状结构。',
  },
  {
    id: 'dia-3', modelUrl: '/models/diamond.glb', subject: '金刚石模型',
    category: '化学', optionType: 4,
    question: '金刚石之所以是自然界已知最硬的物质，是因为？',
    options: ['全为牢固的共价键', '原子之间距离极远', '密度很大', '含有大量金属'],
    correctIndex: 0,
    explanation: '整个晶体由强大的 C-C 共价键构成三维网状结构，键能极大，导致极高的硬度。',
  },
  {
    id: 'dia-4', modelUrl: '/models/diamond.glb', subject: '金刚石模型',
    category: '化学', optionType: 4,
    question: '金刚石晶体属于哪一类晶体？',
    options: ['离子晶体', '原子晶体（共价晶体）', '分子晶体', '金属晶体'],
    correctIndex: 1,
    explanation: '由于金刚石是由碳原子通过共价键连接而成的三维网络，它属于典型的原子晶体。',
  },
  {
    id: 'dia-5', modelUrl: '/models/diamond.glb', subject: '金刚石模型',
    category: '化学', optionType: 2,
    question: '纯净的金刚石通常是否导电？',
    options: ['不导电', '导电'],
    correctIndex: 0,
    explanation: '金刚石中没有自由移动的电子（所有价电子都参与形成共价键），因此它不导电。',
  },
  {
    id: 'dia-6', modelUrl: '/models/diamond.glb', subject: '金刚石模型',
    category: '化学', optionType: 4,
    question: '金刚石的化学组成可以简写为？',
    options: ['Si', 'C', 'Fe', 'Au'],
    correctIndex: 1,
    explanation: '金刚石由碳（C）元素组成，是碳的一种同素异形体。',
  },
  {
    id: 'dia-7', modelUrl: '/models/diamond.glb', subject: '金刚石模型',
    category: '化学', optionType: 4,
    question: '金刚石和石墨都是由碳组成，但它们的什么性质差别最大？',
    options: ['硬度与导电性', '所含元素种类', '原子序数', '颜色是否为白色'],
    correctIndex: 0,
    explanation: '金刚石坚硬不导电，石墨柔软且导电，差异源于内部碳原子的排列方式。',
  },
  {
    id: 'dia-8', modelUrl: '/models/diamond.glb', subject: '金刚石模型',
    category: '化学', optionType: 4,
    question: '常被用来划玻璃的常见物品中，硬度最接近金刚石的是？',
    options: ['普通玻璃', '碳化钨', '塑料尺', '木棒'],
    correctIndex: 1,
    explanation: '碳化钨等超硬材料常用于工业切割，硬度仅次于金刚石等少数材料。',
  },
];

// ─────────────── 金 刚 石 晶 胞（化学） ───────────────
const DIAMOND_UNIT_CELL_QUESTIONS: QuizQuestion[] = [
  {
    id: 'duc-1', modelUrl: '/models/diamond-unit-cell_NIH3D.glb', subject: '金刚石晶胞',
    category: '化学', optionType: 4,
    question: '一个金刚石晶胞中实际上包含几个完整的碳原子？',
    options: ['2 个', '4 个', '6 个', '8 个'],
    correctIndex: 3,
    explanation: '顶点占 8×1/8=1 个，面心占 6×1/2=3 个，体内有 4 个完全属于该晶胞，共计 1+3+4 = 8 个碳原子。',
  },
  {
    id: 'duc-2', modelUrl: '/models/diamond-unit-cell_NIH3D.glb', subject: '金刚石晶胞',
    category: '化学', optionType: 4,
    question: '金刚石晶胞属于哪种晶格类型？',
    options: ['面心立方 (FCC)', '体心立方 (BCC)', '简单立方', '六方密堆积'],
    correctIndex: 0,
    explanation: '金刚石晶体结构可以看作是两套面心立方晶格沿着体对角线错开 1/4 长度嵌套而成。',
  },
  {
    id: 'duc-3', modelUrl: '/models/diamond-unit-cell_NIH3D.glb', subject: '金刚石晶胞',
    category: '化学', optionType: 4,
    question: '在金刚石晶胞内部的四个碳原子占据了什么位置？',
    options: ['八面体空隙', '四面体空隙', '体心', '顶点'],
    correctIndex: 1,
    explanation: '这四个碳原子占据了面心立方晶格中 8 个四面体空隙的一半（即 4 个）。',
  },
  {
    id: 'duc-4', modelUrl: '/models/diamond-unit-cell_NIH3D.glb', subject: '金刚石晶胞',
    category: '化学', optionType: 4,
    question: '金刚石晶胞的空间利用率大约是多少？',
    options: ['34%', '52%', '68%', '74%'],
    correctIndex: 0,
    explanation: '由于正四面体结构比较疏松，金刚石的空间利用率仅约为 34%，是比较小的。',
  },
  {
    id: 'duc-5', modelUrl: '/models/diamond-unit-cell_NIH3D.glb', subject: '金刚石晶胞',
    category: '化学', optionType: 4,
    question: '碳原子之间通过什么类型的轨道杂化形成这种晶胞结构？',
    options: ['sp 杂化', 'sp2 杂化', 'sp3 杂化', 'sp3d 杂化'],
    correctIndex: 2,
    explanation: '在金刚石中，碳原子的 2s 轨道和三个 2p 轨道进行 sp3 杂化，形成四个等价的杂化轨道。',
  },
  {
    id: 'duc-6', modelUrl: '/models/diamond-unit-cell_NIH3D.glb', subject: '金刚石晶胞',
    category: '化学', optionType: 2,
    question: '金刚石晶胞的形状属于？',
    options: ['立方体', '三棱柱'],
    correctIndex: 0,
    explanation: '金刚石晶胞是一个立方体，每个角均为 90 度，三边长度相等。',
  },
  {
    id: 'duc-7', modelUrl: '/models/diamond-unit-cell_NIH3D.glb', subject: '金刚石晶胞',
    category: '化学', optionType: 4,
    question: '金刚石的最小重复结构单元称作？',
    options: ['晶胞', '晶界', '晶簇', '晶面'],
    correctIndex: 0,
    explanation: '晶胞是晶体结构中在三维空间重复出现的最小结构单元。',
  },
  {
    id: 'duc-8', modelUrl: '/models/diamond-unit-cell_NIH3D.glb', subject: '金刚石晶胞',
    category: '化学', optionType: 4,
    question: '沿晶胞体对角线方向观察金刚石结构时，下列说法正确的是？',
    options: ['可以看到两套错开的面心立方子晶格', '完全均匀的简单立方', '只能看到一个原子', '呈螺旋状结构'],
    correctIndex: 0,
    explanation: '沿体对角线方向观察，可以清晰看到两套面心立方子晶格相互错开嵌套的结构。',
  },
];

// ─────────────── 1,4- 二 氯 甲 基 苯（化学） ───────────────
const DICHLOROTOLUENE_QUESTIONS: QuizQuestion[] = [
  {
    id: 'pub-1', modelUrl: '/models/pubchem-6233-bas-color-print_NIH3D.glb', subject: '1,4-二氯甲基苯',
    category: '化学', optionType: 4,
    question: '1,4-二氯甲基苯分子中包含几个氯原子？',
    options: ['1 个', '2 个', '3 个', '4 个'],
    correctIndex: 1,
    explanation: '分子中包含两个氯原子（Cl），这从名称中的"二氯"即可判断。',
  },
  {
    id: 'pub-2', modelUrl: '/models/pubchem-6233-bas-color-print_NIH3D.glb', subject: '1,4-二氯甲基苯',
    category: '化学', optionType: 4,
    question: '该分子中的芳香环是什么类型的环？',
    options: ['环己烷环', '苯环', '环戊二烯环', '吡咯环'],
    correctIndex: 1,
    explanation: '它是一种芳香族化合物，中心结构是一个由六个碳原子组成的苯环。',
  },
  {
    id: 'pub-3', modelUrl: '/models/pubchem-6233-bas-color-print_NIH3D.glb', subject: '1,4-二氯甲基苯',
    category: '化学', optionType: 4,
    question: '"1,4-" 在化学命名中代表两个取代基处于什么位置关系？',
    options: ['邻位 (ortho)', '间位 (meta)', '对位 (para)', '连位'],
    correctIndex: 2,
    explanation: '在苯环上，1,4-位置即相对的对角线位置，被称为"对位"。',
  },
  {
    id: 'pub-4', modelUrl: '/models/pubchem-6233-bas-color-print_NIH3D.glb', subject: '1,4-二氯甲基苯',
    category: '化学', optionType: 4,
    question: '苯环上的碳原子采用的是什么杂化方式？',
    options: ['sp 杂化', 'sp2 杂化', 'sp3 杂化', 'sp3d 杂化'],
    correctIndex: 1,
    explanation: '苯环上的碳原子全部采用 sp2 杂化，形成平面六边形结构，并存在离域大 π 键。',
  },
  {
    id: 'pub-5', modelUrl: '/models/pubchem-6233-bas-color-print_NIH3D.glb', subject: '1,4-二氯甲基苯',
    category: '化学', optionType: 4,
    question: '这个分子是否具有偶极矩？',
    options: ['有，它是极性分子', '没有，它是非极性分子', '偶极矩为零', '无法判断'],
    correctIndex: 0,
    explanation: '虽然主结构有一定对称性，但由于取代基（甲基和氯原子）不同且不对称，它是极性分子。',
  },
  {
    id: 'pub-6', modelUrl: '/models/pubchem-6233-bas-color-print_NIH3D.glb', subject: '1,4-二氯甲基苯',
    category: '化学', optionType: 4,
    question: '该分子的核心骨架有多少个原子共平面？',
    options: ['6 个碳', '10 个以上的原子', '只有 2 个', '没有一个'],
    correctIndex: 1,
    explanation: '苯环本身是 6 个共面碳原子，加上与之相连的原子，整体有 10 个以上原子共面。',
  },
  {
    id: 'pub-7', modelUrl: '/models/pubchem-6233-bas-color-print_NIH3D.glb', subject: '1,4-二氯甲基苯',
    category: '化学', optionType: 2,
    question: '"二氯甲基"中的"二氯"是指分子里含有几个氯原子？',
    options: ['2 个', '4 个'],
    correctIndex: 0,
    explanation: '"二氯"代表两个氯原子；甲基是 -CH3，"二氯甲基"指两个 Cl 取代了甲基上的两个 H。',
  },
  {
    id: 'pub-8', modelUrl: '/models/pubchem-6233-bas-color-print_NIH3D.glb', subject: '1,4-二氯甲基苯',
    category: '化学', optionType: 4,
    question: '这种分子常被归入哪一类有机化合物？',
    options: ['芳香族化合物', '无机盐', '金属配合物', '有机高分子聚合物'],
    correctIndex: 0,
    explanation: '因为含有苯环结构，它属于芳香族有机化合物。',
  },
];

// ─────────────── NaCl 离 子 晶 体（化学） ───────────────
const NACL_QUESTIONS: QuizQuestion[] = [
  {
    id: 'nacl-1', modelUrl: '/models/nacl-crystal.glb', subject: 'NaCl 离子晶体',
    category: '化学', optionType: 4,
    question: 'NaCl 晶体是由什么粒子构成的？',
    options: ['钠离子和氯离子', '钠原子和氯原子', '水分子和钠离子', '氢原子和氧原子'],
    correctIndex: 0,
    explanation: 'NaCl 是离子晶体，由带正电的钠离子（Na⁺）和带负电的氯离子（Cl⁻）构成。',
  },
  {
    id: 'nacl-2', modelUrl: '/models/nacl-crystal.glb', subject: 'NaCl 离子晶体',
    category: '化学', optionType: 4,
    question: '在 NaCl 晶体中，每个 Na⁺ 周围紧邻几个 Cl⁻？',
    options: ['2 个', '4 个', '6 个', '8 个'],
    correctIndex: 2,
    explanation: '在面心立方晶格中，每个钠离子的上、下、左、右、前、后共有 6 个紧邻的氯离子（配位数为 6）。',
  },
  {
    id: 'nacl-3', modelUrl: '/models/nacl-crystal.glb', subject: 'NaCl 离子晶体',
    category: '化学', optionType: 4,
    question: '由于存在强烈的静电吸引，NaCl 在常温下是什么状态？',
    options: ['气体', '液体', '固体', '等离子体'],
    correctIndex: 2,
    explanation: '强烈的离子键使得 NaCl 具有较高的熔点和沸点，在常温下呈现坚硬的固体状态。',
  },
  {
    id: 'nacl-4', modelUrl: '/models/nacl-crystal.glb', subject: 'NaCl 离子晶体',
    category: '化学', optionType: 2,
    question: '固态 NaCl 能否导电？',
    options: ['能', '不能'],
    correctIndex: 1,
    explanation: '固态离子晶体中离子被束缚在晶格中，无法自由移动，因此固态不导电；只有在熔融状态或水溶液中才导电。',
  },
  {
    id: 'nacl-5', modelUrl: '/models/nacl-crystal.glb', subject: 'NaCl 离子晶体',
    category: '化学', optionType: 4,
    question: 'NaCl 晶胞包含几个 NaCl "分子"？',
    options: ['1 个', '2 个', '3 个', '4 个'],
    correctIndex: 3,
    explanation: 'NaCl 晶胞中 Na⁺ 和 Cl⁻ 各有 4 个（通过顶点、面心和棱心、体心计算），相当于 4 个 NaCl "分子"。',
  },
  {
    id: 'nacl-6', modelUrl: '/models/nacl-crystal.glb', subject: 'NaCl 离子晶体',
    category: '化学', optionType: 4,
    question: 'NaCl 易溶于水是因为？',
    options: ['水分子能拆散离子键', 'NaCl 原子间距很大', 'NaCl 在水中会升华', 'NaCl 是金属'],
    correctIndex: 0,
    explanation: '水分子的极性作用能减弱 NaCl 晶格中的静电吸引，使 Na⁺ 和 Cl⁻ 进入水溶液。',
  },
  {
    id: 'nacl-7', modelUrl: '/models/nacl-crystal.glb', subject: 'NaCl 离子晶体',
    category: '化学', optionType: 4,
    question: '下列哪种说法正确描述了 NaCl 中的化学键？',
    options: ['以离子键为主', '以共价键为主', '以金属键为主', '没有化学键'],
    correctIndex: 0,
    explanation: 'NaCl 由典型的金属与非金属之间的电子转移形成，以离子键为主。',
  },
  {
    id: 'nacl-8', modelUrl: '/models/nacl-crystal.glb', subject: 'NaCl 离子晶体',
    category: '化学', optionType: 4,
    question: '把 NaCl 加热到约 800 °C 时会发生什么？',
    options: ['熔化变成能导电的液体', '直接气化', '变成黑色固体', '硬度急剧上升'],
    correctIndex: 0,
    explanation: '约 800 °C 时 NaCl 熔化，离子变为可自由移动的状态，因此熔融 NaCl 能导电。',
  },
];

// ─────────────── SiO₂ 二 氧 化 硅（化学） ───────────────
const SIO2_QUESTIONS: QuizQuestion[] = [
  {
    id: 'sio2-1', modelUrl: '/models/sio2-crystal.glb', subject: 'SiO₂ 二氧化硅',
    category: '化学', optionType: 4,
    question: 'SiO₂ 晶体中，每个硅原子与几个氧原子相连？',
    options: ['2 个', '3 个', '4 个', '6 个'],
    correctIndex: 2,
    explanation: '在 SiO₂（如石英）晶体中，每个硅原子与周围 4 个氧原子以共价键相连，形成正四面体。',
  },
  {
    id: 'sio2-2', modelUrl: '/models/sio2-crystal.glb', subject: 'SiO₂ 二氧化硅',
    category: '化学', optionType: 4,
    question: 'SiO₂ 属于哪一种晶体类型？',
    options: ['分子晶体', '原子晶体', '离子晶体', '金属晶体'],
    correctIndex: 1,
    explanation: '二氧化硅是由硅原子和氧原子通过共价键组成的三维空间网状结构，属于原子晶体。',
  },
  {
    id: 'sio2-3', modelUrl: '/models/sio2-crystal.glb', subject: 'SiO₂ 二氧化硅',
    category: '化学', optionType: 4,
    question: '在 SiO₂ 网络中，每个氧原子连接着几个硅原子？',
    options: ['1 个', '2 个', '3 个', '4 个'],
    correctIndex: 1,
    explanation: '为了保持化学式比例为 1:2，每个氧原子必须且仅连接 2 个硅原子，充当桥梁的作用。',
  },
  {
    id: 'sio2-4', modelUrl: '/models/sio2-crystal.glb', subject: 'SiO₂ 二氧化硅',
    category: '化学', optionType: 4,
    question: 'SiO₂ 晶体的熔点通常表现出怎样的特征？',
    options: ['极低，易挥发', '与水接近', '极高，坚硬耐高温', '随时间变化巨大'],
    correctIndex: 2,
    explanation: '打断三维共价键网络需要极高的能量，因此原子晶体通常具有非常高的熔点。',
  },
  {
    id: 'sio2-5', modelUrl: '/models/sio2-crystal.glb', subject: 'SiO₂ 二氧化硅',
    category: '化学', optionType: 4,
    question: '自然界中最常见的 SiO₂ 晶体矿物是什么？',
    options: ['石英', '方解石', '磁铁矿', '黄铁矿'],
    correctIndex: 0,
    explanation: '石英（Quartz）是自然界中广泛分布的二氧化硅晶体形态。',
  },
  {
    id: 'sio2-6', modelUrl: '/models/sio2-crystal.glb', subject: 'SiO₂ 二氧化硅',
    category: '化学', optionType: 2,
    question: 'SiO₂ 的化学组成中，硅和氧的比例是？',
    options: ['1 : 2', '2 : 1'],
    correctIndex: 0,
    explanation: '二氧化硅的名称本身即表示硅氧原子数比为 1:2。',
  },
  {
    id: 'sio2-7', modelUrl: '/models/sio2-crystal.glb', subject: 'SiO₂ 二氧化硅',
    category: '化学', optionType: 4,
    question: '下列哪种材料的主要成分就是 SiO₂？',
    options: ['普通玻璃', '金属铜', '橡胶', '聚乙烯塑料'],
    correctIndex: 0,
    explanation: '普通玻璃的主要成分是 SiO₂，加上其他助熔剂和调节剂。',
  },
  {
    id: 'sio2-8', modelUrl: '/models/sio2-crystal.glb', subject: 'SiO₂ 二氧化硅',
    category: '化学', optionType: 4,
    question: '纯净的 SiO₂ 晶体（如水晶）通常具有什么光学特性？',
    options: ['透明', '完全不透明', '只反射红外', '只吸收可见光'],
    correctIndex: 0,
    explanation: '纯净的 SiO₂ 晶体（如水晶）通常是无色透明的，可以透过可见光。',
  },
];

// ─────────────── 硝 基 苯（化学） ───────────────
const NITROBENZENE_QUESTIONS: QuizQuestion[] = [
  {
    id: 'nitro-1', modelUrl: '/models/7416-bas-color-print_NIH3D.glb', subject: '硝基苯',
    category: '化学', optionType: 4,
    question: '硝基苯分子的化学式是什么？',
    options: ['C₆H₆', 'C₆H₅NO₂', 'C₆H₁₂O₆', 'CH₃COOH'],
    correctIndex: 1,
    explanation: '硝基苯是由苯环上的一颗氢原子被硝基（-NO₂）取代形成的，因此化学式为 C₆H₅NO₂。',
  },
  {
    id: 'nitro-2', modelUrl: '/models/7416-bas-color-print_NIH3D.glb', subject: '硝基苯',
    category: '化学', optionType: 4,
    question: '硝基（-NO₂）在这个分子中是一个怎样的官能团？',
    options: ['推电子基团', '吸电子基团', '中性基团', '碱性基团'],
    correctIndex: 1,
    explanation: '硝基中含有电负性很强的氧和氮，是一个强吸电子基团，会降低苯环的电子云密度。',
  },
  {
    id: 'nitro-3', modelUrl: '/models/7416-bas-color-print_NIH3D.glb', subject: '硝基苯',
    category: '化学', optionType: 4,
    question: '在常温常压下，硝基苯的状态和颜色通常是？',
    options: ['无色气体', '苦杏仁味的淡黄色液体', '蓝色固体', '紫色粉末'],
    correctIndex: 1,
    explanation: '硝基苯是一种高沸点的油状液体，纯品为无色，但通常呈微黄色，具有苦杏仁味，有毒。',
  },
  {
    id: 'nitro-4', modelUrl: '/models/7416-bas-color-print_NIH3D.glb', subject: '硝基苯',
    category: '化学', optionType: 4,
    question: '硝基苯能和水互相溶解吗？',
    options: ['完全互溶', '部分互溶', '微溶易分层', '不溶于水'],
    correctIndex: 3,
    explanation: '硝基苯是有机溶剂，极性不大且苯环占据主导，因此它不溶于水，且密度比水大。',
  },
  {
    id: 'nitro-5', modelUrl: '/models/7416-bas-color-print_NIH3D.glb', subject: '硝基苯',
    category: '化学', optionType: 4,
    question: '硝基苯分子中是否所有的原子都处于同一个平面上？',
    options: ['不一定同平面', '严格完全同平面', '全部平行排列', '全部位于两条平行线'],
    correctIndex: 0,
    explanation: '由于硝基（-NO₂）中的 O-N 键可以围绕 C-N 键旋转，分子在某些构象下并非所有原子严格共面。',
  },
  {
    id: 'nitro-6', modelUrl: '/models/7416-bas-color-print_NIH3D.glb', subject: '硝基苯',
    category: '化学', optionType: 4,
    question: '硝基苯在化工生产中常被用来做什么？',
    options: ['制造炸药和染料的中间体', '直接食用', '用作燃料电池', '作为饮用水'],
    correctIndex: 0,
    explanation: '硝基苯是制造苯胺、染料、炸药等的重要化工中间体。',
  },
  {
    id: 'nitro-7', modelUrl: '/models/7416-bas-color-print_NIH3D.glb', subject: '硝基苯',
    category: '化学', optionType: 2,
    question: '硝基苯属于什么样的有机物大类？',
    options: ['芳香族化合物', '脂肪烃'],
    correctIndex: 0,
    explanation: '因含有苯环结构，硝基苯属于芳香族有机化合物。',
  },
  {
    id: 'nitro-8', modelUrl: '/models/7416-bas-color-print_NIH3D.glb', subject: '硝基苯',
    category: '化学', optionType: 4,
    question: '在亲电取代反应中，硝基通常使苯环表现为何种定位效应？',
    options: ['间位定位', '邻位定位', '对位定位', '完全无定位'],
    correctIndex: 0,
    explanation: '硝基是强吸电子基，会钝化苯环并使新进入的取代基主要进入间位。',
  },
];

// ─────────────── 地 球 内 部 结 构（地理） ───────────────
const EARTH_QUESTIONS: QuizQuestion[] = [
  {
    id: 'earth-1', modelUrl: '/models/earth-layers.glb', subject: '地球内部结构',
    category: '地理', optionType: 4,
    question: '地球内部由外到内依次是哪三个圈层？',
    options: ['地壳、地幔、地核', '地幔、地壳、地核', '地核、地幔、地壳', '地壳、地核、地幔'],
    correctIndex: 0,
    explanation: '地球内部结构由外到内依次为：地壳（最薄）、地幔（最厚）、地核（最中心）。',
  },
  {
    id: 'earth-2', modelUrl: '/models/earth-layers.glb', subject: '地球内部结构',
    category: '地理', optionType: 2,
    question: '地壳在大陆和海洋区域的厚度表现有何差异？',
    options: ['大陆地壳更厚', '海洋地壳更厚'],
    correctIndex: 0,
    explanation: '大陆地壳平均厚度约 33 千米，而大洋地壳较薄，平均仅约 6 千米。',
  },
  {
    id: 'earth-3', modelUrl: '/models/earth-layers.glb', subject: '地球内部结构',
    category: '地理', optionType: 4,
    question: '地幔由于高温高压发生局部熔融的部分被称为什么？',
    options: ['岩石圈', '软流层', '生物圈', '水圈'],
    correctIndex: 1,
    explanation: '上地幔顶部存在一个软流层，物质呈半熔融状态，被认为是岩浆的主要发源地。',
  },
  {
    id: 'earth-4', modelUrl: '/models/earth-layers.glb', subject: '地球内部结构',
    category: '地理', optionType: 4,
    question: '地球的地核被划分为外核和内核，外核的物质处于什么状态？',
    options: ['液态', '固态', '气态', '等离子体'],
    correctIndex: 0,
    explanation: '由于地震波横波无法穿过外核，科学家推断外核主要由液态的铁和镍组成。',
  },
  {
    id: 'earth-5', modelUrl: '/models/earth-layers.glb', subject: '地球内部结构',
    category: '地理', optionType: 4,
    question: '地球磁场主要是由于地球哪一部分的流体运动产生的？',
    options: ['液态外核', '固态内核', '地壳', '地幔'],
    correctIndex: 0,
    explanation: '液态铁镍外核的对流运动，结合地球自转产生的科里奥利力，产生了所谓的"地磁发电机效应"。',
  },
  {
    id: 'earth-6', modelUrl: '/models/earth-layers.glb', subject: '地球内部结构',
    category: '地理', optionType: 4,
    question: '地球的平均半径约为多少？',
    options: ['约 6,371 km', '约 1,000 km', '约 20,000 km', '约 50 km'],
    correctIndex: 0,
    explanation: '地球的平均半径约为 6,371 公里，赤道半径略大，两极半径略小。',
  },
  {
    id: 'earth-7', modelUrl: '/models/earth-layers.glb', subject: '地球内部结构',
    category: '地理', optionType: 4,
    question: '地壳的主要组成元素中，最常见的是？',
    options: ['氧、硅', '铜、锌', '金、银', '铁、镍'],
    correctIndex: 0,
    explanation: '地壳以硅酸盐矿物为主，最常见的元素是氧和硅。',
  },
  {
    id: 'earth-8', modelUrl: '/models/earth-layers.glb', subject: '地球内部结构',
    category: '地理', optionType: 4,
    question: '科学家研究地球内部圈层主要依靠什么方法？',
    options: ['直接钻探到地心', '分析地震波', '肉眼观察', '只通过地表采样'],
    correctIndex: 1,
    explanation: '由于人类无法直接观察地球深部，主要通过分析天然地震波在不同介质中的传播来推断内部结构。',
  },
];

// ─────────────── 地 形 地 貌（地理） ───────────────
const TERRAIN_QUESTIONS: QuizQuestion[] = [
  {
    id: 'terr-1', modelUrl: '/models/terrain-topography.glb', subject: '地形地貌',
    category: '地理', optionType: 4,
    question: '在地形图中，等高线密集的地方通常代表什么地形特征？',
    options: ['地形平缓', '坡度陡峭', '海面', '湖泊'],
    correctIndex: 1,
    explanation: '等高线越密集，表示在水平距离内海拔变化越大，也就是地形越陡峭。',
  },
  {
    id: 'terr-2', modelUrl: '/models/terrain-topography.glb', subject: '地形地貌',
    category: '地理', optionType: 4,
    question: '河流在上游山区强烈的向下侵蚀作用，最容易形成什么形状的峡谷？',
    options: ['U 形谷', 'V 形谷', '碟形谷', '盆地形'],
    correctIndex: 1,
    explanation: '河流上游落差大、流速快，以下切侵蚀为主，往往形成陡峻的"V"形峡谷。',
  },
  {
    id: 'terr-3', modelUrl: '/models/terrain-topography.glb', subject: '地形地貌',
    category: '地理', optionType: 4,
    question: '河流在入海口或入湖口，由于流速减缓导致的泥沙堆积地貌称作什么？',
    options: ['冲积扇', '三角洲', '沙丘', '冰碛'],
    correctIndex: 1,
    explanation: '河流携带的泥沙在河口处因水流变缓而沉积，形成类似三角形的平原，即三角洲。',
  },
  {
    id: 'terr-4', modelUrl: '/models/terrain-topography.glb', subject: '地形地貌',
    category: '地理', optionType: 4,
    question: '喀斯特地貌主要是由哪种岩石受到地下水溶蚀而形成的？',
    options: ['石灰岩', '花岗岩', '玄武岩', '砂岩'],
    correctIndex: 0,
    explanation: '石灰岩（碳酸钙）易受含有二氧化碳的水的化学溶蚀，从而形成溶洞、石林等地貌。',
  },
  {
    id: 'terr-5', modelUrl: '/models/terrain-topography.glb', subject: '地形地貌',
    category: '地理', optionType: 4,
    question: '风力侵蚀和风力堆积作用在何种气候区最为显著？',
    options: ['干旱、半干旱区', '湿润的热带雨林区', '寒带苔原区', '海洋气候区'],
    correctIndex: 0,
    explanation: '干旱地区植被稀少，风力作用强烈，容易形成沙丘（风积）和风蚀蘑菇（风蚀）等地貌。',
  },
  {
    id: 'terr-6', modelUrl: '/models/terrain-topography.glb', subject: '地形地貌',
    category: '地理', optionType: 4,
    question: '在山麓地带，河流出山口处由于流速骤减，常形成哪种地貌？',
    options: ['冲积扇', '河漫滩', '峡湾', '瀑布'],
    correctIndex: 0,
    explanation: '山区河流出山口时突然变宽变缓，泥沙沉积成扇形，即冲积扇。',
  },
  {
    id: 'terr-7', modelUrl: '/models/terrain-topography.glb', subject: '地形地貌',
    category: '地理', optionType: 2,
    question: '"高山峡谷"主要由哪种外力作用形成？',
    options: ['流水侵蚀', '风力堆积'],
    correctIndex: 0,
    explanation: '高山峡谷大多是河流长期向下切割的结果，属典型的流水侵蚀地貌。',
  },
  {
    id: 'terr-8', modelUrl: '/models/terrain-topography.glb', subject: '地形地貌',
    category: '地理', optionType: 4,
    question: '观察一个地区地形常用的地图类型是？',
    options: ['政区图', '地形图', '气象图', '人口分布图'],
    correctIndex: 1,
    explanation: '地形图能直观展示高程、坡度等地表形态信息，是观察地形地貌的常用工具。',
  },
];

// ─────────────── 少 儿 兴 趣 题 库 ───────────────
const LANJINGLING_QUESTIONS: QuizQuestion[] = [
  {
    id: 'lanjingling-1', modelUrl: '/models/lanjingling.glb', subject: '蓝精灵',
    category: '少儿兴趣', optionType: 4,
    question: '蓝精灵身上最醒目的颜色是什么？',
    options: ['蓝色', '橙色', '绿色', '紫色'],
    correctIndex: 0,
    explanation: '蓝精灵最醒目的特点就是蓝色的身体，所以叫"蓝精灵"。',
  },
  {
    id: 'lanjingling-2', modelUrl: '/models/lanjingling.glb', subject: '蓝精灵',
    category: '少儿兴趣', optionType: 4,
    question: '想看清蓝精灵模型的背面，可以怎么做？',
    options: ['闭上眼睛', '转动三维模型', '拆掉模型', '把它倒着拿'],
    correctIndex: 1,
    explanation: '转动三维模型，就能从前、后、左、右等不同方向观察它。',
  },
  {
    id: 'lanjingling-3', modelUrl: '/models/lanjingling.glb', subject: '蓝精灵',
    category: '少儿兴趣', optionType: 4,
    question: '蓝色最容易让人想到哪两样自然景物？',
    options: ['蓝天和大海', '火焰和太阳', '沙漠和岩石', '冰川和雪山'],
    correctIndex: 0,
    explanation: '晴朗的天空和清澈的大海常常呈现蓝色。',
  },
  {
    id: 'lanjingling-4', modelUrl: '/models/lanjingling.glb', subject: '蓝精灵',
    category: '少儿兴趣', optionType: 2,
    question: '小伙伴一起完成任务时，哪种做法更好？',
    options: ['互相争吵', '互相帮助'],
    correctIndex: 1,
    explanation: '互相帮助、分工合作，能让大家更顺利地完成任务。',
  },
  {
    id: 'lanjingling-5', modelUrl: '/models/lanjingling.glb', subject: '蓝精灵',
    category: '少儿兴趣', optionType: 4,
    question: '在森林里游玩时，我们应该怎样对待花草？',
    options: ['爱护花草', '随意踩踏', '大量采摘', '当作垃圾'],
    correctIndex: 0,
    explanation: '花草和树木是许多生物的家，我们应该爱护它们。',
  },
  {
    id: 'lanjingling-6', modelUrl: '/models/lanjingling.glb', subject: '蓝精灵',
    category: '少儿兴趣', optionType: 4,
    question: '蘑菇属于下面哪一类生物？',
    options: ['小动物', '真菌', '植物', '细菌'],
    correctIndex: 1,
    explanation: '蘑菇属于真菌，不是植物，也不是小动物。',
  },
  {
    id: 'lanjingling-7', modelUrl: '/models/lanjingling.glb', subject: '蓝精灵',
    category: '少儿兴趣', optionType: 4,
    question: '看到野外不认识的蘑菇，正确做法是什么？',
    options: ['不随便采吃', '马上尝一口', '立刻煮汤', '拿回家晾干'],
    correctIndex: 0,
    explanation: '有些野生蘑菇有毒，不认识时不能随便采摘和食用。',
  },
  {
    id: 'lanjingling-8', modelUrl: '/models/lanjingling.glb', subject: '蓝精灵',
    category: '少儿兴趣', optionType: 4,
    question: '观察三维模型时，放大模型有什么用？',
    options: ['改变模型颜色', '看清细节', '让模型变小', '改变材质'],
    correctIndex: 1,
    explanation: '放大模型可以帮助我们看清衣服、表情和造型等细节。',
  },
  {
    id: 'lanjingling-9', modelUrl: '/models/lanjingling.glb', subject: '蓝精灵',
    category: '少儿兴趣', optionType: 4,
    question: '蓝精灵通常住在什么样的地方？',
    options: ['大城市的高楼', '森林里的小村庄', '海底宫殿', '沙漠绿洲'],
    correctIndex: 1,
    explanation: '在故事里，蓝精灵住在森林深处蘑菇形的小村庄里。',
  },
  {
    id: 'lanjingling-10', modelUrl: '/models/lanjingling.glb', subject: '蓝精灵',
    category: '少儿兴趣', optionType: 2,
    question: '蓝精灵的经典形象常常戴着一顶什么颜色的帽子？',
    options: ['白色', '红色'],
    correctIndex: 1,
    explanation: '蓝精灵通常戴着红色的小尖帽，这是他们最具辨识度的标志之一。',
  },
];

// ─────────────── 奈 李 模 型 ───────────────
const NAILI_QUESTIONS: QuizQuestion[] = [
  {
    id: 'naili-1', modelUrl: '/models/naili.glb', subject: '奈李',
    category: '少儿兴趣', optionType: 4,
    question: '奈李属于哪一类食物？',
    options: ['水果', '蔬菜', '主食', '海鲜'],
    correctIndex: 0,
    explanation: '奈李是李子的一种，属于水果。',
  },
  {
    id: 'naili-2', modelUrl: '/models/naili.glb', subject: '奈李',
    category: '少儿兴趣', optionType: 4,
    question: '奈李通常长在哪里？',
    options: ['水里', '树上', '土里', '岩石上'],
    correctIndex: 1,
    explanation: '奈李是李树结出的果实，生长在树枝上。',
  },
  {
    id: 'naili-3', modelUrl: '/models/naili.glb', subject: '奈李',
    category: '少儿兴趣', optionType: 4,
    question: '奈李果实里面通常有什么？',
    options: ['果核', '贝壳', '金属屑', '塑料珠'],
    correctIndex: 0,
    explanation: '奈李中间有一颗较硬的果核，吃的时候要小心。',
  },
  {
    id: 'naili-4', modelUrl: '/models/naili.glb', subject: '奈李',
    category: '少儿兴趣', optionType: 4,
    question: '吃新鲜奈李前，应该先做什么？',
    options: ['涂上颜料', '清洗干净', '在阳光下曝晒', '放入冰箱冷冻'],
    correctIndex: 1,
    explanation: '水果食用前要用干净的水认真清洗。',
  },
  {
    id: 'naili-5', modelUrl: '/models/naili.glb', subject: '奈李',
    category: '少儿兴趣', optionType: 4,
    question: '奈李树开花以后，可能会慢慢长出什么？',
    options: ['奈李果实', '小石头', '金属片', '玻璃珠'],
    correctIndex: 0,
    explanation: '花经过授粉后，花的一部分会慢慢发育成果实。',
  },
  {
    id: 'naili-6', modelUrl: '/models/naili.glb', subject: '奈李',
    category: '少儿兴趣', optionType: 4,
    question: '水果能为身体提供哪类营养？',
    options: ['塑料和玻璃', '维生素和膳食纤维', '重金属', '化学燃料'],
    correctIndex: 1,
    explanation: '水果通常含有维生素和膳食纤维，适量食用有益健康。',
  },
  {
    id: 'naili-7', modelUrl: '/models/naili.glb', subject: '奈李',
    category: '少儿兴趣', optionType: 2,
    question: '果农采摘奈李时，怎样做更合适？',
    options: ['轻拿轻放', '用力乱扔'],
    correctIndex: 0,
    explanation: '轻拿轻放可以减少碰伤，让果实保存得更好。',
  },
  {
    id: 'naili-8', modelUrl: '/models/naili.glb', subject: '奈李',
    category: '少儿兴趣', optionType: 4,
    question: '吃奈李时，遇到坚硬的果核应该怎么做？',
    options: ['直接吞下', '吐出果核', '用力咬碎', '整颗吞下'],
    correctIndex: 1,
    explanation: '坚硬的果核不适合吞咽，吃的时候要小心取出。',
  },
  {
    id: 'naili-9', modelUrl: '/models/naili.glb', subject: '奈李',
    category: '少儿兴趣', optionType: 4,
    question: '成熟的奈李外皮颜色通常是？',
    options: ['深紫红色或紫黑', '纯白色', '亮蓝色', '荧光绿色'],
    correctIndex: 0,
    explanation: '成熟的奈李通常呈深紫红色或紫黑色，外表裹着一层果粉。',
  },
  {
    id: 'naili-10', modelUrl: '/models/naili.glb', subject: '奈李',
    category: '少儿兴趣', optionType: 4,
    question: '食用过多水果也应该节制，主要原因是什么？',
    options: ['糖分摄入过多也不利于健康', '水果会让人失去记忆', '水果会让头发变色', '水果有放射性'],
    correctIndex: 0,
    explanation: '水果含有天然糖分，一次吃太多也可能让糖分摄入超标，需要适量。',
  },
];

// ─────────────── 奈 李 果 子 模 型 ───────────────
const NAILIGUOZI_QUESTIONS: QuizQuestion[] = [
  {
    id: 'nailiguozi-1', modelUrl: '/models/nailiguozi.glb', subject: '奈李果子',
    category: '少儿兴趣', optionType: 4,
    question: '奈李果子属于哪一类食物？',
    options: ['水果', '玩具', '文具', '工具'],
    correctIndex: 0,
    explanation: '奈李果子是李子类水果，可以用来观察果实的形状和颜色。',
  },
  {
    id: 'nailiguozi-2', modelUrl: '/models/nailiguozi.glb', subject: '奈李果子',
    category: '少儿兴趣', optionType: 4,
    question: '奈李果子一般长在哪里？',
    options: ['书包里', '树上', '衣柜里', '抽屉里'],
    correctIndex: 1,
    explanation: '奈李果子是李树结出的果实，通常长在树枝上。',
  },
  {
    id: 'nailiguozi-3', modelUrl: '/models/nailiguozi.glb', subject: '奈李果子',
    category: '少儿兴趣', optionType: 4,
    question: '吃奈李果子前，最好先做什么？',
    options: ['清洗干净', '涂上颜料', '晒成干', '放进微波炉'],
    correctIndex: 0,
    explanation: '新鲜水果入口前要洗干净，这样更卫生。',
  },
  {
    id: 'nailiguozi-4', modelUrl: '/models/nailiguozi.glb', subject: '奈李果子',
    category: '少儿兴趣', optionType: 4,
    question: '奈李果子中间通常会有什么？',
    options: ['小铃铛', '果核', '小电池', '小灯泡'],
    correctIndex: 1,
    explanation: '李子类水果中间一般有一颗较硬的果核，吃的时候要注意。',
  },
  {
    id: 'nailiguozi-5', modelUrl: '/models/nailiguozi.glb', subject: '奈李果子',
    category: '少儿兴趣', optionType: 4,
    question: '果子成熟后，味道通常会变得怎样？',
    options: ['更甜一些', '像石头一样硬', '完全无味', '变得咸咸的'],
    correctIndex: 0,
    explanation: '很多水果成熟后会变软、变香，甜味也会更明显。',
  },
  {
    id: 'nailiguozi-6', modelUrl: '/models/nailiguozi.glb', subject: '奈李果子',
    category: '少儿兴趣', optionType: 4,
    question: '水果能给身体补充什么？',
    options: ['沙子和玻璃', '维生素和水分', '金属离子', '塑料微粒'],
    correctIndex: 1,
    explanation: '水果通常含有水分、维生素和膳食纤维，适量吃对身体有帮助。',
  },
  {
    id: 'nailiguozi-7', modelUrl: '/models/nailiguozi.glb', subject: '奈李果子',
    category: '少儿兴趣', optionType: 2,
    question: '采摘奈李果子时，哪种做法更好？',
    options: ['轻轻摘下', '用力乱扔'],
    correctIndex: 0,
    explanation: '轻拿轻放可以减少果子碰伤，也能保护树枝。',
  },
  {
    id: 'nailiguozi-8', modelUrl: '/models/nailiguozi.glb', subject: '奈李果子',
    category: '少儿兴趣', optionType: 4,
    question: '观察三维奈李果子模型时，放大模型可以看清什么？',
    options: ['天气预报', '果皮细节', '地下水位', '空气成分'],
    correctIndex: 1,
    explanation: '放大三维模型，可以更清楚地观察果皮、形状和颜色等细节。',
  },
  {
    id: 'nailiguozi-9', modelUrl: '/models/nailiguozi.glb', subject: '奈李果子',
    category: '少儿兴趣', optionType: 4,
    question: '下列哪种水果也是"李子家族"的成员？',
    options: ['西瓜', '桃', '葡萄', '香蕉'],
    correctIndex: 1,
    explanation: '桃、李、杏、梅等都属于蔷薇科李属，是"李子家族"的成员。',
  },
  {
    id: 'nailiguozi-10', modelUrl: '/models/nailiguozi.glb', subject: '奈李果子',
    category: '少儿兴趣', optionType: 4,
    question: '观察模型时如果发现颜色发白，可能是？',
    options: ['表面自然形成的果粉', '模型破损', '温度过低', '光照太亮'],
    correctIndex: 0,
    explanation: '李子表面常见一层薄薄的白色果粉，那是天然形成的保护层，不影响食用。',
  },
];

// ─────────────── 小 韶 卿 IP 形 象 ───────────────
const XIAOSHAOQING_QUESTIONS: QuizQuestion[] = [
  {
    id: 'xiaoshaoqing-1', modelUrl: '/models/xiaoshaoqing.glb', subject: '周田文旅 IP 形象「小韶卿」',
    category: '少儿兴趣', optionType: 2,
    question: '"小韶卿"是哪一个地方的文旅 IP 形象？',
    options: ['仁化县周田镇', '北京市'],
    correctIndex: 0,
    explanation: '"小韶卿"是仁化县周田镇的文旅 IP 形象。',
  },
  {
    id: 'xiaoshaoqing-2', modelUrl: '/models/xiaoshaoqing.glb', subject: '周田文旅 IP 形象「小韶卿」',
    category: '少儿兴趣', optionType: 4,
    question: '仁化县属于广东省的哪座城市？',
    options: ['深圳市', '韶关市', '广州市', '东莞市'],
    correctIndex: 1,
    explanation: '仁化县位于广东省韶关市。',
  },
  {
    id: 'xiaoshaoqing-3', modelUrl: '/models/xiaoshaoqing.glb', subject: '周田文旅 IP 形象「小韶卿」',
    category: '少儿兴趣', optionType: 4,
    question: '周田镇的张屋古村属于哪一类景观？',
    options: ['历史古村落', '海底世界', '现代都市', '雪山营地'],
    correctIndex: 0,
    explanation: '张屋古村保存着古建筑和历史文化，是一座古村落。',
  },
  {
    id: 'xiaoshaoqing-4', modelUrl: '/models/xiaoshaoqing.glb', subject: '周田文旅 IP 形象「小韶卿」',
    category: '少儿兴趣', optionType: 4,
    question: '张屋古村是哪位岭南诗人的祖居？',
    options: ['李白', '张九龄', '杜甫', '白居易'],
    correctIndex: 1,
    explanation: '张屋古村是岭南诗人张九龄的祖居，传承着九龄文化。',
  },
  {
    id: 'xiaoshaoqing-5', modelUrl: '/models/xiaoshaoqing.glb', subject: '周田文旅 IP 形象「小韶卿」',
    category: '少儿兴趣', optionType: 4,
    question: '周田村流过的河流叫什么？',
    options: ['灵溪河', '黄河', '长江', '珠江'],
    correctIndex: 0,
    explanation: '灵溪河流经周田村，当地还建设了美丽河道和景观步道。',
  },
  {
    id: 'xiaoshaoqing-6', modelUrl: '/models/xiaoshaoqing.glb', subject: '周田文旅 IP 形象「小韶卿」',
    category: '少儿兴趣', optionType: 4,
    question: '文旅 IP 形象可以帮助大家做什么？',
    options: ['忘记家乡故事', '认识当地文化和风景', '代替老师上课', '代替天气预报'],
    correctIndex: 1,
    explanation: '有趣的文旅 IP 形象能带大家认识当地的历史、文化和风景。',
  },
  {
    id: 'xiaoshaoqing-7', modelUrl: '/models/xiaoshaoqing.glb', subject: '周田文旅 IP 形象「小韶卿」',
    category: '少儿兴趣', optionType: 4,
    question: '参观古村时，哪种做法是正确的？',
    options: ['保护古建筑', '在墙上乱刻字', '大声喧哗', '随手丢弃垃圾'],
    correctIndex: 0,
    explanation: '古建筑记录着历史，参观时不能乱刻乱画，要一起保护它们。',
  },
  {
    id: 'xiaoshaoqing-8', modelUrl: '/models/xiaoshaoqing.glb', subject: '周田文旅 IP 形象「小韶卿」',
    category: '少儿兴趣', optionType: 2,
    question: '游览美丽河道时，我们应该怎样做？',
    options: ['把垃圾扔进河里', '把垃圾带走'],
    correctIndex: 1,
    explanation: '不乱扔垃圾，才能让河水更清、环境更美。',
  },
  {
    id: 'xiaoshaoqing-9', modelUrl: '/models/xiaoshaoqing.glb', subject: '周田文旅 IP 形象「小韶卿」',
    category: '少儿兴趣', optionType: 4,
    question: '小韶卿所代表的"九龄文化"主要源自哪一位历史人物？',
    options: ['张九龄', '孔子', '诸葛亮', '岳飞'],
    correctIndex: 0,
    explanation: '九龄文化指以张九龄为代表的岭南传统文化与人格精神。',
  },
  {
    id: 'xiaoshaoqing-10', modelUrl: '/models/xiaoshaoqing.glb', subject: '周田文旅 IP 形象「小韶卿」',
    category: '少儿兴趣', optionType: 4,
    question: '如果想了解更多关于小韶卿家乡的故事，下列哪种方式是合适的？',
    options: ['查阅当地文旅官网或公众号', '随意编造信息', '完全靠猜测', '只看电视剧'],
    correctIndex: 0,
    explanation: '官方网站或官方公众号会发布准确、丰富的家乡文化介绍。',
  },
];

// ─────────── 器官解剖系列题库 ───────────
const ORGAN_HEART_QUESTIONS: QuizQuestion[] = [
  {
    id: 'orh-1', modelUrl: '/models/organ-heart.glb', subject: '心脏（解剖）',
    category: '生物', optionType: 4,
    question: '心脏壁由三层构成，其中发挥主要泵血功能、最厚的层是？',
    options: ['心内膜', '心肌层', '心外膜', '心包'],
    correctIndex: 1,
    explanation: '心肌层是心脏壁中最厚的一层，由心肌细胞构成，负责收缩泵血。',
  },
  {
    id: 'orh-2', modelUrl: '/models/organ-heart.glb', subject: '心脏（解剖）',
    category: '生物', optionType: 2,
    question: '心脏中把左右心室分隔开来的肌肉壁叫什么？',
    options: ['室间隔', '房间隔'],
    correctIndex: 0,
    explanation: '室间隔分隔左右心室，房间隔分隔左右心房。',
  },
  {
    id: 'orh-3', modelUrl: '/models/organ-heart.glb', subject: '心脏（解剖）',
    category: '生物', optionType: 4,
    question: '全身的静脉血经上、下腔静脉回流后，首先进入哪个腔室？',
    options: ['左心房', '左心室', '右心房', '右心室'],
    correctIndex: 2,
    explanation: '体循环的静脉血经上、下腔静脉回到右心房，再由右心房进入右心室。',
  },
  {
    id: 'orh-4', modelUrl: '/models/organ-heart.glb', subject: '心脏（解剖）',
    category: '生物', optionType: 2,
    question: '二尖瓣（左房室瓣）可以防止血液从哪个方向倒流？',
    options: ['左心室倒流回左心房', '右心室倒流回右心房'],
    correctIndex: 0,
    explanation: '二尖瓣位于左心房与左心室之间，心室收缩时关闭，防止血液倒流回左心房。',
  },
  {
    id: 'orh-5', modelUrl: '/models/organ-heart.glb', subject: '心脏（解剖）',
    category: '生物', optionType: 4,
    question: '心脏自身的血液供应来自哪一条动脉？',
    options: ['冠状动脉', '肺动脉', '颈动脉', '肾动脉'],
    correctIndex: 0,
    explanation: '冠状动脉从主动脉根部发出，为心脏提供氧和营养物质。',
  },
  {
    id: 'orh-6', modelUrl: '/models/organ-heart.glb', subject: '心脏（解剖）',
    category: '生物', optionType: 4,
    question: '体循环（大循环）的正确路径是？',
    options: ['左心室→主动脉→全身毛细血管→上/下腔静脉→右心房', '右心室→肺动脉→肺→肺静脉→左心房', '左心房→左心室→肺动脉→肺', '右心房→右心室→主动脉→全身'],
    correctIndex: 0,
    explanation: '体循环从左心室出发，经主动脉到达全身，再经腔静脉回到右心房。',
  },
  {
    id: 'orh-7', modelUrl: '/models/organ-heart.glb', subject: '心脏（解剖）',
    category: '生物', optionType: 2,
    question: '心脏听诊时"咚哒"中的第一心音，主要由什么产生？',
    options: ['房室瓣关闭', '主动脉瓣关闭'],
    correctIndex: 0,
    explanation: '第一心音发生在心室收缩期开始，主要由房室瓣关闭引起。',
  },
  {
    id: 'orh-8', modelUrl: '/models/organ-heart.glb', subject: '心脏（解剖）',
    category: '生物', optionType: 4,
    question: '健康成年人安静状态下，心输出量约为多少？',
    options: ['约 1 升/分钟', '约 3 升/分钟', '约 5 升/分钟', '约 12 升/分钟'],
    correctIndex: 2,
    explanation: '心输出量 = 每搏输出量 × 心率，成年人静息时约为 5 升/分钟。',
  },
];

const ORGAN_BRAIN_QUESTIONS: QuizQuestion[] = [
  {
    id: 'orb-1', modelUrl: '/models/organ-brain.glb', subject: '大脑',
    category: '生物', optionType: 4,
    question: '大脑皮层中主要负责语言表达（说话）的区域是？',
    options: ['布罗卡区（运动性语言区）', '韦尼克区', '视觉皮层', '小脑'],
    correctIndex: 0,
    explanation: '布罗卡区位于额叶，受损后会出现"能听懂但说不出"的运动性失语。',
  },
  {
    id: 'orb-2', modelUrl: '/models/organ-brain.glb', subject: '大脑',
    category: '生物', optionType: 2,
    question: '小脑的主要功能是什么？',
    options: ['协调运动与维持平衡', '产生呼吸节律'],
    correctIndex: 0,
    explanation: '小脑负责协调随意运动、维持身体平衡和肌张力。',
  },
  {
    id: 'orb-3', modelUrl: '/models/organ-brain.glb', subject: '大脑',
    category: '生物', optionType: 4,
    question: '连接大脑左右两个半球的结构是？',
    options: ['胼胝体', '小脑蚓部', '脑桥', '延髓'],
    correctIndex: 0,
    explanation: '胼胝体是大脑最大的白质纤维束，负责左右半球之间的信息传递。',
  },
  {
    id: 'orb-4', modelUrl: '/models/organ-brain.glb', subject: '大脑',
    category: '生物', optionType: 2,
    question: '脑干中被称为"生命中枢"、控制心跳呼吸的结构是？',
    options: ['延髓', '大脑皮层'],
    correctIndex: 0,
    explanation: '延髓含有心血管中枢和呼吸中枢，受损会危及生命。',
  },
  {
    id: 'orb-5', modelUrl: '/models/organ-brain.glb', subject: '大脑',
    category: '生物', optionType: 4,
    question: '大脑皮层中处理视觉信息的主要区域位于哪个脑叶？',
    options: ['枕叶', '额叶', '颞叶', '顶叶'],
    correctIndex: 0,
    explanation: '视觉中枢位于枕叶；额叶与运动、判断有关，颞叶与听觉有关。',
  },
  {
    id: 'orb-6', modelUrl: '/models/organ-brain.glb', subject: '大脑',
    category: '生物', optionType: 4,
    question: '神经元之间传递信息，主要依靠哪种化学物质？',
    options: ['神经递质', '激素', '抗体', '淋巴因子'],
    correctIndex: 0,
    explanation: '突触前膜释放神经递质，作用于突触后膜受体，完成信号传递。',
  },
  {
    id: 'orb-7', modelUrl: '/models/organ-brain.glb', subject: '大脑',
    category: '生物', optionType: 2,
    question: '人类大脑中数量占多数的细胞类型是？',
    options: ['神经胶质细胞', '神经元'],
    correctIndex: 0,
    explanation: '神经胶质细胞数量约为神经元的十倍，起支持、营养、绝缘等作用。',
  },
  {
    id: 'orb-8', modelUrl: '/models/organ-brain.glb', subject: '大脑',
    category: '生物', optionType: 4,
    question: '与长期记忆形成关系最密切的脑区是？',
    options: ['海马体', '杏仁核', '丘脑', '脑垂体'],
    correctIndex: 0,
    explanation: '海马体参与情景记忆的编码与巩固，受损会导致新记忆难以形成。',
  },
];

const ORGAN_LUNGS_QUESTIONS: QuizQuestion[] = [
  {
    id: 'orl-1', modelUrl: '/models/organ-lungs.glb', subject: '肺',
    category: '生物', optionType: 2,
    question: '肺中真正进行气体交换的场所是？',
    options: ['肺泡', '支气管'],
    correctIndex: 0,
    explanation: '肺泡壁极薄且表面布满毛细血管，是气体交换的基本单位。',
  },
  {
    id: 'orl-2', modelUrl: '/models/organ-lungs.glb', subject: '肺',
    category: '生物', optionType: 4,
    question: '肺泡内的氧气和二氧化碳交换遵循的原理是？',
    options: ['气体分压差扩散', '主动运输', '渗透作用', '泵送作用'],
    correctIndex: 0,
    explanation: '气体由分压高的一侧向分压低的一侧扩散，属于自由扩散。',
  },
  {
    id: 'orl-3', modelUrl: '/models/organ-lungs.glb', subject: '肺',
    category: '生物', optionType: 4,
    question: '进入血液的氧气主要与红细胞中的什么物质结合？',
    options: ['血红蛋白', '血浆蛋白', '碳酸氢盐', '葡萄糖'],
    correctIndex: 0,
    explanation: '氧与血红蛋白结合形成氧合血红蛋白，随血液运输到全身。',
  },
  {
    id: 'orl-4', modelUrl: '/models/organ-lungs.glb', subject: '肺',
    category: '生物', optionType: 2,
    question: '平静吸气时，膈肌处于什么状态？',
    options: ['收缩下降', '舒张上抬'],
    correctIndex: 0,
    explanation: '吸气时膈肌收缩、穹隆下降，胸腔容积增大，肺内气压降低。',
  },
  {
    id: 'orl-5', modelUrl: '/models/organ-lungs.glb', subject: '肺',
    category: '生物', optionType: 4,
    question: '覆盖在肺表面、随呼吸运动滑动的双层膜是？',
    options: ['胸膜', '心包膜', '腹膜', '脑膜'],
    correctIndex: 0,
    explanation: '胸膜分脏层和壁层，两层之间为胸膜腔，含少量浆液减少摩擦。',
  },
  {
    id: 'orl-6', modelUrl: '/models/organ-lungs.glb', subject: '肺',
    category: '生物', optionType: 4,
    question: '血液由含氧少变为含氧多的部位是？',
    options: ['肺泡周围毛细血管', '组织周围毛细血管', '肾小球', '肝脏血窦'],
    correctIndex: 0,
    explanation: '在肺泡处氧气进入血液、二氧化碳排出，静脉血变为动脉血。',
  },
  {
    id: 'orl-7', modelUrl: '/models/organ-lungs.glb', subject: '肺',
    category: '生物', optionType: 2,
    question: '下列哪种气体是细胞呼吸产生的废物，需要由肺排出体外？',
    options: ['二氧化碳', '氧气'],
    correctIndex: 0,
    explanation: '细胞呼吸消耗氧气、产生二氧化碳，二氧化碳经血液运到肺排出。',
  },
  {
    id: 'orl-8', modelUrl: '/models/organ-lungs.glb', subject: '肺',
    category: '生物', optionType: 4,
    question: '人体最主要的呼吸肌包括？',
    options: ['膈肌和肋间肌', '肱二头肌和股四头肌', '眼轮匝肌', '咬肌'],
    correctIndex: 0,
    explanation: '膈肌和肋间肌的节律性收缩舒张驱动胸腔容积变化，完成呼吸。',
  },
];

const ORGAN_LIVER_QUESTIONS: QuizQuestion[] = [
  {
    id: 'orv-1', modelUrl: '/models/organ-liver.glb', subject: '肝脏',
    category: '生物', optionType: 2,
    question: '肝脏是人体内最大的什么器官？',
    options: ['消化腺（实质性器官）', '骨骼'],
    correctIndex: 0,
    explanation: '肝脏是人体最大的消化腺，重约 1.2-1.5 千克。',
  },
  {
    id: 'orv-2', modelUrl: '/models/organ-liver.glb', subject: '肝脏',
    category: '生物', optionType: 4,
    question: '肝脏分泌的消化液是？',
    options: ['胆汁', '胃液', '胰液', '唾液'],
    correctIndex: 0,
    explanation: '肝细胞分泌胆汁，储存于胆囊，经胆管排入十二指肠。',
  },
  {
    id: 'orv-3', modelUrl: '/models/organ-liver.glb', subject: '肝脏',
    category: '生物', optionType: 2,
    question: '胆汁对脂肪的主要作用是？',
    options: ['乳化脂肪（增大接触面积）', '直接分解脂肪为脂肪酸'],
    correctIndex: 0,
    explanation: '胆汁不含消化酶，通过乳化把脂肪变成微小颗粒，便于脂肪酶分解。',
  },
  {
    id: 'orv-4', modelUrl: '/models/organ-liver.glb', subject: '肝脏',
    category: '生物', optionType: 4,
    question: '肝脏把葡萄糖合成并储存起来的糖原是？',
    options: ['肝糖原', '肌糖原', '淀粉', '纤维素'],
    correctIndex: 0,
    explanation: '肝脏把多余葡萄糖合成肝糖原储存，血糖降低时再分解为葡萄糖。',
  },
  {
    id: 'orv-5', modelUrl: '/models/organ-liver.glb', subject: '肝脏',
    category: '生物', optionType: 4,
    question: '肝细胞中参与解毒作用（如代谢药物、酒精）的主要结构是？',
    options: ['滑面内质网', '线粒体', '核糖体', '溶酶体'],
    correctIndex: 0,
    explanation: '滑面内质网富含氧化酶等，参与药物、酒精和外源物的代谢解毒。',
  },
  {
    id: 'orv-6', modelUrl: '/models/organ-liver.glb', subject: '肝脏',
    category: '生物', optionType: 4,
    question: '肝脏合成的血浆蛋白中，与维持血浆渗透压关系最大的是？',
    options: ['白蛋白', '球蛋白', '纤维蛋白原', '血红蛋白'],
    correctIndex: 0,
    explanation: '白蛋白是血浆中含量最多的蛋白质，是血浆胶体渗透压的主要来源。',
  },
  {
    id: 'orv-7', modelUrl: '/models/organ-liver.glb', subject: '肝脏',
    category: '生物', optionType: 2,
    question: '严重肝病时出血倾向明显，主要原因是肝脏合成什么减少？',
    options: ['凝血因子（如凝血酶原）', '肾上腺素'],
    correctIndex: 0,
    explanation: '凝血因子大多由肝脏合成，肝功能下降会导致凝血障碍。',
  },
  {
    id: 'orv-8', modelUrl: '/models/organ-liver.glb', subject: '肝脏',
    category: '生物', optionType: 4,
    question: '使粪便呈黄褐色的胆红素，主要来源于什么的分解？',
    options: ['血红蛋白', '脂肪', '葡萄糖', '核酸'],
    correctIndex: 0,
    explanation: '衰老红细胞的血红蛋白分解产生胆红素，经肝脏代谢后排入肠道。',
  },
];

const ORGAN_KIDNEYS_QUESTIONS: QuizQuestion[] = [
  {
    id: 'ork-1', modelUrl: '/models/organ-kidneys.glb', subject: '肾脏',
    category: '生物', optionType: 4,
    question: '肾脏结构和功能的基本单位是？',
    options: ['肾单位', '肾小管', '肾小球', '集合管'],
    correctIndex: 0,
    explanation: '肾单位由肾小球、肾小囊和肾小管组成，是尿液生成的基本单位。',
  },
  {
    id: 'ork-2', modelUrl: '/models/organ-kidneys.glb', subject: '肾脏',
    category: '生物', optionType: 2,
    question: '血液在肾脏中形成原尿的场所是？',
    options: ['肾小球（滤过）', '肾小管（重吸收）'],
    correctIndex: 0,
    explanation: '血液流经肾小球时，除血细胞和大分子蛋白质外被滤过形成原尿。',
  },
  {
    id: 'ork-3', modelUrl: '/models/organ-kidneys.glb', subject: '肾脏',
    category: '生物', optionType: 4,
    question: '与原尿相比，血浆中几乎不进入原尿的成分是？',
    options: ['大分子蛋白质和血细胞', '葡萄糖', '无机盐', '水'],
    correctIndex: 0,
    explanation: '肾小球滤过膜阻止血细胞和大分子蛋白质通过，因此原尿中不含它们。',
  },
  {
    id: 'ork-4', modelUrl: '/models/organ-kidneys.glb', subject: '肾脏',
    category: '生物', optionType: 2,
    question: '健康人的尿液中通常不含葡萄糖，原因是？',
    options: ['肾小管将葡萄糖全部重吸收', '肾小球不滤过葡萄糖'],
    correctIndex: 0,
    explanation: '肾小球会滤过葡萄糖，但肾小管将其全部重吸收回血液。',
  },
  {
    id: 'ork-5', modelUrl: '/models/organ-kidneys.glb', subject: '肾脏',
    category: '生物', optionType: 4,
    question: '肾脏分泌的、能促进红细胞生成的激素是？',
    options: ['促红细胞生成素（EPO）', '胰岛素', '甲状腺激素', '醛固酮'],
    correctIndex: 0,
    explanation: '肾脏缺氧时分泌促红细胞生成素，刺激骨髓产生更多红细胞。',
  },
  {
    id: 'ork-6', modelUrl: '/models/organ-kidneys.glb', subject: '肾脏',
    category: '生物', optionType: 4,
    question: '肾素-血管紧张素系统主要参与调节什么？',
    options: ['血压和血容量', '体温', '血糖', '血钙'],
    correctIndex: 0,
    explanation: '该系统通过收缩血管和促进醛固酮分泌，升高血压、维持血容量。',
  },
  {
    id: 'ork-7', modelUrl: '/models/organ-kidneys.glb', subject: '肾脏',
    category: '生物', optionType: 2,
    question: '成人每天形成约 180 升原尿，但排尿仅约 1.5 升，原因是？',
    options: ['肾小管和集合管大量重吸收', '肾小球滤过量很少'],
    correctIndex: 0,
    explanation: '约 99% 的水分被肾小管、集合管重吸收回血液，所以排尿量大减。',
  },
  {
    id: 'ork-8', modelUrl: '/models/organ-kidneys.glb', subject: '肾脏',
    category: '生物', optionType: 4,
    question: '肾单位中紧贴肾小球、像小囊一样的结构是？',
    options: ['肾小囊（鲍曼囊）', '肾盂', '输尿管', '膀胱'],
    correctIndex: 0,
    explanation: '肾小囊包裹肾小球，两者合称肾小体，是滤过发生的部位。',
  },
];

const ORGAN_EYEBALL_QUESTIONS: QuizQuestion[] = [
  {
    id: 'ore-1', modelUrl: '/models/organ-eyeball.glb', subject: '眼球',
    category: '生物', optionType: 4,
    question: '外界光线进入眼球后，最先经过的结构是？',
    options: ['角膜', '晶状体', '玻璃体', '视网膜'],
    correctIndex: 0,
    explanation: '光线依次经过角膜→房水→瞳孔→晶状体→玻璃体→视网膜。',
  },
  {
    id: 'ore-2', modelUrl: '/models/organ-eyeball.glb', subject: '眼球',
    category: '生物', optionType: 2,
    question: '眼球中相当于照相机"镜头"、能改变曲度聚焦的结构是？',
    options: ['晶状体', '虹膜'],
    correctIndex: 0,
    explanation: '晶状体通过改变曲度调节焦距，使远近物体都能在视网膜上成像。',
  },
  {
    id: 'ore-3', modelUrl: '/models/organ-eyeball.glb', subject: '眼球',
    category: '生物', optionType: 4,
    question: '调节进入眼内光量的结构是？',
    options: ['虹膜（瞳孔）', '角膜', '巩膜', '睫状体'],
    correctIndex: 0,
    explanation: '虹膜中的平滑肌调节瞳孔大小：光强时瞳孔缩小，光弱时扩大。',
  },
  {
    id: 'ore-4', modelUrl: '/models/organ-eyeball.glb', subject: '眼球',
    category: '生物', optionType: 2,
    question: '视网膜上感光细胞的主要功能是？',
    options: ['感受光刺激并产生神经冲动', '分泌泪液'],
    correctIndex: 0,
    explanation: '感光细胞（视锥和视杆细胞）把光刺激转化为神经冲动传向大脑。',
  },
  {
    id: 'ore-5', modelUrl: '/models/organ-eyeball.glb', subject: '眼球',
    category: '生物', optionType: 4,
    question: '视神经离开眼球、没有感光细胞的部位是？',
    options: ['视神经盘（盲点）', '黄斑', '中央凹', '睫状体'],
    correctIndex: 0,
    explanation: '视神经盘处无感光细胞，落在该处的光线不能被感知，故称盲点。',
  },
  {
    id: 'ore-6', modelUrl: '/models/organ-eyeball.glb', subject: '眼球',
    category: '生物', optionType: 4,
    question: '关于近视，下列说法正确的是？',
    options: ['像落在视网膜前方，戴凹透镜矫正', '像落在视网膜后方，戴凸透镜矫正', '像正好落在视网膜上，无需矫正', '与晶状体曲度无关'],
    correctIndex: 0,
    explanation: '近视多因晶状体曲度过大或眼球前后径过长，像落于视网膜前方，用凹透镜矫正。',
  },
  {
    id: 'ore-7', modelUrl: '/models/organ-eyeball.glb', subject: '眼球',
    category: '生物', optionType: 2,
    question: '视网膜上负责最精细视觉（如阅读）的区域是？',
    options: ['黄斑（中央凹）', '视神经盘'],
    correctIndex: 0,
    explanation: '黄斑中央凹处视锥细胞最密集，视觉最敏锐。',
  },
  {
    id: 'ore-8', modelUrl: '/models/organ-eyeball.glb', subject: '眼球',
    category: '生物', optionType: 4,
    question: '眼球壁最外层坚韧、像"外壳"一样保护眼内的组织是？',
    options: ['巩膜', '脉络膜', '视网膜', '虹膜'],
    correctIndex: 0,
    explanation: '巩膜由致密结缔组织构成，就是我们俗称的"眼白"。',
  },
];

const ORGAN_INTESTINE_QUESTIONS: QuizQuestion[] = [
  {
    id: 'ori-1', modelUrl: '/models/organ-intestine.glb', subject: '肠',
    category: '生物', optionType: 4,
    question: '小肠内壁的环形皱襞和绒毛对消化吸收的作用是？',
    options: ['成倍增大消化吸收面积', '分泌胆汁', '储存粪便', '过滤血液'],
    correctIndex: 0,
    explanation: '皱襞、绒毛和微绒毛使小肠吸收面积达约 200 平方米。',
  },
  {
    id: 'ori-2', modelUrl: '/models/organ-intestine.glb', subject: '肠',
    category: '生物', optionType: 2,
    question: '小肠中把脂肪分解为脂肪酸和甘油酯的酶，主要来自哪里？',
    options: ['胰腺分泌的胰液（含脂肪酶）', '胃腺分泌的胃液'],
    correctIndex: 0,
    explanation: '胰液富含脂肪酶，经胰管进入十二指肠，在小肠中分解脂肪。',
  },
  {
    id: 'ori-3', modelUrl: '/models/organ-intestine.glb', subject: '肠',
    category: '生物', optionType: 4,
    question: '小肠吸收的葡萄糖、氨基酸等小分子营养，主要进入？',
    options: ['血液（毛细血管）', '淋巴管', '膀胱', '组织间隙直接利用'],
    correctIndex: 0,
    explanation: '水溶性小分子（葡萄糖、氨基酸、无机盐等）主要经毛细血管吸收。',
  },
  {
    id: 'ori-4', modelUrl: '/models/organ-intestine.glb', subject: '肠',
    category: '生物', optionType: 2,
    question: '大肠的主要功能是？',
    options: ['吸收水分、形成粪便', '分泌胃酸'],
    correctIndex: 0,
    explanation: '大肠吸收残余水分和无机盐，并储存、排出粪便。',
  },
  {
    id: 'ori-5', modelUrl: '/models/organ-intestine.glb', subject: '肠',
    category: '生物', optionType: 4,
    question: '成年人的小肠全长大约是？',
    options: ['约 1 米', '约 5-6 米', '约 15 米', '约 30 米'],
    correctIndex: 1,
    explanation: '成人小肠约 5-6 米，是消化道中最长的部分。',
  },
  {
    id: 'ori-6', modelUrl: '/models/organ-intestine.glb', subject: '肠',
    category: '生物', optionType: 4,
    question: '脂肪分解产物（脂肪酸、甘油一酯）吸收后主要进入？',
    options: ['淋巴管（乳糜管）', '毛细血管', '肾小管', '胆管'],
    correctIndex: 0,
    explanation: '脂肪消化产物在小肠绒毛内组装为乳糜微粒，主要经淋巴管运输。',
  },
  {
    id: 'ori-7', modelUrl: '/models/organ-intestine.glb', subject: '肠',
    category: '生物', optionType: 2,
    question: '小肠绒毛的核心作用是？',
    options: ['增大营养吸收面积', '分泌胆汁'],
    correctIndex: 0,
    explanation: '绒毛内富含毛细血管和乳糜管，是吸收营养的主要结构。',
  },
  {
    id: 'ori-8', modelUrl: '/models/organ-intestine.glb', subject: '肠',
    category: '生物', optionType: 4,
    question: '淀粉在口腔中就开始被分解，这依靠的是什么酶？',
    options: ['唾液淀粉酶', '胃蛋白酶', '胰脂肪酶', '溶菌酶'],
    correctIndex: 0,
    explanation: '唾液腺分泌的唾液淀粉酶在口腔把淀粉初步分解为麦芽糖。',
  },
];

const ORGAN_PANCREAS_QUESTIONS: QuizQuestion[] = [
  {
    id: 'orp-1', modelUrl: '/models/organ-pancreas.glb', subject: '胰腺',
    category: '生物', optionType: 4,
    question: '胰腺中分泌胰岛素的结构是？',
    options: ['胰岛（胰岛 β 细胞）', '腺泡细胞', '胰管', '胆囊'],
    correctIndex: 0,
    explanation: '胰岛是胰腺的内分泌部分，其中 β 细胞分泌胰岛素。',
  },
  {
    id: 'orp-2', modelUrl: '/models/organ-pancreas.glb', subject: '胰腺',
    category: '生物', optionType: 2,
    question: '胰岛素对血糖的作用是？',
    options: ['降低血糖', '升高血糖'],
    correctIndex: 0,
    explanation: '胰岛素促进细胞摄取和利用葡萄糖，并促进糖原合成，使血糖降低。',
  },
  {
    id: 'orp-3', modelUrl: '/models/organ-pancreas.glb', subject: '胰腺',
    category: '生物', optionType: 4,
    question: '由胰岛 α 细胞分泌、能升高血糖的激素是？',
    options: ['胰高血糖素', '胰岛素', '甲状腺激素', '生长激素'],
    correctIndex: 0,
    explanation: '胰高血糖素促进肝糖原分解为葡萄糖，使血糖升高，与胰岛素相互拮抗。',
  },
  {
    id: 'orp-4', modelUrl: '/models/organ-pancreas.glb', subject: '胰腺',
    category: '生物', optionType: 2,
    question: '胰腺的外分泌部分分泌的消化液是？',
    options: ['胰液（含多种消化酶）', '胃酸'],
    correctIndex: 0,
    explanation: '胰腺腺泡细胞分泌胰液，含淀粉酶、脂肪酶、蛋白酶等多种酶。',
  },
  {
    id: 'orp-5', modelUrl: '/models/organ-pancreas.glb', subject: '胰腺',
    category: '生物', optionType: 4,
    question: '胰液排入消化道的通道是？',
    options: ['胰管（开口于十二指肠）', '胆管直接入胃', '淋巴管', '肾盂'],
    correctIndex: 0,
    explanation: '胰管与胆总管汇合后共同开口于十二指肠乳头，胰液由此进入小肠。',
  },
  {
    id: 'orp-6', modelUrl: '/models/organ-pancreas.glb', subject: '胰腺',
    category: '生物', optionType: 4,
    question: '胰液中负责把淀粉分解为麦芽糖的酶是？',
    options: ['胰淀粉酶', '胃蛋白酶', '溶菌酶', '乳糖酶'],
    correctIndex: 0,
    explanation: '胰淀粉酶进入小肠后继续分解淀粉，与唾液淀粉酶协同完成淀粉消化。',
  },
  {
    id: 'orp-7', modelUrl: '/models/organ-pancreas.glb', subject: '胰腺',
    category: '生物', optionType: 2,
    question: '糖尿病最常见的发病原因是？',
    options: ['胰岛素分泌不足或作用障碍', '甲状腺激素分泌过多'],
    correctIndex: 0,
    explanation: '糖尿病主要因胰岛 β 细胞受损（1 型）或胰岛素抵抗（2 型）导致血糖升高。',
  },
  {
    id: 'orp-8', modelUrl: '/models/organ-pancreas.glb', subject: '胰腺',
    category: '生物', optionType: 4,
    question: '胰腺在人体中的位置是？',
    options: ['腹腔上部、胃的后方', '胸腔内', '盆腔内', '颅腔内'],
    correctIndex: 0,
    explanation: '胰腺横卧于腹腔上部、胃的后方，属于腹膜后位器官。',
  },
];

const ORGAN_SKIN_QUESTIONS: QuizQuestion[] = [
  {
    id: 'ors-1', modelUrl: '/models/organ-skin.glb', subject: '皮肤',
    category: '生物', optionType: 4,
    question: '皮肤从外到内依次由哪些结构组成？',
    options: ['表皮、真皮、皮下组织', '真皮、表皮、皮下组织', '皮下组织、真皮、表皮', '表皮、皮下组织、真皮'],
    correctIndex: 0,
    explanation: '皮肤由表皮、真皮和皮下组织三层构成，表皮在最外层。',
  },
  {
    id: 'ors-2', modelUrl: '/models/organ-skin.glb', subject: '皮肤',
    category: '生物', optionType: 2,
    question: '产生黑色素、决定皮肤颜色的细胞位于皮肤的哪一层？',
    options: ['表皮（黑素细胞）', '真皮'],
    correctIndex: 0,
    explanation: '黑素细胞位于表皮基底层，合成的黑色素决定肤色并阻挡紫外线。',
  },
  {
    id: 'ors-3', modelUrl: '/models/organ-skin.glb', subject: '皮肤',
    category: '生物', optionType: 4,
    question: '天气炎热时，皮肤调节体温的主要方式是？',
    options: ['汗腺分泌汗液蒸发散热', '皮肤增厚保温', '毛孔完全闭合', '停止血液流动'],
    correctIndex: 0,
    explanation: '汗液蒸发带走大量热量；同时皮肤血管扩张、血流增多加速散热。',
  },
  {
    id: 'ors-4', modelUrl: '/models/organ-skin.glb', subject: '皮肤',
    category: '生物', optionType: 2,
    question: '皮肤感受"热"和"痛"的神经末梢主要分布在？',
    options: ['真皮', '角质层'],
    correctIndex: 0,
    explanation: '真皮层富含血管、神经末梢和感受器，负责感觉传导。',
  },
  {
    id: 'ors-5', modelUrl: '/models/organ-skin.glb', subject: '皮肤',
    category: '生物', optionType: 4,
    question: '皮肤最表层由死亡角化细胞构成、起保护作用的部分是？',
    options: ['角质层', '生发层', '乳头层', '网状层'],
    correctIndex: 0,
    explanation: '角质层细胞角化死亡、不断脱落更新，是皮肤的重要屏障。',
  },
  {
    id: 'ors-6', modelUrl: '/models/organ-skin.glb', subject: '皮肤',
    category: '生物', optionType: 4,
    question: '皮脂腺分泌的皮脂主要作用是？',
    options: ['润滑皮肤和毛发、抑制细菌', '合成维生素 D', '储存大量脂肪', '排出尿素'],
    correctIndex: 0,
    explanation: '皮脂滋润皮肤毛发并形成弱酸性膜，抑制部分细菌生长。',
  },
  {
    id: 'ors-7', modelUrl: '/models/organ-skin.glb', subject: '皮肤',
    category: '生物', optionType: 2,
    question: '皮肤中包绕毛发根部、使毛发得以生长的结构是？',
    options: ['毛囊', '汗腺导管'],
    correctIndex: 0,
    explanation: '毛囊是毛根所在的结构，毛发生长和脱落都发生在毛囊中。',
  },
  {
    id: 'ors-8', modelUrl: '/models/organ-skin.glb', subject: '皮肤',
    category: '生物', optionType: 4,
    question: '皮肤在阳光照射下可以合成的维生素是？',
    options: ['维生素 D', '维生素 A', '维生素 C', '维生素 B12'],
    correctIndex: 0,
    explanation: '皮肤中的 7-脱氢胆固醇经紫外线照射转化为维生素 D，促进钙吸收。',
  },
];

// ─────────────── 题 库 合 并 ───────────────
// ─────────────── 扩 充 题 库（每模型补至 14 题） ───────────────
const CHEMISTRY_EXTRA_QUESTIONS: QuizQuestion[] = [
  // ── 金刚石（dia-9 ~ dia-14）──
  {
    id: 'dia-9', modelUrl: '/models/diamond.glb', subject: '金刚石模型',
    category: '化学', optionType: 4,
    question: '金刚石中碳原子的杂化方式是什么？',
    options: ['sp 杂化', 'sp² 杂化', 'sp³ 杂化', 'sp³d 杂化'],
    correctIndex: 2,
    explanation: '金刚石中每个碳原子与周围 4 个碳原子形成 4 条单键，采用 sp³ 杂化，构成正四面体结构。',
  },
  {
    id: 'dia-10', modelUrl: '/models/diamond.glb', subject: '金刚石模型',
    category: '化学', optionType: 2,
    question: '金刚石是自然界硬度最大的物质，主要原因是什么？',
    options: ['碳原子间以共价键连接成三维网状结构', '碳原子间靠分子间作用力堆积'],
    correctIndex: 0,
    explanation: '金刚石中全部碳原子通过共价键连成致密的三维网状结构，破坏它需要断裂大量共价键，所以硬度极大。',
  },
  {
    id: 'dia-11', modelUrl: '/models/diamond.glb', subject: '金刚石模型',
    category: '化学', optionType: 4,
    question: '天然金刚石主要产自哪一类岩石中？',
    options: ['金伯利岩', '玄武岩', '花岗岩', '石灰岩'],
    correctIndex: 0,
    explanation: '天然金刚石主要赋存于金伯利岩（火山岩管）中，由地球深部高温高压条件形成。',
  },
  {
    id: 'dia-12', modelUrl: '/models/diamond.glb', subject: '金刚石模型',
    category: '化学', optionType: 4,
    question: '金刚石与石墨都是由碳元素组成的单质，它们之间的关系是？',
    options: ['同素异形体', '同位素', '同分异构体', '同系物'],
    correctIndex: 0,
    explanation: '由同种元素组成的不同单质互为同素异形体，金刚石和石墨就是碳的两种同素异形体。',
  },
  {
    id: 'dia-13', modelUrl: '/models/diamond.glb', subject: '金刚石模型',
    category: '化学', optionType: 4,
    question: '金刚石属于哪一类晶体？',
    options: ['原子晶体', '离子晶体', '分子晶体', '金属晶体'],
    correctIndex: 0,
    explanation: '金刚石中原子间以共价键连接成空间网状结构，属于典型的原子晶体。',
  },
  {
    id: 'dia-14', modelUrl: '/models/diamond.glb', subject: '金刚石模型',
    category: '化学', optionType: 4,
    question: '工业上人造金刚石通常采用什么方法制备？',
    options: ['石墨在高温高压下转化', '电解食盐水', '加热研磨碳粉', '低温结晶碳'],
    correctIndex: 0,
    explanation: '工业上常用石墨在高温（约 1600℃）高压（5~10 GPa）条件下转化为金刚石，也可用化学气相沉积法。',
  },
  // ── 金刚石晶胞（duc-9 ~ duc-14）──
  {
    id: 'duc-9', modelUrl: '/models/diamond-unit-cell_NIH3D.glb', subject: '金刚石晶胞',
    category: '化学', optionType: 4,
    question: '一个金刚石晶胞中实际含有多少个碳原子？',
    options: ['4 个', '6 个', '8 个', '10 个'],
    correctIndex: 2,
    explanation: '金刚石晶胞是面心立方结构，8 个顶角碳（各贡献 1/8）、6 个面心碳（各贡献 1/2），另有 4 个位于体内的碳原子，合计 8 个。',
  },
  {
    id: 'duc-10', modelUrl: '/models/diamond-unit-cell_NIH3D.glb', subject: '金刚石晶胞',
    category: '化学', optionType: 4,
    question: '金刚石晶胞中，每个碳原子周围最近邻的碳原子有几个？',
    options: ['2 个', '4 个', '6 个', '8 个'],
    correctIndex: 1,
    explanation: '金刚石中每个碳原子与相邻 4 个碳原子形成正四面体排布，配位数为 4。',
  },
  {
    id: 'duc-11', modelUrl: '/models/diamond-unit-cell_NIH3D.glb', subject: '金刚石晶胞',
    category: '化学', optionType: 4,
    question: '金刚石晶胞可以看成由两个什么样的子晶格相互穿插而成？',
    options: ['两个面心立方晶格沿体对角线错开 1/4', '两个体心立方晶格', '两个简单立方晶格', '两个六方晶格'],
    correctIndex: 0,
    explanation: '金刚石结构可看作两个面心立方子晶格沿体对角线方向平移 1/4 对角线长度后相互穿插而成。',
  },
  {
    id: 'duc-12', modelUrl: '/models/diamond-unit-cell_NIH3D.glb', subject: '金刚石晶胞',
    category: '化学', optionType: 4,
    question: '金刚石晶胞中碳碳单键的键长大约是多少？',
    options: ['0.154 nm', '0.246 nm', '0.10 nm', '0.50 nm'],
    correctIndex: 0,
    explanation: '金刚石中 C–C 单键键长约 0.154 nm（1.54 Å），是典型的共价单键键长。',
  },
  {
    id: 'duc-13', modelUrl: '/models/diamond-unit-cell_NIH3D.glb', subject: '金刚石晶胞',
    category: '化学', optionType: 2,
    question: '金刚石晶胞的堆积方式属于哪种晶系？',
    options: ['立方晶系（面心立方）', '六方晶系'],
    correctIndex: 0,
    explanation: '金刚石晶胞属于立方晶系，为面心立方结构，但比普通面心立方多了 4 个体对角线 1/4 处的碳原子。',
  },
  {
    id: 'duc-14', modelUrl: '/models/diamond-unit-cell_NIH3D.glb', subject: '金刚石晶胞',
    category: '化学', optionType: 4,
    question: '在金刚石晶胞中，位于体对角线 1/4 处的 4 个碳原子属于？',
    options: ['晶胞内部的原子', '顶角原子', '面心原子', '棱上原子'],
    correctIndex: 0,
    explanation: '这 4 个碳原子完全位于晶胞内部，不与其他晶胞共享，因此每个晶胞完整拥有它们。',
  },
  // ── 1,4-二氯甲基苯（pub-9 ~ pub-14）──
  {
    id: 'pub-9', modelUrl: '/models/pubchem-6233-bas-color-print_NIH3D.glb', subject: '1,4-二氯甲基苯',
    category: '化学', optionType: 4,
    question: '二氯甲苯的分子式是什么？',
    options: ['C₇H₆Cl₂', 'C₆H₄Cl₂', 'C₇H₈Cl₂', 'C₆H₆Cl₂'],
    correctIndex: 0,
    explanation: '甲苯分子式为 C₇H₈，苯环上两个氢被氯取代后为 C₇H₆Cl₂。',
  },
  {
    id: 'pub-10', modelUrl: '/models/pubchem-6233-bas-color-print_NIH3D.glb', subject: '1,4-二氯甲基苯',
    category: '化学', optionType: 4,
    question: '二氯甲苯属于哪一类有机物？',
    options: ['卤代烃', '醇', '醛', '羧酸'],
    correctIndex: 0,
    explanation: '二氯甲苯分子中含有氯原子，属于卤代烃，且保留了苯环和甲基结构。',
  },
  {
    id: 'pub-11', modelUrl: '/models/pubchem-6233-bas-color-print_NIH3D.glb', subject: '1,4-二氯甲基苯',
    category: '化学', optionType: 4,
    question: '甲苯苯环上的二氯代物（只考虑苯环上取代）共有几种位置异构体？',
    options: ['3 种', '4 种', '6 种', '8 种'],
    correctIndex: 2,
    explanation: '考虑甲基的邻、间、对位关系，甲苯苯环上的二氯代物共有 6 种位置异构体。',
  },
  {
    id: 'pub-12', modelUrl: '/models/pubchem-6233-bas-color-print_NIH3D.glb', subject: '1,4-二氯甲基苯',
    category: '化学', optionType: 4,
    question: '甲基是给电子基团，会使苯环的亲电取代反应主要发生在什么位置？',
    options: ['邻位和对位', '间位', '任意位置', '不发生反应'],
    correctIndex: 0,
    explanation: '甲基属于邻对位定位基，能活化苯环，使后续取代主要发生在甲基的邻位和对位。',
  },
  {
    id: 'pub-13', modelUrl: '/models/pubchem-6233-bas-color-print_NIH3D.glb', subject: '1,4-二氯甲基苯',
    category: '化学', optionType: 2,
    question: '卤代烃在氢氧化钠水溶液中加热，发生什么反应？',
    options: ['水解反应（生成醇）', '消去反应（生成烯烃）'],
    correctIndex: 0,
    explanation: '卤代烃在 NaOH 水溶液中加热发生水解反应，卤原子被羟基取代生成醇；在 NaOH 醇溶液中加热则发生消去反应。',
  },
  {
    id: 'pub-14', modelUrl: '/models/pubchem-6233-bas-color-print_NIH3D.glb', subject: '1,4-二氯甲基苯',
    category: '化学', optionType: 4,
    question: '与甲苯相比，二氯甲苯的沸点通常？',
    options: ['更高', '更低', '几乎相同', '无法比较'],
    correctIndex: 0,
    explanation: '二氯甲苯分子量更大、极性更强，分子间作用力增大，因此沸点高于甲苯。',
  },
  // ── NaCl（nacl-9 ~ nacl-14）──
  {
    id: 'nacl-9', modelUrl: '/models/nacl-crystal.glb', subject: 'NaCl 离子晶体',
    category: '化学', optionType: 4,
    question: '在 NaCl 晶体中，Na⁺ 和 Cl⁻ 的配位数分别是多少？',
    options: ['均为 6', '均为 4', 'Na⁺ 为 4，Cl⁻ 为 6', 'Na⁺ 为 6，Cl⁻ 为 4'],
    correctIndex: 0,
    explanation: 'NaCl 晶体中每个 Na⁺ 周围紧邻 6 个 Cl⁻，每个 Cl⁻ 周围紧邻 6 个 Na⁺，配位数均为 6。',
  },
  {
    id: 'nacl-10', modelUrl: '/models/nacl-crystal.glb', subject: 'NaCl 离子晶体',
    category: '化学', optionType: 4,
    question: '一个 NaCl 晶胞中实际含有 Na⁺ 和 Cl⁻ 各多少个？',
    options: ['各 4 个', '各 6 个', 'Na⁺ 4 个、Cl⁻ 8 个', '各 8 个'],
    correctIndex: 0,
    explanation: 'NaCl 晶胞中 Na⁺ 位于棱心和体心（4 个），Cl⁻ 位于顶角和面心（也是 4 个），化学计量比为 1:1。',
  },
  {
    id: 'nacl-11', modelUrl: '/models/nacl-crystal.glb', subject: 'NaCl 离子晶体',
    category: '化学', optionType: 4,
    question: 'NaCl 的熔点约为多少？',
    options: ['801 ℃', '100 ℃', '1500 ℃', '50 ℃'],
    correctIndex: 0,
    explanation: 'NaCl 是离子晶体，离子键较强，熔点约 801 ℃。',
  },
  {
    id: 'nacl-12', modelUrl: '/models/nacl-crystal.glb', subject: 'NaCl 离子晶体',
    category: '化学', optionType: 4,
    question: 'NaCl 熔点较高的根本原因是什么？',
    options: ['阴阳离子间存在强烈的离子键', '分子间存在氢键', '共价键强度大', '金属键强度大'],
    correctIndex: 0,
    explanation: 'NaCl 由 Na⁺ 和 Cl⁻ 通过强烈的离子键结合，熔化需要克服离子键，故熔点高。',
  },
  {
    id: 'nacl-13', modelUrl: '/models/nacl-crystal.glb', subject: 'NaCl 离子晶体',
    category: '化学', optionType: 4,
    question: '熔融状态的 NaCl 能够导电，原因是？',
    options: ['存在自由移动的 Na⁺ 和 Cl⁻', '存在自由电子', '存在自由移动的分子', '存在空穴'],
    correctIndex: 0,
    explanation: '熔融后离子键被破坏，Na⁺ 和 Cl⁻ 可以自由移动，因此能导电；而固态 NaCl 离子不能自由移动，不导电。',
  },
  {
    id: 'nacl-14', modelUrl: '/models/nacl-crystal.glb', subject: 'NaCl 离子晶体',
    category: '化学', optionType: 2,
    question: 'NaCl 晶体属于哪一类晶体？',
    options: ['离子晶体', '分子晶体'],
    correctIndex: 0,
    explanation: 'NaCl 由阴、阳离子通过离子键结合而成，属于典型的离子晶体。',
  },
  // ── SiO₂（sio2-9 ~ sio2-14）──
  {
    id: 'sio2-9', modelUrl: '/models/sio2-crystal.glb', subject: 'SiO₂ 二氧化硅',
    category: '化学', optionType: 4,
    question: '在 SiO₂ 晶体中，每个硅原子与几个氧原子相连？',
    options: ['2 个', '4 个', '6 个', '8 个'],
    correctIndex: 1,
    explanation: 'SiO₂ 中每个 Si 与 4 个 O 形成 Si–O 四面体，同时每个 O 与 2 个 Si 相连。',
  },
  {
    id: 'sio2-10', modelUrl: '/models/sio2-crystal.glb', subject: 'SiO₂ 二氧化硅',
    category: '化学', optionType: 2,
    question: '二氧化硅晶体属于哪一类晶体？',
    options: ['原子晶体', '分子晶体'],
    correctIndex: 0,
    explanation: 'SiO₂ 中硅氧原子以共价键连成三维网状结构，属于原子晶体，熔点很高。',
  },
  {
    id: 'sio2-11', modelUrl: '/models/sio2-crystal.glb', subject: 'SiO₂ 二氧化硅',
    category: '化学', optionType: 4,
    question: '石英、水晶的主要化学成分是什么？',
    options: ['SiO₂', 'CaCO₃', 'Na₂SiO₃', 'SiC'],
    correctIndex: 0,
    explanation: '石英、水晶、玛瑙等的主要成分都是二氧化硅 SiO₂。',
  },
  {
    id: 'sio2-12', modelUrl: '/models/sio2-crystal.glb', subject: 'SiO₂ 二氧化硅',
    category: '化学', optionType: 4,
    question: 'SiO₂ 能与氢氟酸反应生成什么？',
    options: ['SiF₄ 和水', 'SiCl₄ 和水', 'SiH₄ 和氧气', 'SiO 和氢气'],
    correctIndex: 0,
    explanation: 'SiO₂ + 4HF → SiF₄↑ + 2H₂O，因此氢氟酸能腐蚀玻璃，常用来雕刻玻璃。',
  },
  {
    id: 'sio2-13', modelUrl: '/models/sio2-crystal.glb', subject: 'SiO₂ 二氧化硅',
    category: '化学', optionType: 4,
    question: '光导纤维的主要原料是什么？',
    options: ['高纯二氧化硅', '聚乙烯', '玻璃钢', '碳纤维'],
    correctIndex: 0,
    explanation: '光导纤维由高纯 SiO₂ 制成，利用光在光纤内全反射传输信息。',
  },
  {
    id: 'sio2-14', modelUrl: '/models/sio2-crystal.glb', subject: 'SiO₂ 二氧化硅',
    category: '化学', optionType: 4,
    question: '普通玻璃的主要成分之一是？',
    options: ['SiO₂', 'CaO', 'NaCl', 'Al₂O₃'],
    correctIndex: 0,
    explanation: '普通玻璃是 Na₂SiO₃、CaSiO₃ 和 SiO₂ 的混合物，其中 SiO₂ 是主要成分之一。',
  },
  // ── 硝基苯（nitro-9 ~ nitro-14）──
  {
    id: 'nitro-9', modelUrl: '/models/7416-bas-color-print_NIH3D.glb', subject: '硝基苯',
    category: '化学', optionType: 4,
    question: '硝基苯的分子式是什么？',
    options: ['C₆H₅NO₂', 'C₆H₆O₂', 'C₅H₅NO₂', 'C₆H₄N₂O₄'],
    correctIndex: 0,
    explanation: '硝基苯由苯环和硝基（-NO₂）组成，分子式为 C₆H₅NO₂。',
  },
  {
    id: 'nitro-10', modelUrl: '/models/7416-bas-color-print_NIH3D.glb', subject: '硝基苯',
    category: '化学', optionType: 4,
    question: '实验室制备硝基苯的原料是什么？',
    options: ['苯和浓硝酸（浓硫酸作催化剂）', '苯酚和浓硝酸', '甲苯和稀硝酸', '苯和氨水'],
    correctIndex: 0,
    explanation: '苯与浓硝酸在浓硫酸催化、50~60 ℃水浴加热条件下发生硝化反应生成硝基苯。',
  },
  {
    id: 'nitro-11', modelUrl: '/models/7416-bas-color-print_NIH3D.glb', subject: '硝基苯',
    category: '化学', optionType: 4,
    question: '下列关于硝基苯物理性质的描述正确的是？',
    options: ['密度比水大，有苦杏仁气味', '密度比水小，无色无味', '易溶于水', '常温下是气体'],
    correctIndex: 0,
    explanation: '硝基苯是浅黄色油状液体，密度大于水，具有苦杏仁气味，难溶于水。',
  },
  {
    id: 'nitro-12', modelUrl: '/models/7416-bas-color-print_NIH3D.glb', subject: '硝基苯',
    category: '化学', optionType: 2,
    question: '硝基（-NO₂）对苯环来说属于哪种性质的基团？',
    options: ['吸电子基团', '给电子基团'],
    correctIndex: 0,
    explanation: '硝基是强吸电子基团，会使苯环电子云密度降低，钝化苯环，使亲电取代反应变难。',
  },
  {
    id: 'nitro-13', modelUrl: '/models/7416-bas-color-print_NIH3D.glb', subject: '硝基苯',
    category: '化学', optionType: 4,
    question: '硝基苯对人体主要损害哪个系统？',
    options: ['血液和神经系统', '骨骼系统', '皮肤表层', '毛发生长'],
    correctIndex: 0,
    explanation: '硝基苯有毒，能经皮肤吸收，主要损害血液（形成高铁血红蛋白）和神经系统，使用时要防护。',
  },
  {
    id: 'nitro-14', modelUrl: '/models/7416-bas-color-print_NIH3D.glb', subject: '硝基苯',
    category: '化学', optionType: 4,
    question: '硝基苯的硝化反应需要在什么条件下进行？',
    options: ['50~60 ℃水浴加热', '常温静置', '0 ℃冰浴', '直接加热到沸腾'],
    correctIndex: 0,
    explanation: '硝化反应放热明显，需在 50~60 ℃水浴中控温，防止温度过高生成二硝基苯等副产物。',
  },
];

const GEOGRAPHY_EXTRA_QUESTIONS: QuizQuestion[] = [
  // ── 地球内部结构（earth-9 ~ earth-14）──
  {
    id: 'earth-9', modelUrl: '/models/earth-layers.glb', subject: '地球内部结构',
    category: '地理', optionType: 4,
    question: '地球最外层的固体壳层是什么？',
    options: ['地壳', '地幔', '外核', '岩石圈'],
    correctIndex: 0,
    explanation: '地壳是地球最外层的薄薄固体壳层，大陆地壳平均厚约 33 km，大洋地壳平均约 6 km。',
  },
  {
    id: 'earth-10', modelUrl: '/models/earth-layers.glb', subject: '地球内部结构',
    category: '地理', optionType: 4,
    question: '一般认为岩浆的发源地是哪个圈层？',
    options: ['上地幔上部的软流层', '地壳表层', '外核', '下地幔底部'],
    correctIndex: 0,
    explanation: '上地幔上部存在软流层，温度高、物质部分熔融，被认为是岩浆的主要发源地。',
  },
  {
    id: 'earth-11', modelUrl: '/models/earth-layers.glb', subject: '地球内部结构',
    category: '地理', optionType: 4,
    question: '地球磁场主要与哪个圈层有关？',
    options: ['外核中液态铁镍的对流', '地壳中的岩石', '地幔中的岩浆', '大气层'],
    correctIndex: 0,
    explanation: '外核主要由液态铁镍组成，其流动产生的电流效应形成了地球磁场（发电机理论）。',
  },
  {
    id: 'earth-12', modelUrl: '/models/earth-layers.glb', subject: '地球内部结构',
    category: '地理', optionType: 2,
    question: '关于地壳厚度，下列说法正确的是？',
    options: ['大陆地壳比大洋地壳厚', '大洋地壳比大陆地壳厚'],
    correctIndex: 0,
    explanation: '大陆地壳平均厚约 33 km，大洋地壳平均仅约 6 km，大陆地壳明显更厚。',
  },
  {
    id: 'earth-13', modelUrl: '/models/earth-layers.glb', subject: '地球内部结构',
    category: '地理', optionType: 4,
    question: '地震波中的横波（S 波）无法通过地球哪个圈层？',
    options: ['外核', '地壳', '上地幔', '下地幔'],
    correctIndex: 0,
    explanation: '横波只能在固体中传播，外核是液态的，横波无法穿过，因此科学家推断外核为液态。',
  },
  {
    id: 'earth-14', modelUrl: '/models/earth-layers.glb', subject: '地球内部结构',
    category: '地理', optionType: 4,
    question: '岩石圈包括哪两部分？',
    options: ['地壳和上地幔顶部（软流层以上）', '地壳和整个地幔', '上地幔和下地幔', '地壳和地核'],
    correctIndex: 0,
    explanation: '岩石圈由地壳和上地幔顶部（软流层以上的坚硬部分）组成，是板块构造的载体。',
  },
  // ── 地形地貌（terr-9 ~ terr-14）──
  {
    id: 'terr-9', modelUrl: '/models/terrain-topography.glb', subject: '地形地貌',
    category: '地理', optionType: 4,
    question: '喀斯特地貌（溶洞、峰林）主要由哪类岩石被水溶蚀形成？',
    options: ['石灰岩', '花岗岩', '玄武岩', '砂岩'],
    correctIndex: 0,
    explanation: '石灰岩（碳酸钙）易被含二氧化碳的水溶解，长期溶蚀形成溶洞、峰林等喀斯特地貌。',
  },
  {
    id: 'terr-10', modelUrl: '/models/terrain-topography.glb', subject: '地形地貌',
    category: '地理', optionType: 4,
    question: '黄土高原厚厚的黄土主要是怎样形成的？',
    options: ['风力搬运堆积', '河流搬运堆积', '冰川搬运堆积', '火山喷发堆积'],
    correctIndex: 0,
    explanation: '黄土高原的黄土被认为是强劲的西北风从荒漠地区搬运来的粉砂、尘土堆积而成（风成说）。',
  },
  {
    id: 'terr-11', modelUrl: '/models/terrain-topography.glb', subject: '地形地貌',
    category: '地理', optionType: 4,
    question: '河流入海口附近常形成什么地貌？',
    options: ['三角洲', '峡谷', '沙丘', '冰斗'],
    correctIndex: 0,
    explanation: '河流携带泥沙在入海口流速骤减，泥沙沉积形成三角洲，如长江三角洲。',
  },
  {
    id: 'terr-12', modelUrl: '/models/terrain-topography.glb', subject: '地形地貌',
    category: '地理', optionType: 2,
    question: '冰川侵蚀形成的典型谷地形态是？',
    options: ['U 形谷', 'V 形谷'],
    correctIndex: 0,
    explanation: '冰川侵蚀形成宽缓的 U 形谷；流水侵蚀形成陡深的 V 形谷。',
  },
  {
    id: 'terr-13', modelUrl: '/models/terrain-topography.glb', subject: '地形地貌',
    category: '地理', optionType: 4,
    question: '丹霞地貌（红色陡崖）主要由什么岩石构成？',
    options: ['红色砂砾岩', '灰色石灰岩', '黑色玄武岩', '白色大理岩'],
    correctIndex: 0,
    explanation: '丹霞地貌由红色砂砾岩经流水侵蚀、风化等作用发育而成，如广东丹霞山。',
  },
  {
    id: 'terr-14', modelUrl: '/models/terrain-topography.glb', subject: '地形地貌',
    category: '地理', optionType: 4,
    question: '火山地貌的典型标志是什么？',
    options: ['火山锥和火山口', '溶洞', '冲积扇', '海蚀崖'],
    correctIndex: 0,
    explanation: '火山喷发物堆积形成火山锥，顶部凹陷为火山口，两者是火山地貌的典型标志。',
  },
];

const KIDS_EXTRA_QUESTIONS: QuizQuestion[] = [
  // ── 蓝精灵（lanjingling-11 ~ lanjingling-14）──
  {
    id: 'lanjingling-11', modelUrl: '/models/lanjingling.glb', subject: '蓝精灵',
    category: '少儿兴趣', optionType: 4,
    question: '蓝精灵们住在森林里的什么房子里？',
    options: ['蘑菇屋', '树洞屋', '石头城堡', '冰屋'],
    correctIndex: 0,
    explanation: '蓝精灵们住在森林中一朵朵蘑菇形状的小屋里，蘑菇屋是他们的经典家园。',
  },
  {
    id: 'lanjingling-12', modelUrl: '/models/lanjingling.glb', subject: '蓝精灵',
    category: '少儿兴趣', optionType: 4,
    question: '格格巫身边总跟着一只什么动物？',
    options: ['阿兹猫', '汪汪狗', '大灰狼', '红狐狸'],
    correctIndex: 0,
    explanation: '格格巫的跟班是一只叫"阿兹猫"的猫，经常被格格巫当出气筒。',
  },
  {
    id: 'lanjingling-13', modelUrl: '/models/lanjingling.glb', subject: '蓝精灵',
    category: '少儿兴趣', optionType: 4,
    question: '蓝爸爸（蓝精灵村的领袖）最明显的特征是什么？',
    options: ['红裤子配红帽子、白胡子', '戴一副黑框眼镜', '手里总拿个放大镜', '头上有根天线'],
    correctIndex: 0,
    explanation: '蓝爸爸穿着红裤子红帽子，留着长长的白胡子，是最年长的蓝精灵，全村都听他的。',
  },
  {
    id: 'lanjingling-14', modelUrl: '/models/lanjingling.glb', subject: '蓝精灵',
    category: '少儿兴趣', optionType: 4,
    question: '格格巫抓蓝精灵最主要的目的是什么？',
    options: ['用蓝精灵提炼魔法药水', '请他们帮忙做家务', '让他们当宠物', '和他们比赛'],
    correctIndex: 0,
    explanation: '格格巫一直想抓住蓝精灵，用他们提炼精华来炼制魔法药水，但每次都被机智的蓝精灵们打败。',
  },
  // ── 奈李（naili-11 ~ naili-14）──
  {
    id: 'naili-11', modelUrl: '/models/naili.glb', subject: '奈李',
    category: '少儿兴趣', optionType: 4,
    question: '奈李一般在什么季节成熟？',
    options: ['夏季（7~8 月）', '春季（3~4 月）', '秋季（10~11 月）', '冬季（12~1 月）'],
    correctIndex: 0,
    explanation: '奈李通常在夏季 7~8 月成熟上市，正是炎炎夏日里解暑的水果。',
  },
  {
    id: 'naili-12', modelUrl: '/models/naili.glb', subject: '奈李',
    category: '少儿兴趣', optionType: 2,
    question: '从植物学分类看，奈李属于哪一类果实？',
    options: ['核果', '浆果'],
    correctIndex: 0,
    explanation: '奈李是李属植物的果实，外果皮薄、中果皮肉质、内果皮形成坚硬的核，属于核果。',
  },
  {
    id: 'naili-13', modelUrl: '/models/naili.glb', subject: '奈李',
    category: '少儿兴趣', optionType: 4,
    question: '成熟奈李的果皮颜色通常是？',
    options: ['黄绿色（黄金奈李）或紫红色', '纯白色', '黑色', '蓝色'],
    correctIndex: 0,
    explanation: '奈李品种多样，常见的有黄绿色的黄金奈李和紫红色的黑奈李（三华李）。',
  },
  {
    id: 'naili-14', modelUrl: '/models/naili.glb', subject: '奈李',
    category: '少儿兴趣', optionType: 4,
    question: '吃奈李对身体的好处不包括？',
    options: ['提供大量脂肪', '补充维生素 C', '促进消化', '补充水分和膳食纤维'],
    correctIndex: 0,
    explanation: '奈李富含维生素 C、膳食纤维和水分，有助于消化，但脂肪含量很低，不会提供大量脂肪。',
  },
  // ── 奈李果子（nailiguozi-11 ~ nailiguozi-14）──
  {
    id: 'nailiguozi-11', modelUrl: '/models/nailiguozi.glb', subject: '奈李果子',
    category: '少儿兴趣', optionType: 4,
    question: '奈李果子从外到内的结构顺序是？',
    options: ['果皮 → 果肉 → 果核', '果核 → 果肉 → 果皮', '果肉 → 果皮 → 果核', '果皮 → 果核 → 果肉'],
    correctIndex: 0,
    explanation: '果实最外层是果皮，中间是厚厚的果肉，最里面是坚硬的果核。',
  },
  {
    id: 'nailiguozi-12', modelUrl: '/models/nailiguozi.glb', subject: '奈李果子',
    category: '少儿兴趣', optionType: 4,
    question: '奈李果核里面包裹着什么？',
    options: ['种子', '空气', '果汁', '小果肉'],
    correctIndex: 0,
    explanation: '果核里有种子，把种子种进土里，可以长出新的奈李树。',
  },
  {
    id: 'nailiguozi-13', modelUrl: '/models/nailiguozi.glb', subject: '奈李果子',
    category: '少儿兴趣', optionType: 2,
    question: '还没有成熟的奈李果子吃起来是什么味道？',
    options: ['又酸又涩', '又甜又香'],
    correctIndex: 0,
    explanation: '未成熟的果子含有机酸较多、糖分少，所以又酸又涩；成熟后糖分增加才变甜。',
  },
  {
    id: 'nailiguozi-14', modelUrl: '/models/nailiguozi.glb', subject: '奈李果子',
    category: '少儿兴趣', optionType: 4,
    question: '奈李果子在成熟过程中变甜，主要原因是？',
    options: ['淀粉等物质转化为糖', '水分蒸发变少', '果皮颜色变深', '果核变硬'],
    correctIndex: 0,
    explanation: '成熟过程中，果实里的淀粉逐渐转化为可溶性糖，所以越熟越甜。',
  },
  // ── 小韶卿（xiaoshaoqing-11 ~ xiaoshaoqing-14）──
  {
    id: 'xiaoshaoqing-11', modelUrl: '/models/xiaoshaoqing.glb', subject: '周田文旅 IP 形象「小韶卿」',
    category: '少儿兴趣', optionType: 4,
    question: '小韶卿是哪里的文旅 IP 形象？',
    options: ['广东韶关周田镇', '北京周口店', '上海周浦镇', '湖南株洲'],
    correctIndex: 0,
    explanation: '小韶卿是韶关市仁化县周田镇的文旅 IP 形象，用来推广当地文化与旅游。',
  },
  {
    id: 'xiaoshaoqing-12', modelUrl: '/models/xiaoshaoqing.glb', subject: '周田文旅 IP 形象「小韶卿」',
    category: '少儿兴趣', optionType: 4,
    question: '小韶卿名字中的"韶"与什么有关？',
    options: ['当地的韶文化（韶乐）', '一种乐器叫韶', '韶山的简称', '韶华的意思'],
    correctIndex: 0,
    explanation: '"韶"取自韶文化——相传舜帝南巡奏《韶乐》于此，韶关也因此得名，周田镇正处韶关。',
  },
  {
    id: 'xiaoshaoqing-13', modelUrl: '/models/xiaoshaoqing.glb', subject: '周田文旅 IP 形象「小韶卿」',
    category: '少儿兴趣', optionType: 4,
    question: '文旅 IP 形象的主要作用是什么？',
    options: ['宣传当地文化、带动旅游发展', '代替警察指挥交通', '记录天气预报', '管理农田灌溉'],
    correctIndex: 0,
    explanation: '文旅 IP 形象是地方文化的"代言人"，通过可爱的形象吸引游客，传播当地历史文化和风土人情。',
  },
  {
    id: 'xiaoshaoqing-14', modelUrl: '/models/xiaoshaoqing.glb', subject: '周田文旅 IP 形象「小韶卿」',
    category: '少儿兴趣', optionType: 2,
    question: '小韶卿是什么类型的形象？',
    options: ['卡通 IP 形象', '真实存在的动物'],
    correctIndex: 0,
    explanation: '小韶卿是设计出来的卡通 IP 形象，代表周田镇的文化符号，并不是真实存在的动物。',
  },
];

const BIOLOGY_EXTRA_A_QUESTIONS: QuizQuestion[] = [
  // ── 心脏模型（heart-11 ~ heart-14）──
  {
    id: 'heart-11', modelUrl: '/models/heart-optimized.glb', subject: '心脏模型',
    category: '生物', optionType: 4,
    question: '心脏的四个腔室中，壁最厚、收缩力最强的是？',
    options: ['左心室', '右心室', '左心房', '右心房'],
    correctIndex: 0,
    explanation: '左心室需要把血液泵到全身各处，路程最远、阻力最大，所以壁最厚、收缩力最强。',
  },
  {
    id: 'heart-12', modelUrl: '/models/heart-optimized.glb', subject: '心脏模型',
    category: '生物', optionType: 4,
    question: '3D 心脏模型中，用红色表示的血管通常代表什么？',
    options: ['动脉（含氧血）', '静脉（含二氧化碳血）', '毛细血管', '淋巴管'],
    correctIndex: 0,
    explanation: '解剖学上通常用红色代表动脉（流动着含氧丰富的血液），蓝色代表静脉，方便观察血液循环方向。',
  },
  {
    id: 'heart-13', modelUrl: '/models/heart-optimized.glb', subject: '心脏模型',
    category: '生物', optionType: 2,
    question: '心脏内瓣膜的主要作用是什么？',
    options: ['防止血液倒流', '加快血液流动速度'],
    correctIndex: 0,
    explanation: '房室瓣和动脉瓣像单向阀门，保证血液只能朝一个方向流动，防止倒流。',
  },
  {
    id: 'heart-14', modelUrl: '/models/heart-optimized.glb', subject: '心脏模型',
    category: '生物', optionType: 4,
    question: '成年人安静状态下的正常心率范围大约是？',
    options: ['60~100 次/分', '20~40 次/分', '150~200 次/分', '200~300 次/分'],
    correctIndex: 0,
    explanation: '正常成年人心率为 60~100 次/分，运动员或睡眠时可能更慢。',
  },
  // ── HIV 病毒（hiv-11 ~ hiv-14）──
  {
    id: 'hiv-11', modelUrl: '/models/hiv-virus.glb', subject: 'HIV 病毒模型',
    category: '生物', optionType: 4,
    question: 'HIV 主要攻击人体哪一类免疫细胞？',
    options: ['CD4⁺ T 淋巴细胞', '红细胞', '血小板', '骨骼肌细胞'],
    correctIndex: 0,
    explanation: 'HIV 表面的蛋白能与 CD4⁺ T 淋巴细胞结合并侵入，导致免疫系统功能逐渐崩溃。',
  },
  {
    id: 'hiv-12', modelUrl: '/models/hiv-virus.glb', subject: 'HIV 病毒模型',
    category: '生物', optionType: 2,
    question: 'HIV 的遗传物质是什么？',
    options: ['RNA', 'DNA'],
    correctIndex: 0,
    explanation: 'HIV 是逆转录病毒，遗传物质是 RNA，侵入细胞后通过逆转录酶合成 DNA 整合进宿主基因组。',
  },
  {
    id: 'hiv-13', modelUrl: '/models/hiv-virus.glb', subject: 'HIV 病毒模型',
    category: '生物', optionType: 4,
    question: '下列哪种日常接触不会传播 HIV？',
    options: ['握手、拥抱、共餐', '无保护性行为', '共用注射器', '母婴传播'],
    correctIndex: 0,
    explanation: 'HIV 主要通过血液、性接触和母婴传播，日常握手、拥抱、共餐、蚊虫叮咬等不会传播。',
  },
  {
    id: 'hiv-14', modelUrl: '/models/hiv-virus.glb', subject: 'HIV 病毒模型',
    category: '生物', optionType: 4,
    question: '艾滋病（AIDS）的全称是？',
    options: ['获得性免疫缺陷综合征', '先天性心脏病', '流行性感冒', '肺炎链球菌感染'],
    correctIndex: 0,
    explanation: '艾滋病全称"获得性免疫缺陷综合征"，是由 HIV 感染导致的免疫系统严重受损的疾病。',
  },
  // ── 心脏（解剖）（orh-9 ~ orh-14）──
  {
    id: 'orh-9', modelUrl: '/models/organ-heart.glb', subject: '心脏（解剖）',
    category: '生物', optionType: 4,
    question: '心脏的正常起搏点是？',
    options: ['窦房结', '房室结', '浦肯野纤维', '心室肌细胞'],
    correctIndex: 0,
    explanation: '窦房结位于右心房上部，能自主发出电冲动，是心脏的"天然起搏器"。',
  },
  {
    id: 'orh-10', modelUrl: '/models/organ-heart.glb', subject: '心脏（解剖）',
    category: '生物', optionType: 4,
    question: '左心室壁比右心室壁厚得多，原因是？',
    options: ['左心室要把血液泵到全身，阻力更大', '左心室容量更大', '左心室跳动更快', '左心室位于左侧更靠外'],
    correctIndex: 0,
    explanation: '左心室推动体循环，路径长、阻力大，需要更强的收缩力，所以心肌壁更厚。',
  },
  {
    id: 'orh-11', modelUrl: '/models/organ-heart.glb', subject: '心脏（解剖）',
    category: '生物', optionType: 2,
    question: '肺动脉中流动的是动脉血还是静脉血？',
    options: ['静脉血', '动脉血'],
    correctIndex: 0,
    explanation: '肺动脉运送的是全身回流的含氧较少的静脉血，到肺部进行气体交换后变成动脉血。',
  },
  {
    id: 'orh-12', modelUrl: '/models/organ-heart.glb', subject: '心脏（解剖）',
    category: '生物', optionType: 4,
    question: '心动周期中，房室瓣关闭发生在什么时候？',
    options: ['心室开始收缩时', '心房收缩时', '心室舒张末期', '心房舒张时'],
    correctIndex: 0,
    explanation: '心室收缩开始，室内压迅速升高超过房内压，房室瓣被推向心房关闭，防止血液倒流回心房。',
  },
  {
    id: 'orh-13', modelUrl: '/models/organ-heart.glb', subject: '心脏（解剖）',
    category: '生物', optionType: 4,
    question: '成年人安静时心脏每分钟泵出的血量大约是？',
    options: ['约 5 升', '约 500 毫升', '约 50 升', '约 0.5 升'],
    correctIndex: 0,
    explanation: '安静状态下每搏输出量约 70 ml，心率约 75 次/分，每分钟泵血量约 5 升，剧烈运动时可达 20 升以上。',
  },
  {
    id: 'orh-14', modelUrl: '/models/organ-heart.glb', subject: '心脏（解剖）',
    category: '生物', optionType: 4,
    question: '心包的主要作用不包括？',
    options: ['参与氧气交换', '保护心脏', '固定心脏位置', '减少跳动时的摩擦'],
    correctIndex: 0,
    explanation: '心包包裹心脏，起保护、固定和减少摩擦的作用；气体交换发生在肺，心包不参与。',
  },
];

const BIOLOGY_EXTRA_B_QUESTIONS: QuizQuestion[] = [
  // ── 大脑（orb-9 ~ orb-14）──
  {
    id: 'orb-9', modelUrl: '/models/organ-brain.glb', subject: '大脑',
    category: '生物', optionType: 4,
    question: '大脑皮层中控制躯体随意运动的区域（运动区）位于？',
    options: ['中央前回', '枕叶', '颞叶', '小脑'],
    correctIndex: 0,
    explanation: '中央前回是躯体运动区，发出指令控制骨骼肌的随意运动；中央后回是躯体感觉区。',
  },
  {
    id: 'orb-10', modelUrl: '/models/organ-brain.glb', subject: '大脑',
    category: '生物', optionType: 2,
    question: '连接大脑左右两个半球的结构是什么？',
    options: ['胼胝体', '脑垂体'],
    correctIndex: 0,
    explanation: '胼胝体由大量神经纤维组成，负责左右半球之间的信息传递。',
  },
  {
    id: 'orb-11', modelUrl: '/models/organ-brain.glb', subject: '大脑',
    category: '生物', optionType: 4,
    question: '视觉中枢位于大脑的哪个叶？',
    options: ['枕叶', '额叶', '顶叶', '颞叶'],
    correctIndex: 0,
    explanation: '视觉中枢位于枕叶，视觉信息经视神经传导到这里加工处理。',
  },
  {
    id: 'orb-12', modelUrl: '/models/organ-brain.glb', subject: '大脑',
    category: '生物', optionType: 4,
    question: '听觉中枢位于大脑的哪个叶？',
    options: ['颞叶', '额叶', '枕叶', '顶叶'],
    correctIndex: 0,
    explanation: '听觉中枢位于颞叶，接收并处理来自内耳的听觉信息。',
  },
  {
    id: 'orb-13', modelUrl: '/models/organ-brain.glb', subject: '大脑',
    category: '生物', optionType: 4,
    question: '大脑表面布满沟回（皱褶），主要作用是什么？',
    options: ['增大皮层表面积，容纳更多神经元', '减少大脑重量', '防止脑部受凉', '储存脑脊液'],
    correctIndex: 0,
    explanation: '沟回使大脑皮层表面积大大增加，可以容纳更多神经元，承载更复杂的功能。',
  },
  {
    id: 'orb-14', modelUrl: '/models/organ-brain.glb', subject: '大脑',
    category: '生物', optionType: 4,
    question: '大脑的运动性语言中枢（布罗卡区）受损，患者会？',
    options: ['能听懂但说话困难', '听不见声音', '看不见东西', '失去嗅觉'],
    correctIndex: 0,
    explanation: '布罗卡区受损导致运动性失语：患者能听懂别人的话，但自己说话费力、表达困难。',
  },
  // ── 肺（orl-9 ~ orl-14）──
  {
    id: 'orl-9', modelUrl: '/models/organ-lungs.glb', subject: '肺',
    category: '生物', optionType: 4,
    question: '肺在人体中的位置是？',
    options: ['胸腔内、膈肌上方', '腹腔内、胃的两侧', '盆腔内', '胸腔内、膈肌下方'],
    correctIndex: 0,
    explanation: '左、右肺位于胸腔内，膈肌上方，中间隔着心脏和纵隔。',
  },
  {
    id: 'orl-10', modelUrl: '/models/organ-lungs.glb', subject: '肺',
    category: '生物', optionType: 4,
    question: '肺循环（小循环）的起点和终点分别是？',
    options: ['右心室→肺动脉→肺→肺静脉→左心房', '左心室→主动脉→肺', '右心房→肺静脉→肺', '左心房→肺动脉→肺'],
    correctIndex: 0,
    explanation: '肺循环路径：右心室 → 肺动脉 → 肺部毛细血管（气体交换） → 肺静脉 → 左心房。',
  },
  {
    id: 'orl-11', modelUrl: '/models/organ-lungs.glb', subject: '肺',
    category: '生物', optionType: 4,
    question: '肺活量指的是？',
    options: ['尽力吸气后再尽力呼气所能呼出的气体量', '每次平静呼吸的气量', '肺内能容纳的最大空气总量', '每分钟吸入的氧气量'],
    correctIndex: 0,
    explanation: '肺活量 = 最大吸气后的最大呼气量，反映肺一次通气的最大能力。',
  },
  {
    id: 'orl-12', modelUrl: '/models/organ-lungs.glb', subject: '肺',
    category: '生物', optionType: 2,
    question: '肺泡中的氧气进入血液，依靠的是什么原理？',
    options: ['气体扩散（浓度差）', '主动运输'],
    correctIndex: 0,
    explanation: '肺泡内氧分压高于血液，氧气靠浓度差自由扩散穿过肺泡壁和毛细血管壁进入血液。',
  },
  {
    id: 'orl-13', modelUrl: '/models/organ-lungs.glb', subject: '肺',
    category: '生物', optionType: 4,
    question: '呼吸运动的主要动力来自哪组肌肉？',
    options: ['膈肌和肋间肌', '肱二头肌', '腹直肌', '斜方肌'],
    correctIndex: 0,
    explanation: '吸气时膈肌和肋间外肌收缩，胸腔扩大；呼气时这些肌肉舒张，胸腔缩小。',
  },
  {
    id: 'orl-14', modelUrl: '/models/organ-lungs.glb', subject: '肺',
    category: '生物', optionType: 4,
    question: '长期吸烟对肺的主要危害不包括？',
    options: ['增强肺的防御能力', '破坏纤毛清除功能', '增加肺癌风险', '引起慢性支气管炎'],
    correctIndex: 0,
    explanation: '吸烟会损伤纤毛、诱发慢性支气管炎和肺癌，绝不会增强肺的防御能力。',
  },
  // ── 肝脏（orv-9 ~ orv-14）──
  {
    id: 'orv-9', modelUrl: '/models/organ-liver.glb', subject: '肝脏',
    category: '生物', optionType: 4,
    question: '肝脏位于人体哪个部位？',
    options: ['右上腹（膈下）', '左上腹', '右下腹', '盆腔'],
    correctIndex: 0,
    explanation: '肝脏是人体最大的内脏器官，位于右上腹、膈肌下方，大部分被右侧肋骨保护。',
  },
  {
    id: 'orv-10', modelUrl: '/models/organ-liver.glb', subject: '肝脏',
    category: '生物', optionType: 4,
    question: '肝脏分泌的胆汁储存在哪里？',
    options: ['胆囊', '胰腺', '脾脏', '胃'],
    correctIndex: 0,
    explanation: '肝细胞分泌胆汁，经胆管流入胆囊储存浓缩，进食后排入十二指肠帮助消化脂肪。',
  },
  {
    id: 'orv-11', modelUrl: '/models/organ-liver.glb', subject: '肝脏',
    category: '生物', optionType: 4,
    question: '肝脏的"解毒"功能指的是？',
    options: ['代谢转化体内有毒物质', '过滤血液中的红细胞', '消灭所有细菌', '分泌消化酶'],
    correctIndex: 0,
    explanation: '肝细胞通过氧化、结合等反应把酒精、药物等有毒物质转化为无毒或易排出的物质。',
  },
  {
    id: 'orv-12', modelUrl: '/models/organ-liver.glb', subject: '肝脏',
    category: '生物', optionType: 4,
    question: '下列哪项不是肝脏合成或分泌的物质？',
    options: ['胰岛素', '白蛋白', '凝血因子', '尿素'],
    correctIndex: 0,
    explanation: '肝脏合成白蛋白、凝血因子和尿素等；胰岛素由胰腺的胰岛 β 细胞分泌。',
  },
  {
    id: 'orv-13', modelUrl: '/models/organ-liver.glb', subject: '肝脏',
    category: '生物', optionType: 2,
    question: '肝细胞受损时，血液中哪种酶通常会明显升高？',
    options: ['转氨酶（ALT/AST）', '胃蛋白酶'],
    correctIndex: 0,
    explanation: '肝细胞损伤后，细胞内的转氨酶释放入血，所以体检中 ALT/AST 升高提示肝脏受损。',
  },
  {
    id: 'orv-14', modelUrl: '/models/organ-liver.glb', subject: '肝脏',
    category: '生物', optionType: 4,
    question: '肝脏的血液供应来源是？',
    options: ['肝动脉和门静脉', '只有肝动脉', '只有门静脉', '肝静脉和肺静脉'],
    correctIndex: 0,
    explanation: '肝动脉提供含氧血，门静脉收集胃肠富含营养的血，两者共同供血后由肝静脉汇入下腔静脉。',
  },
];

const BIOLOGY_EXTRA_C_QUESTIONS: QuizQuestion[] = [
  // ── 肾脏（ork-9 ~ ork-14）──
  {
    id: 'ork-9', modelUrl: '/models/organ-kidneys.glb', subject: '肾脏',
    category: '生物', optionType: 4,
    question: '肾脏的基本结构和功能单位是什么？',
    options: ['肾单位', '肾小球', '肾小管', '肾盂'],
    correctIndex: 0,
    explanation: '肾单位由肾小体和肾小管组成，每个肾脏约有 100 万个肾单位，是尿生成的单位。',
  },
  {
    id: 'ork-10', modelUrl: '/models/organ-kidneys.glb', subject: '肾脏',
    category: '生物', optionType: 4,
    question: '正常情况下，尿液中没有下列哪项？',
    options: ['葡萄糖和蛋白质', '水和无机盐', '尿素', '尿酸'],
    correctIndex: 0,
    explanation: '肾小球滤过时葡萄糖、蛋白质几乎不滤出或被肾小管完全重吸收，所以正常尿液中不含葡萄糖和蛋白质。',
  },
  {
    id: 'ork-11', modelUrl: '/models/organ-kidneys.glb', subject: '肾脏',
    category: '生物', optionType: 4,
    question: '肾小管重吸收能力最强、重吸收量最大的部位是？',
    options: ['近曲小管', '髓袢', '远曲小管', '集合管'],
    correctIndex: 0,
    explanation: '近曲小管重吸收约 65%~70% 的滤液，包括全部葡萄糖、大部分氨基酸和无机盐。',
  },
  {
    id: 'ork-12', modelUrl: '/models/organ-kidneys.glb', subject: '肾脏',
    category: '生物', optionType: 4,
    question: '成年人每天排出的尿量大约是？',
    options: ['1~2 升', '10 毫升', '10 升', '100 毫升'],
    correctIndex: 0,
    explanation: '正常人每天尿量约 1~2 升，每天少于 400 ml 为少尿，多于 2.5 L 为多尿。',
  },
  {
    id: 'ork-13', modelUrl: '/models/organ-kidneys.glb', subject: '肾脏',
    category: '生物', optionType: 2,
    question: '肾脏近球细胞分泌的、能使血压升高的激素是？',
    options: ['肾素', '胰岛素'],
    correctIndex: 0,
    explanation: '肾素由肾脏近球细胞分泌，激活肾素-血管紧张素系统，使血管收缩、血压升高。',
  },
  {
    id: 'ork-14', modelUrl: '/models/organ-kidneys.glb', subject: '肾脏',
    category: '生物', optionType: 4,
    question: '尿液形成的正确顺序是？',
    options: ['肾小球滤过 → 肾小管重吸收 → 肾小管分泌', '肾小管分泌 → 滤过 → 重吸收', '重吸收 → 滤过 → 分泌', '滤过 → 分泌 → 重吸收'],
    correctIndex: 0,
    explanation: '血液先经肾小球滤过形成原尿，再经肾小管重吸收有用物质、分泌多余物质，最终形成尿液。',
  },
  // ── 眼球（ore-9 ~ ore-14）──
  {
    id: 'ore-9', modelUrl: '/models/organ-eyeball.glb', subject: '眼球',
    category: '生物', optionType: 4,
    question: '眼球壁最外层的坚韧结构是什么？',
    options: ['巩膜（眼白）', '视网膜', '脉络膜', '虹膜'],
    correctIndex: 0,
    explanation: '巩膜是眼球最外层的白色坚韧纤维膜，起保护和支持眼球的作用。',
  },
  {
    id: 'ore-10', modelUrl: '/models/organ-eyeball.glb', subject: '眼球',
    category: '生物', optionType: 4,
    question: '光线进入眼球后，正确的传导顺序是？',
    options: ['角膜 → 瞳孔 → 晶状体 → 玻璃体 → 视网膜', '视网膜 → 晶状体 → 瞳孔 → 角膜', '瞳孔 → 角膜 → 晶状体 → 视网膜', '角膜 → 视网膜 → 晶状体 → 玻璃体'],
    correctIndex: 0,
    explanation: '光线依次穿过角膜、瞳孔（由虹膜调节大小）、晶状体（折射）、玻璃体，最后成像在视网膜上。',
  },
  {
    id: 'ore-11', modelUrl: '/models/organ-eyeball.glb', subject: '眼球',
    category: '生物', optionType: 4,
    question: '眼球中感光细胞所在的部位是？',
    options: ['视网膜', '虹膜', '角膜', '巩膜'],
    correctIndex: 0,
    explanation: '视网膜上有视杆细胞和视锥细胞两种感光细胞，把光信号转变成神经冲动。',
  },
  {
    id: 'ore-12', modelUrl: '/models/organ-eyeball.glb', subject: '眼球',
    category: '生物', optionType: 2,
    question: '视神经盘（盲点）为什么看不见东西？',
    options: ['那里没有感光细胞', '那里光线进不去'],
    correctIndex: 0,
    explanation: '视神经盘是视神经穿出眼球的部位，没有感光细胞，因此形成视野中的生理盲点。',
  },
  {
    id: 'ore-13', modelUrl: '/models/organ-eyeball.glb', subject: '眼球',
    category: '生物', optionType: 4,
    question: '房水的主要作用不包括？',
    options: ['帮助看清颜色', '维持眼内压', '营养角膜和晶状体', '折光作用'],
    correctIndex: 0,
    explanation: '房水充满眼前房和后房，主要维持眼压、营养并参与折光，与辨色无关。',
  },
  {
    id: 'ore-14', modelUrl: '/models/organ-eyeball.glb', subject: '眼球',
    category: '生物', optionType: 4,
    question: '近视眼应佩戴什么镜片矫正？',
    options: ['凹透镜', '凸透镜', '平面镜', '棱镜'],
    correctIndex: 0,
    explanation: '近视是远处光线成像在视网膜前方，用凹透镜使光线发散、成像后移到视网膜上；远视用凸透镜。',
  },
  // ── 肠（ori-9 ~ ori-14）──
  {
    id: 'ori-9', modelUrl: '/models/organ-intestine.glb', subject: '肠',
    category: '生物', optionType: 4,
    question: '小肠从上到下依次分为哪三段？',
    options: ['十二指肠、空肠、回肠', '回肠、空肠、十二指肠', '空肠、回肠、十二指肠', '结肠、空肠、回肠'],
    correctIndex: 0,
    explanation: '小肠依次为十二指肠（约 25 cm）、空肠和回肠，全长约 5~6 米。',
  },
  {
    id: 'ori-10', modelUrl: '/models/organ-intestine.glb', subject: '肠',
    category: '生物', optionType: 4,
    question: '大肠的主要功能是什么？',
    options: ['吸收水分和无机盐、形成粪便', '消化蛋白质', '吸收氨基酸', '分泌胰岛素'],
    correctIndex: 0,
    explanation: '大肠主要吸收剩余的水分和无机盐，并储存、形成粪便排出体外。',
  },
  {
    id: 'ori-11', modelUrl: '/models/organ-intestine.glb', subject: '肠',
    category: '生物', optionType: 4,
    question: '小肠吸收的氨基酸进入人体的途径是？',
    options: ['进入血液（毛细血管）', '进入淋巴管再入血', '直接进入组织间隙', '通过尿液排出'],
    correctIndex: 0,
    explanation: '氨基酸、葡萄糖等水溶性小分子直接进入小肠绒毛内的毛细血管，随血液运输；脂肪主要走淋巴管。',
  },
  {
    id: 'ori-12', modelUrl: '/models/organ-intestine.glb', subject: '肠',
    category: '生物', optionType: 2,
    question: '阑尾（盲肠末端的小突起）位于哪个部位？',
    options: ['大肠起始部（盲肠）末端', '小肠起始部（十二指肠）末端'],
    correctIndex: 0,
    explanation: '阑尾是盲肠（大肠起始段）末端的一个细小盲管，发炎时就是阑尾炎。',
  },
  {
    id: 'ori-13', modelUrl: '/models/organ-intestine.glb', subject: '肠',
    category: '生物', optionType: 4,
    question: '肠道中的有益菌（益生菌）对人体的作用不包括？',
    options: ['直接合成血红蛋白', '帮助消化食物', '合成部分维生素', '抑制有害菌生长'],
    correctIndex: 0,
    explanation: '益生菌帮助消化、合成维生素 K 和 B 族维生素、抑制有害菌，但不参与血红蛋白合成。',
  },
  {
    id: 'ori-14', modelUrl: '/models/organ-intestine.glb', subject: '肠',
    category: '生物', optionType: 4,
    question: '肠蠕动的主要作用是什么？',
    options: ['推动肠内容物向前移动', '分泌胃酸', '吸收氧气', '过滤血液'],
    correctIndex: 0,
    explanation: '肠道平滑肌节律性收缩形成蠕动，把食物残渣和粪便向肛门方向推进。',
  },
  // ── 胰腺（orp-9 ~ orp-14）──
  {
    id: 'orp-9', modelUrl: '/models/organ-pancreas.glb', subject: '胰腺',
    category: '生物', optionType: 4,
    question: '胰腺在人体中的位置是？',
    options: ['胃后方、横位于腹腔上部', '胸腔中央', '盆腔内', '肾脏上方'],
    correctIndex: 0,
    explanation: '胰腺位于胃的后方，横卧于腹腔上部后壁，是重要的消化腺兼内分泌腺。',
  },
  {
    id: 'orp-10', modelUrl: '/models/organ-pancreas.glb', subject: '胰腺',
    category: '生物', optionType: 4,
    question: '胰岛素分泌不足会导致什么疾病？',
    options: ['糖尿病', '高血压', '贫血', '骨质疏松'],
    correctIndex: 0,
    explanation: '胰岛素促进血糖进入细胞利用和储存，分泌不足时血糖升高，导致糖尿病。',
  },
  {
    id: 'orp-11', modelUrl: '/models/organ-pancreas.glb', subject: '胰腺',
    category: '生物', optionType: 4,
    question: '胰液最终排入哪个部位发挥消化作用？',
    options: ['十二指肠', '胃', '空肠中部', '结肠'],
    correctIndex: 0,
    explanation: '胰液经胰管与胆总管汇合后开口于十二指肠乳头，在十二指肠内消化三大营养物质。',
  },
  {
    id: 'orp-12', modelUrl: '/models/organ-pancreas.glb', subject: '胰腺',
    category: '生物', optionType: 2,
    question: '胰蛋白酶的主要作用是什么？',
    options: ['分解蛋白质', '分解淀粉'],
    correctIndex: 0,
    explanation: '胰蛋白酶（原）在肠激酶作用下活化，把蛋白质分解为多肽和氨基酸。',
  },
  {
    id: 'orp-13', modelUrl: '/models/organ-pancreas.glb', subject: '胰腺',
    category: '生物', optionType: 4,
    question: '胰岛中分泌胰高血糖素的细胞是？',
    options: ['α 细胞', 'β 细胞', 'D 细胞', 'PP 细胞'],
    correctIndex: 0,
    explanation: '胰岛 α 细胞分泌胰高血糖素（升血糖），β 细胞分泌胰岛素（降血糖），两者相互拮抗。',
  },
  {
    id: 'orp-14', modelUrl: '/models/organ-pancreas.glb', subject: '胰腺',
    category: '生物', optionType: 4,
    question: '胰腺外分泌部分泌的物质是什么？',
    options: ['胰液（含多种消化酶）', '胰岛素', '胆汁', '胃蛋白酶原'],
    correctIndex: 0,
    explanation: '胰腺外分泌部（腺泡）分泌胰液，含胰淀粉酶、胰蛋白酶、胰脂肪酶等多种消化酶。',
  },
  // ── 皮肤（ors-9 ~ ors-14）──
  {
    id: 'ors-9', modelUrl: '/models/organ-skin.glb', subject: '皮肤',
    category: '生物', optionType: 4,
    question: '皮肤的最外层结构是什么？',
    options: ['表皮', '真皮', '皮下组织', '汗腺'],
    correctIndex: 0,
    explanation: '皮肤由外向内依次为表皮、真皮和皮下组织，最外层是角质层覆盖的表皮。',
  },
  {
    id: 'ors-10', modelUrl: '/models/organ-skin.glb', subject: '皮肤',
    category: '生物', optionType: 4,
    question: '皮肤中产生黑色素、决定肤色深浅的细胞是？',
    options: ['黑色素细胞', '角质形成细胞', '成纤维细胞', '肥大细胞'],
    correctIndex: 0,
    explanation: '黑色素细胞位于表皮基底层，产生黑色素吸收紫外线、保护皮肤，数量多少决定肤色深浅。',
  },
  {
    id: 'ors-11', modelUrl: '/models/organ-skin.glb', subject: '皮肤',
    category: '生物', optionType: 2,
    question: '天热出汗时，汗液蒸发带走热量，这属于哪种散热方式？',
    options: ['蒸发散热（物理散热）', '辐射散热'],
    correctIndex: 0,
    explanation: '汗液在皮肤表面蒸发需要吸收大量汽化热，是最有效的散热方式之一，属于物理散热。',
  },
  {
    id: 'ors-12', modelUrl: '/models/organ-skin.glb', subject: '皮肤',
    category: '生物', optionType: 4,
    question: '皮肤中能感受外界刺激的感受器不包括？',
    options: ['光感受器', '触觉感受器', '温觉感受器', '痛觉感受器'],
    correctIndex: 0,
    explanation: '皮肤能感知触、压、温、痛等刺激，但没有光感受器——感光细胞在眼球的视网膜上。',
  },
  {
    id: 'ors-13', modelUrl: '/models/organ-skin.glb', subject: '皮肤',
    category: '生物', optionType: 4,
    question: '皮肤受伤后能够再生修复，主要依靠哪一层？',
    options: ['表皮的生发层', '角质层', '皮下脂肪', '汗腺导管'],
    correctIndex: 0,
    explanation: '表皮基底层（生发层）的细胞不断分裂增殖，向上推移补充角质层，伤口愈合靠它的再生能力。',
  },
  {
    id: 'ors-14', modelUrl: '/models/organ-skin.glb', subject: '皮肤',
    category: '生物', optionType: 4,
    question: '皮肤起"屏障保护"作用主要依赖哪部分？',
    options: ['表皮的角质层', '真皮的血管', '皮下的脂肪', '毛囊'],
    correctIndex: 0,
    explanation: '角质层由多层角化细胞组成，坚韧致密，能阻挡病菌和异物进入、防止水分过度流失。',
  },
];

const ALL_QUESTIONS: QuizQuestion[] = [
  ...HEART_QUESTIONS,
  ...HIV_QUESTIONS,
  ...DIAMOND_QUESTIONS,
  ...DIAMOND_UNIT_CELL_QUESTIONS,
  ...DICHLOROTOLUENE_QUESTIONS,
  ...NACL_QUESTIONS,
  ...SIO2_QUESTIONS,
  ...NITROBENZENE_QUESTIONS,
  ...EARTH_QUESTIONS,
  ...TERRAIN_QUESTIONS,
  ...LANJINGLING_QUESTIONS,
  ...NAILI_QUESTIONS,
  ...NAILIGUOZI_QUESTIONS,
  ...XIAOSHAOQING_QUESTIONS,
  ...ORGAN_HEART_QUESTIONS,
  ...ORGAN_BRAIN_QUESTIONS,
  ...ORGAN_LUNGS_QUESTIONS,
  ...ORGAN_LIVER_QUESTIONS,
  ...ORGAN_KIDNEYS_QUESTIONS,
  ...ORGAN_EYEBALL_QUESTIONS,
  ...ORGAN_INTESTINE_QUESTIONS,
  ...ORGAN_PANCREAS_QUESTIONS,
  ...ORGAN_SKIN_QUESTIONS,
  ...CHEMISTRY_EXTRA_QUESTIONS,
  ...GEOGRAPHY_EXTRA_QUESTIONS,
  ...KIDS_EXTRA_QUESTIONS,
  ...BIOLOGY_EXTRA_A_QUESTIONS,
  ...BIOLOGY_EXTRA_B_QUESTIONS,
  ...BIOLOGY_EXTRA_C_QUESTIONS,
];

/**
 * Fisher-Yates 洗牌算法
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * 答题去重：把抽过的题目 ID 记录在 localStorage，
 * 下次抽题优先抽取未做过的题，全部做完一轮后自动重置。
 */
const DONE_QUESTIONS_KEY = 'hs_quiz_done_questions';

function getDoneQuestionIds(): string[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(DONE_QUESTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function recordDoneQuestionIds(ids: string[]) {
  try {
    if (typeof localStorage === 'undefined' || ids.length === 0) return;
    const merged = Array.from(new Set([...getDoneQuestionIds(), ...ids]));
    localStorage.setItem(DONE_QUESTIONS_KEY, JSON.stringify(merged));
  } catch {
    /* 存储失败不影响答题 */
  }
}

function resetDoneQuestions() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(DONE_QUESTIONS_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * 从题库随机抽取指定数量的题目，创建答题会话。
 * 已抽过的题优先不出现（按 localStorage 记录），全部做完一轮后自动重置。
 */
export function createQuizSession(count: number = 5, modelUrlFilter?: string): QuizSession {
  let pool = ALL_QUESTIONS;
  if (modelUrlFilter) {
    pool = ALL_QUESTIONS.filter(q => q.modelUrl === modelUrlFilter);
  }
  const doneIds = getDoneQuestionIds();
  const freshPool = pool.filter(q => !doneIds.includes(q.id));
  let questions: QuizQuestion[];
  if (freshPool.length >= count) {
    // 未做过的题足够：只抽新题，并记录本次抽中的题
    questions = shuffleArray(freshPool).slice(0, count);
    recordDoneQuestionIds(questions.map(q => q.id));
  } else if (freshPool.length > 0) {
    // 新题不足：先抽完剩余新题，再从全库补足，同时重置记录让下一轮重新开始
    const fresh = shuffleArray(freshPool);
    const usedIds = new Set(fresh.map(q => q.id));
    const filler = shuffleArray(pool.filter(q => !usedIds.has(q.id))).slice(0, count - fresh.length);
    questions = [...fresh, ...filler];
    resetDoneQuestions();
  } else {
    // 一轮全部做完：重置记录，重新从全库随机抽
    resetDoneQuestions();
    questions = shuffleArray(pool).slice(0, Math.min(count, pool.length));
  }
  return {
    questions,
    currentIndex: 0,
    answers: new Array(questions.length).fill(null),
    startTime: Date.now(),
  };
}

export function createQuizSessionFromQuestions(questions: QuizQuestion[]): QuizSession {
  const selected = questions.filter((question) => question.options.length >= 2 && question.options.length <= 4).slice(0, 5);
  return {
    questions: selected,
    currentIndex: 0,
    answers: new Array(selected.length).fill(null),
    startTime: Date.now(),
  };
}

/**
 * 计算答题结果
 */
export function getQuizResult(session: QuizSession) {
  let correctCount = 0;
  session.questions.forEach((q, i) => {
    if (session.answers[i] === q.correctIndex) {
      correctCount++;
    }
  });
  const totalTime = Math.round((Date.now() - session.startTime) / 1000);
  const totalQuestions = session.questions.length;
  const accuracy = Math.round((correctCount / totalQuestions) * 100);
  const stars = accuracy >= 80 ? 3 : accuracy >= 60 ? 2 : accuracy >= 40 ? 1 : 0;
  return { correctCount, totalQuestions, accuracy, totalTime, stars };
}

/**
 * 工具方法：按 ID 查找题目（错题本展示用）
 */
export function findQuizQuestionById(id: string): QuizQuestion | null {
  return ALL_QUESTIONS.find(q => q.id === id) || null;
}
