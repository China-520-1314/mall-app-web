<template>
  <view class="assistant-pet" :class="{ 'assistant-pet--open': isOpen }">
    <view
      class="assistant-pet__trigger"
      :style="petStyle"
      role="button"
      tabindex="0"
      :aria-expanded="isOpen"
      @keydown.enter.prevent="handlePetClick"
      @keydown.space.prevent="handlePetClick"
      aria-label="打开智能客服，可拖动调整位置"
      @click.stop="handlePetClick"
      @pointerdown.stop.prevent="handlePointerStart"
      @pointermove.stop.prevent="handlePointerMove"
      @pointerup.stop.prevent="handlePointerEnd"
      @pointercancel.stop.prevent="handlePointerEnd"
      @mousedown.stop.prevent="handlePointerStart"
      @mousemove.stop.prevent="handlePointerMove"
      @mouseup.stop.prevent="handlePointerEnd"
      @touchstart.stop.prevent="handlePointerStart"
      @touchmove.stop.prevent="handlePointerMove"
      @touchend.stop.prevent="handlePointerEnd"
      @touchcancel.stop.prevent="handlePointerEnd"
    >
      <view class="assistant-pet__halo"></view>
      <view
        class="assistant-pet__sprite"
        :class="`assistant-pet__sprite--${spriteState}`"
        :style="spriteStyle"
      ></view>
      <view v-if="!isOpen && !isDragging" class="assistant-pet__hint">需要帮忙吗？</view>
    </view>

    <view v-if="isOpen" class="assistant-pet__panel" role="dialog" aria-label="Mall 智能客服" :style="panelStyle" @click.stop>
      <view class="assistant-pet__panel-header">
        <view class="assistant-pet__identity">
          <view class="assistant-pet__mini-sprite" :style="miniSpriteStyle"></view>
          <view>
            <text class="assistant-pet__title">Mall 智能客服</text>
            <text class="assistant-pet__status">
              <text class="assistant-pet__status-dot"></text>
              {{ isSending ? '正在回复…' : fallback ? '基础问答 · 智能服务暂不可用' : '商城购物咨询' }}
            </text>
          </view>
        </view>
        <view class="assistant-pet__header-actions">
          <button
            class="assistant-pet__icon-button"
            aria-label="清空会话"
            title="清空会话"
            :disabled="isSending"
            @click="clearConversation"
          >
            ↺
          </button>
          <button class="assistant-pet__icon-button" aria-label="关闭客服" title="关闭客服" @click="closePanel">
            ×
          </button>
        </view>
      </view>

      <scroll-view class="assistant-pet__messages" scroll-y :scroll-into-view="scrollIntoView">
        <view
          v-for="(item, index) in messages"
          :id="`assistant-message-${index}`"
          :key="`${item.role}-${index}`"
          class="assistant-pet__message-row"
          :class="{ 'assistant-pet__message-row--user': item.role === 'user' }"
        >
          <view class="assistant-pet__message" :class="`assistant-pet__message--${item.role}`">
            <text>{{ item.content }}</text>
          </view>
        </view>
        <view v-if="isSending" class="assistant-pet__message-row">
          <view class="assistant-pet__message assistant-pet__message--assistant assistant-pet__typing">
            <text class="assistant-pet__typing-dot"></text>
            <text class="assistant-pet__typing-dot"></text>
            <text class="assistant-pet__typing-dot"></text>
          </view>
        </view>
        <view v-if="errorMessage" class="assistant-pet__error">
          <text>{{ errorMessage }}</text>
          <button class="assistant-pet__retry" @click="retryLastMessage">重试</button>
        </view>
        <view v-if="orderHint" class="assistant-pet__message" aria-live="polite">{{ orderHint }}</view>
        <button v-for="item in recentOrders" :key="item.id" class="assistant-order-card" @click="openOrder(item.id)">
          <text>订单 {{ item.orderSn }}</text>
          <text>{{ orderStatusNames[item.status] || '状态待确认' }} · ￥{{ item.payAmount }}</text>
          <text>查看详情 ›</text>
        </button>
      </scroll-view>

      <view v-if="showQuickQuestions" class="assistant-pet__quick-list">
        <button
          v-for="question in quickQuestions"
          :key="question"
          class="assistant-pet__quick-question"
          @click="sendMessage(question)"
        >
          {{ question }}
        </button>
      </view>

      <view class="assistant-pet__actions">
        <button @click="openDestination('search')">搜索商品</button>
        <button :disabled="loadingOrders" @click="loadRecentOrders">{{ loadingOrders ? '查询中…' : '查询我的订单' }}</button>
        <button @click="openDestination('coupons')">查看优惠券</button>
      </view>

      <view class="assistant-pet__composer">
        <input
          v-model="inputValue"
          class="assistant-pet__input"
          type="text"
          :focus="inputFocused"
          :maxlength="800"
          confirm-type="send"
          placeholder="输入你想咨询的问题"
          @confirm="sendMessage()"
        />
        <button class="assistant-pet__send" :disabled="isSending || !inputValue.trim()" @click="sendMessage()">
          {{ isSending ? '发送中' : '发送' }}
        </button>
      </view>
      <text class="assistant-pet__disclaimer">当前为通用咨询，实时库存、价格和订单请以页面信息为准</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAssistantChat } from '@/composables/useAssistantChat'
import { useMemberStore } from '@/stores/member'
import { getOrderListAPI } from '@/apis/order'
import type { OmsOrderDetail } from '@/types/order'

type Point = {
  x: number
  y: number
}

type TouchPoint = {
  clientX?: number
  clientY?: number
  pageX?: number
  pageY?: number
}

type TouchPointList = {
  length: number
  [index: number]: TouchPoint
}

type PointerEventLike = {
  type?: string
  clientX?: number
  clientY?: number
  pageX?: number
  pageY?: number
  pointerId?: number
  touches?: TouchPointList
  changedTouches?: TouchPointList
  preventDefault?: () => void
}

const STORAGE_KEY = 'mall-assistant-pet-position'
const PET_WIDTH = 104
const PET_HEIGHT = 112
const PANEL_GAP = 14
const SPRITE_FRAME_ROOT = '/static/assistant/frames'
const quickQuestions = ['怎么搜索商品？', '如何申请退货？', '优惠券在哪里查看？']

type SpriteState = 'idle' | 'waving' | 'running'
type SpriteConfig = {
  row: number
  frames: number
  frameDuration: number
}

// 图集原始单元格为 192×208，构建时已裁成独立帧并缩放为 96×104，避免整张图集位移。
const SPRITE_CONFIG: Record<SpriteState, SpriteConfig> = {
  idle: { row: 0, frames: 6, frameDuration: 250 },
  waving: { row: 3, frames: 4, frameDuration: 225 },
  running: { row: 7, frames: 6, frameDuration: 190 },
}

const isOpen = ref(false)
const isPointerActive = ref(false)
const isDragging = ref(false)
const suppressClick = ref(false)
const { messages, inputValue, errorMessage, isSending, fallback, clearConversation: resetChat,
  sendMessage, retryLastMessage, owner } = useAssistantChat()
const member = useMemberStore()
const inputFocused = ref(false)
const recentOrders = ref<OmsOrderDetail[]>([])
const orderHint = ref('')
const loadingOrders = ref(false)
const orderStatusNames = ['待付款', '待发货', '已发货', '已完成', '已关闭', '无效订单']
let orderVersion = 0

const resetOrders = () => {
  orderVersion++
  recentOrders.value = []
  orderHint.value = ''
  loadingOrders.value = false
}
watch(owner, resetOrders, { flush: 'sync' })
const clearConversation = () => { resetChat(); resetOrders() }

const requireLogin = () => {
  if (member.hasLogin) return true
  closePanel()
  uni.navigateTo({ url: '/pages/public/login' })
  return false
}
const openDestination = (destination: 'search' | 'coupons') => {
  if (destination === 'coupons' && !requireLogin()) return
  closePanel()
  uni.navigateTo({ url: destination === 'search' ? '/pages/product/search' : '/pages/coupon/couponList' })
}
const openOrder = (id: number) => {
  if (!requireLogin()) return
  closePanel()
  uni.navigateTo({ url: `/pages/order/orderDetail?orderId=${id}` })
}
const loadRecentOrders = async () => {
  if (loadingOrders.value || !requireLogin()) return
  const current = ++orderVersion
  loadingOrders.value = true
  orderHint.value = ''
  recentOrders.value = []
  try {
    // 复用按登录身份授权的订单接口；订单数据不加入模型上下文或会话缓存。
    const res = await getOrderListAPI({ status: -1, pageNum: 1, pageSize: 3 })
    if (current !== orderVersion) return
    recentOrders.value = res.data.list || []
    orderHint.value = recentOrders.value.length ? '最近订单（来自商城实时查询）' : '当前账号暂无订单。'
  } catch {
    if (current === orderVersion) orderHint.value = '订单暂时无法查询，请稍后重试或前往“我的订单”。'
  } finally {
    if (current === orderVersion) loadingOrders.value = false
  }
}
const scrollIntoView = ref('')
const viewport = ref({ width: 375, height: 667 })
const position = ref<Point>({ x: 250, y: 480 })
const dragOffset = ref<Point>({ x: 0, y: 0 })
const spriteFrame = ref(0)
const miniSpriteFrame = ref(0)
const isMounted = ref(false)
let spriteTimer: ReturnType<typeof setInterval> | undefined
let miniSpriteTimer: ReturnType<typeof setInterval> | undefined
let suppressClickTimer: ReturnType<typeof setTimeout> | undefined
let activePointerId: number | undefined
let pointerStart: Point | undefined

const spriteState = computed(() => {
  if (isDragging.value || isSending.value) return 'running'
  return isOpen.value ? 'waving' : 'idle'
})

const getSpriteFramePath = (state: SpriteState, frame: number) =>
  `${SPRITE_FRAME_ROOT}/${state}-${frame}.png`

const spriteStyle = computed(() => {
  const state = spriteState.value as SpriteState
  return {
    backgroundImage: `url("${getSpriteFramePath(state, spriteFrame.value)}")`,
    backgroundPosition: '0 0',
  }
})

const miniSpriteStyle = computed(() => ({
  backgroundImage: `url("${getSpriteFramePath('idle', miniSpriteFrame.value)}")`,
  backgroundPosition: '0 0',
}))

const showQuickQuestions = computed(() => messages.value.length === 1 && !isSending.value)

const petStyle = computed(() => ({
  left: `${position.value.x}px`,
  top: `${position.value.y}px`,
}))

const panelStyle = computed(() => {
  const panelWidth = Math.min(360, Math.max(280, viewport.value.width - 24))
  const panelHeight = Math.max(180, Math.min(540, viewport.value.height - 24))
  let left = position.value.x + PET_WIDTH - panelWidth
  let top = position.value.y - panelHeight - PANEL_GAP
  if (top < 12) top = position.value.y + PET_HEIGHT + PANEL_GAP
  left = Math.max(12, Math.min(left, viewport.value.width - panelWidth - 12))
  top = Math.max(12, Math.min(top, viewport.value.height - panelHeight - 12))
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${panelWidth}px`,
    height: `${panelHeight}px`,
    maxHeight: `${panelHeight}px`,
  }
})

const getPoint = (event: PointerEventLike): Point | null => {
  const source = event.touches?.[0] || event.changedTouches?.[0] || event
  const x = source.clientX ?? source.pageX
  const y = source.clientY ?? source.pageY
  return typeof x === 'number' && typeof y === 'number' ? { x, y } : null
}

const getViewport = () => {
  // H5 使用浏览器视口；其他端由 uni-app 提供系统尺寸。
  if (typeof window !== 'undefined') {
    return { width: window.visualViewport?.width ?? window.innerWidth, height: window.visualViewport?.height ?? window.innerHeight }
  }
  const info = uni.getSystemInfoSync()
  return { width: info.windowWidth, height: info.windowHeight }
}

const clampPosition = (point: Point): Point => ({
  x: Math.max(8, Math.min(point.x, viewport.value.width - PET_WIDTH - 8)),
  y: Math.max(8, Math.min(point.y, viewport.value.height - PET_HEIGHT - 8)),
})

const readSavedPosition = (): Point | null => {
  try {
    const saved = uni.getStorageSync(STORAGE_KEY) as Partial<Point>
    if (typeof saved?.x === 'number' && typeof saved?.y === 'number') return saved as Point
  } catch (error) {
    console.warn('读取客服位置失败', error)
  }
  return null
}

const savePosition = () => {
  try {
    uni.setStorageSync(STORAGE_KEY, position.value)
  } catch (error) {
    console.warn('保存客服位置失败', error)
  }
}

const handlePointerStart = (event: PointerEventLike) => {
  if (isPointerActive.value) return
  const point = getPoint(event)
  if (!point) return
  if (suppressClickTimer) {
    clearTimeout(suppressClickTimer)
    suppressClickTimer = undefined
  }
  const current = position.value
  dragOffset.value = { x: point.x - current.x, y: point.y - current.y }
  pointerStart = point
  activePointerId = event.pointerId
  isPointerActive.value = true
  isDragging.value = false
  suppressClick.value = false
  if (typeof window !== 'undefined') {
    window.addEventListener('pointermove', handlePointerMove as EventListener, { passive: false })
    window.addEventListener('pointerup', handlePointerEnd as EventListener)
    window.addEventListener('pointercancel', handlePointerEnd as EventListener)
    window.addEventListener('mousemove', handlePointerMove as EventListener)
    window.addEventListener('mouseup', handlePointerEnd as EventListener)
    window.addEventListener('touchmove', handlePointerMove as EventListener, { passive: false })
    window.addEventListener('touchend', handlePointerEnd as EventListener)
    window.addEventListener('touchcancel', handlePointerEnd as EventListener)
  }
}

const handlePointerMove = (event: PointerEventLike) => {
  if (!isPointerActive.value) return
  if (activePointerId !== undefined && event.pointerId !== undefined && event.pointerId !== activePointerId) return
  const point = getPoint(event)
  if (!point) return
  if (!isDragging.value && pointerStart) {
    const distance = Math.hypot(point.x - pointerStart.x, point.y - pointerStart.y)
    if (distance < 5) return
    isDragging.value = true
  }
  const next = clampPosition({
    x: point.x - dragOffset.value.x,
    y: point.y - dragOffset.value.y,
  })
  if (Math.abs(next.x - position.value.x) > 2 || Math.abs(next.y - position.value.y) > 2) {
    suppressClick.value = true
  }
  position.value = next
  if (typeof event.preventDefault === 'function') event.preventDefault()
}

const handlePointerEnd = () => {
  if (!isPointerActive.value) return
  const didDrag = isDragging.value
  isPointerActive.value = false
  isDragging.value = false
  pointerStart = undefined
  activePointerId = undefined
  if (didDrag) savePosition()
  if (typeof window !== 'undefined') {
    window.removeEventListener('pointermove', handlePointerMove as EventListener)
    window.removeEventListener('pointerup', handlePointerEnd as EventListener)
    window.removeEventListener('pointercancel', handlePointerEnd as EventListener)
    window.removeEventListener('mousemove', handlePointerMove as EventListener)
    window.removeEventListener('mouseup', handlePointerEnd as EventListener)
    window.removeEventListener('touchmove', handlePointerMove as EventListener)
    window.removeEventListener('touchend', handlePointerEnd as EventListener)
    window.removeEventListener('touchcancel', handlePointerEnd as EventListener)
  }
  if (didDrag) {
    suppressClickTimer = setTimeout(() => {
      suppressClick.value = false
      suppressClickTimer = undefined
    }, 350)
  }
}

const handlePetClick = () => {
  if (suppressClick.value) return
  isOpen.value = !isOpen.value
}

const closePanel = () => {
  isOpen.value = false
}

const handleResize = () => {
  viewport.value = getViewport()
  position.value = clampPosition(position.value)
}

const stopSpriteTimer = () => {
  if (spriteTimer) {
    clearInterval(spriteTimer)
    spriteTimer = undefined
  }
}

const restartSpriteTimer = () => {
  stopSpriteTimer()
  if (!isMounted.value) return
  const config = SPRITE_CONFIG[spriteState.value as SpriteState]
  spriteFrame.value = 0
  spriteTimer = setInterval(() => {
    spriteFrame.value = (spriteFrame.value + 1) % config.frames
  }, config.frameDuration)
}

const stopMiniSpriteTimer = () => {
  if (miniSpriteTimer) {
    clearInterval(miniSpriteTimer)
    miniSpriteTimer = undefined
  }
}

const startMiniSpriteTimer = () => {
  stopMiniSpriteTimer()
  if (!isMounted.value || !isOpen.value) return
  miniSpriteFrame.value = 0
  miniSpriteTimer = setInterval(() => {
    miniSpriteFrame.value = (miniSpriteFrame.value + 1) % SPRITE_CONFIG.idle.frames
  }, SPRITE_CONFIG.idle.frameDuration)
}

const preloadSpriteFrames = () => {
  if (typeof Image === 'undefined') return
  ;(Object.keys(SPRITE_CONFIG) as SpriteState[]).forEach((state) => {
    for (let frame = 0; frame < SPRITE_CONFIG[state].frames; frame += 1) {
      const image = new Image()
      image.src = getSpriteFramePath(state, frame)
    }
  })
}

watch(spriteState, restartSpriteTimer)
watch(isOpen, async opened => {
  inputFocused.value = false
  startMiniSpriteTimer()
  await nextTick()
  inputFocused.value = opened
  if (!opened && typeof document !== 'undefined') {
    document.querySelector<HTMLElement>('.assistant-pet__trigger')?.focus()
  }
})
const handleKeydown = (event: KeyboardEvent) => { if (event.key === 'Escape' && isOpen.value) closePanel() }
const handleVisibility = () => {
  if (document.hidden) { stopSpriteTimer(); stopMiniSpriteTimer() }
  else { restartSpriteTimer(); startMiniSpriteTimer() }
}

watch(messages, async () => {
  scrollIntoView.value = ''
  await nextTick()
  if (messages.value.length > 0) scrollIntoView.value = `assistant-message-${messages.value.length - 1}`
}, { deep: true })

onMounted(() => {
  isMounted.value = true
  preloadSpriteFrames()
  restartSpriteTimer()
  startMiniSpriteTimer()
  viewport.value = getViewport()
  const saved = readSavedPosition()
  position.value = clampPosition(saved || {
    x: viewport.value.width - PET_WIDTH - 18,
    y: viewport.value.height - PET_HEIGHT - 150,
  })
  if (typeof window !== 'undefined') window.addEventListener('resize', handleResize)
  if (typeof window !== 'undefined') {
    window.visualViewport?.addEventListener('resize', handleResize)
    window.addEventListener('keydown', handleKeydown)
    document.addEventListener('visibilitychange', handleVisibility)
  }
})

onBeforeUnmount(() => {
  handlePointerEnd()
  isMounted.value = false
  stopSpriteTimer()
  stopMiniSpriteTimer()
  if (suppressClickTimer) clearTimeout(suppressClickTimer)
  if (typeof window !== 'undefined') window.removeEventListener('resize', handleResize)
  if (typeof window !== 'undefined') {
    window.visualViewport?.removeEventListener('resize', handleResize)
    window.removeEventListener('keydown', handleKeydown)
    document.removeEventListener('visibilitychange', handleVisibility)
  }
})
</script>

<style lang="scss">
.assistant-pet__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 12px;
  flex-shrink: 0;
  button { margin: 0; padding: 0 8px; font-size: 12px; color: #a62a51; background: #fff1f5; }
}
.assistant-order-card {
  display: flex;
  flex-direction: column;
  text-align: left;
  margin: 8px 0;
  padding: 8px 12px;
  font-size: 12px;
  line-height: 1.8;
  background: #fff1f5;
  color: #73364a;
}
.assistant-pet__trigger:focus-visible { outline: 2px solid #a62a51; border-radius: 12px; }
.assistant-pet {
  position: fixed;
  z-index: 9999;
  left: 0;
  top: 0;
  width: 100vw;
  height: 100vh;
  overflow: visible;
  pointer-events: none;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.assistant-pet__trigger {
  position: absolute;
  z-index: 4;
  width: 104px;
  height: 112px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  cursor: grab;
  user-select: none;
  touch-action: none;
}

.assistant-pet__trigger:active {
  cursor: grabbing;
}

.assistant-pet__halo {
  position: absolute;
  width: 82px;
  height: 28px;
  bottom: 5px;
  border-radius: 50%;
  background: rgba(250, 67, 106, 0.14);
  filter: blur(1px);
}

.assistant-pet__sprite,
.assistant-pet__mini-sprite {
  position: relative;
  z-index: 1;
  width: 96px;
  height: 104px;
  background-image: none;
  background-repeat: no-repeat;
  background-position: 0 0;
  background-size: 100% 100%;
  transition: none !important;
  image-rendering: auto;
}

.assistant-pet__sprite--idle {
  /* 每一帧都是独立图片，切换时不会把整张图集横向插值。 */
  animation: none;
}

.assistant-pet__hint {
  position: absolute;
  right: 2px;
  top: -2px;
  z-index: 2;
  padding: 7px 10px;
  border: 1px solid rgba(250, 67, 106, 0.14);
  border-radius: 14px 14px 3px 14px;
  color: #5d3041;
  background: #fff7f9;
  box-shadow: 0 8px 22px rgba(71, 26, 44, 0.13);
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
}

.assistant-pet__panel {
  position: absolute;
  z-index: 5;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  pointer-events: auto;
  border: 1px solid #f0d9df;
  border-radius: 18px;
  background: #ffffff;
  box-shadow: 0 18px 48px rgba(67, 30, 43, 0.2);
}

.assistant-pet__panel-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 13px 14px 11px;
  background: linear-gradient(135deg, #fff5f7 0%, #fff 72%);
  border-bottom: 1px solid #f5e6ea;
}

.assistant-pet__identity {
  display: flex;
  align-items: center;
  min-width: 0;
}

.assistant-pet__mini-sprite {
  flex: 0 0 42px;
  width: 42px;
  height: 46px;
  margin-right: 8px;
  background-position: 0 0;
  background-size: 100% 100%;
  animation: none;
}

.assistant-pet__title,
.assistant-pet__status {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.assistant-pet__title {
  color: #2f2730;
  font-size: 15px;
  font-weight: 700;
  line-height: 22px;
}

.assistant-pet__status {
  color: #8b7880;
  font-size: 11px;
  line-height: 17px;
}

.assistant-pet__status-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 4px;
  border-radius: 50%;
  background: #35b879;
}

.assistant-pet__header-actions {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
}

.assistant-pet__icon-button {
  width: 30px;
  height: 30px;
  padding: 0;
  margin-left: 4px;
  border: 0;
  border-radius: 50%;
  color: #806a72;
  background: transparent;
  font-size: 20px;
  line-height: 30px;
  text-align: center;
}

.assistant-pet__icon-button:active {
  background: #fff0f3;
}

.assistant-pet__icon-button[disabled] {
  opacity: 0.4;
}

.assistant-pet__messages {
  flex: 1;
  min-height: 0;
  padding: 14px 12px 8px;
  background: #fffafb;
}

.assistant-pet__message-row {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 10px;
}

.assistant-pet__message-row--user {
  justify-content: flex-end;
}

.assistant-pet__message {
  max-width: 84%;
  padding: 9px 11px;
  border-radius: 13px 13px 13px 4px;
  color: #44383e;
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(70, 37, 48, 0.06);
  font-size: 13px;
  line-height: 20px;
  white-space: pre-wrap;
  word-break: break-word;
}

.assistant-pet__message--user {
  border-radius: 13px 13px 4px 13px;
  color: #ffffff;
  background: #fa436a;
}

.assistant-pet__typing {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 44px;
  padding: 11px;
}

.assistant-pet__typing-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #d997a8;
  animation: assistant-pet-typing 1s ease-in-out infinite;
}

.assistant-pet__typing-dot:nth-child(2) { animation-delay: 0.15s; }
.assistant-pet__typing-dot:nth-child(3) { animation-delay: 0.3s; }

@keyframes assistant-pet-typing {
  0%, 60%, 100% { opacity: 0.35; transform: translateY(0); }
  30% { opacity: 1; transform: translateY(-3px); }
}

.assistant-pet__error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 9px;
  color: #a5485d;
  background: #fff0f2;
  font-size: 12px;
  line-height: 18px;
}

.assistant-pet__retry {
  flex: 0 0 auto;
  padding: 2px 7px;
  border: 1px solid #e8a5b3;
  border-radius: 10px;
  color: #b6425d;
  background: #fff;
  font-size: 11px;
  line-height: 18px;
}

.assistant-pet__quick-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 12px 4px;
  background: #fffafb;
}

.assistant-pet__quick-question {
  max-width: 100%;
  padding: 5px 9px;
  border: 1px solid #f1cbd4;
  border-radius: 12px;
  color: #a43f58;
  background: #fff;
  font-size: 11px;
  line-height: 17px;
  white-space: nowrap;
}

.assistant-pet__composer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 10px 12px 7px;
  border-top: 1px solid #f5e6ea;
  background: #ffffff;
}

.assistant-pet__input {
  flex: 1;
  min-width: 0;
  height: 36px;
  padding: 0 11px;
  border: 1px solid #eadde1;
  border-radius: 10px;
  color: #3f3439;
  background: #fffafb;
  font-size: 13px;
  line-height: 36px;
}

.assistant-pet__input:focus {
  border-color: #f29aae;
  outline: none;
}

.assistant-pet__send {
  flex: 0 0 auto;
  min-width: 52px;
  height: 36px;
  padding: 0 10px;
  border: 0;
  border-radius: 10px;
  color: #ffffff;
  background: #fa436a;
  font-size: 12px;
  line-height: 36px;
}

.assistant-pet__send[disabled] {
  opacity: 0.45;
}

.assistant-pet__disclaimer {
  flex-shrink: 0;
  display: block;
  padding: 0 12px 10px;
  color: #ad9ca2;
  background: #ffffff;
  font-size: 10px;
  line-height: 16px;
}

button::after {
  border: none;
}

@media (max-width: 420px) {
  .assistant-pet__panel {
    border-radius: 15px;
  }

  .assistant-pet__message {
    max-width: 88%;
  }
}
</style>
