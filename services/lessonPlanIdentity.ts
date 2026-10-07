export type LessonPlanIdentity = {
  id: string
  createdAt: string
}

export function mergeLessonPlanUpdate<T extends LessonPlanIdentity>(current: T, incoming: Partial<T>): T {
  return {
    ...current,
    ...incoming,
    id: current.id,
    createdAt: current.createdAt,
  }
}
