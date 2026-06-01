// 职级 L1-L15 常量与类型(普通模块,可被 'use server' 文件与客户端组件共享)
export type JobLevel =
  | 'L1' | 'L2' | 'L3' | 'L4' | 'L5'
  | 'L6' | 'L7' | 'L8' | 'L9' | 'L10'
  | 'L11' | 'L12' | 'L13' | 'L14' | 'L15'

export const JOB_LEVELS: JobLevel[] = [
  'L1', 'L2', 'L3', 'L4', 'L5',
  'L6', 'L7', 'L8', 'L9', 'L10',
  'L11', 'L12', 'L13', 'L14', 'L15',
]
