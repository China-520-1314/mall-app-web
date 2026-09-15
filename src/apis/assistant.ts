import { http } from '@/utils/http'
import type { AssistantChatRequest, AssistantChatResponse } from '@/types/assistant'

/** 发送商城智能客服消息 */
export const sendAssistantMessageAPI = (data: AssistantChatRequest) =>
  http<AssistantChatResponse>({
    method: 'POST',
    url: '/assistant/chat',
    data,
    timeout: 35 * 1000,
  })

export const getAssistantBusinessSummaryAPI = (type: 'orders' | 'after-sales') =>
  http<{ type: string; total: number; items: Array<{ id: number; number: string; status: string; time: string; logistics: string }> }>({
    method: 'POST',
    url: '/assistant/business-summary',
    params: { type },
  })
