import { computed, ref, watch } from 'vue'
import { useMemberStore } from '@/stores/member'
import { sendAssistantMessageAPI } from '@/apis/assistant'
import type { AssistantHistoryMessage } from '@/types/assistant'

const welcome: AssistantHistoryMessage = {
  role: 'assistant',
  content: '你好，我是 Mall 的智能客服。可以咨询购物流程、优惠券和账号问题，也可以通过下方入口查询订单。请勿发送密码、验证码或支付凭证。',
}
const sessionKey = 'mall-assistant-session-v1'
const ttl = 30 * 60 * 1000

/** 负责聊天状态；使用会话版本隔离退出登录后返回的旧请求。 */
export function useAssistantChat() {
  const member = useMemberStore()
  const owner = computed(() => String(member.memberInfo?.id ?? 'guest'))
  const messages = ref<AssistantHistoryMessage[]>([{ ...welcome }])
  const inputValue = ref('')
  const errorMessage = ref('')
  const isSending = ref(false)
  const fallback = ref(false)
  const lastFailedMessage = ref('')
  let version = 0

  const clearConversation = () => {
    version++
    messages.value = [{ ...welcome }]
    inputValue.value = ''
    errorMessage.value = ''
    lastFailedMessage.value = ''
    fallback.value = false
    isSending.value = false
    try { if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(sessionKey) } catch { /* 存储不可用时保留内存会话 */ }
  }

  try {
    if (typeof sessionStorage !== 'undefined') {
      const saved = JSON.parse(sessionStorage.getItem(sessionKey) || 'null')
      if (saved?.owner === owner.value && Date.now() - saved.time < ttl && Array.isArray(saved.messages)) {
        const valid = saved.messages.slice(-60).filter((item: AssistantHistoryMessage) =>
          (item?.role === 'user' || item?.role === 'assistant') && typeof item.content === 'string' && item.content.length <= 6000)
        if (valid.length) messages.value = valid
        fallback.value = saved.fallback === true
      }
    }
  } catch { /* 缓存损坏时使用新会话 */ }

  watch(owner, clearConversation, { flush: 'sync' })
  watch(messages, () => {
    try {
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(sessionKey,
        JSON.stringify({ owner: owner.value, time: Date.now(), messages: messages.value.slice(-60), fallback: fallback.value }))
    } catch { /* 存储空间不足不影响聊天 */ }
  }, { deep: true })

  const sendMessage = async (preset?: string, retry = false) => {
    if (isSending.value) return
    const content = (preset ?? inputValue.value).trim()
    if (!content) return
    if (content.length > 800) {
      errorMessage.value = '问题过长，请控制在 800 个字符以内。'
      return
    }
    if (retry && messages.value.at(-1)?.role === 'user' && messages.value.at(-1)?.content === content) messages.value.pop()
    const history = messages.value.slice(-8).map(item => ({ role: item.role, content: item.content.slice(0, 800) }))
    messages.value = [...messages.value.slice(-58), { role: 'user', content }]
    if (preset === undefined) inputValue.value = ''
    errorMessage.value = ''
    lastFailedMessage.value = content
    isSending.value = true
    const currentVersion = version
    try {
      const res = await sendAssistantMessageAPI({ message: content, history })
      if (currentVersion !== version) return
      const reply = res.data?.reply?.trim()
      if (!reply) throw new Error('客服返回为空，请稍后重试')
      fallback.value = res.data.fallback
      messages.value.push({ role: 'assistant', content: reply.slice(0, 6000) })
      lastFailedMessage.value = ''
    } catch (error: unknown) {
      if (currentVersion !== version) return
      const failure = error as { data?: { message?: string }; errMsg?: string; message?: string }
      errorMessage.value = failure.data?.message || failure.message ||
        (failure.errMsg?.includes('timeout') ? '客服响应超时，请稍后重试。' : '网络连接失败，请检查连接后重试。')
    } finally {
      if (currentVersion === version) isSending.value = false
    }
  }
  const retryLastMessage = () => { if (lastFailedMessage.value) void sendMessage(lastFailedMessage.value, true) }
  return { messages, inputValue, errorMessage, isSending, fallback, clearConversation, sendMessage, retryLastMessage, owner }
}
