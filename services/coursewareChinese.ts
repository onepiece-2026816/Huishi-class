import translations from './courseware-zh.json'

export const sceneLabels: Record<string, string> = {
  hook: '问题导入', outcomes: '学习目标', 'model-overview': '整体结构',
  chambers: '心腔定位', vessels: '血管连接', valves: '瓣膜功能',
  'blood-flow': '血流路径', comparison: '结构对比', 'case-evidence': '案例证据',
  'model-challenge': '结构观察', 'gesture-quiz': '课堂答题', summary: '课堂总结',
  'content-map': '知识结构', 'question-chain': '问题链', activity: '教学活动',
  assessment: '学习评价', homework: '课后任务',
}

export function chineseCoursewareText(value: string): string {
  const dictionary = translations as Record<string, string>
  return dictionary[value] || value.replace(/^Activity (\d+)$/, '教学活动 $1').replace(/^Reasoning:/, '推理：')
}

export function localizeCourseware<T>(value: T): T {
  if (typeof value === 'string') return chineseCoursewareText(value) as T
  if (Array.isArray(value)) return value.map(localizeCourseware) as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, localizeCourseware(item)])) as T
  }
  return value
}
