/** 智能客服消息角色 */
export type AssistantMessageRole = 'user' | 'assistant'

/** 客服上下文消息 */
export type AssistantHistoryMessage = {
  role: AssistantMessageRole
  content: string
}

/** 客服请求参数 */
export type AssistantChatRequest = {
  message: string
  history: AssistantHistoryMessage[]
}

/** 客服响应 */
export type AssistantChatResponse = {
  reply: string
  fallback: boolean
}
