import { http } from '@/utils/http'
import type { AssistantChatRequest, AssistantChatResponse } from '@/types/assistant'

/** 发送商城智能客服消息 */
export const sendAssistantMessageAPI = (data: AssistantChatRequest) => {
  return http<AssistantChatResponse>({
    method: 'POST',
    url: '/assistant/chat',
    data,
    silent: true,
    // 词元神生成回复可能接近后端 30 秒的请求上限，避免被通用 10 秒超时提前中断。
    timeout: 35 * 1000,
  })
}
