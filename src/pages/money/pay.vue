<template>
  <view class="app">
    <view class="price-box">
      <text>支付金额</text>
      <text class="price">{{ orderInfo.payAmount }}</text>
    </view>

    <view class="pay-type-list">
      <view class="type-item b-b" @click="handleChangePayType(1)">
        <text class="icon yticon icon-alipay"></text>
        <view class="con">
          <text class="tit">支付宝支付</text>
          <text>推荐使用支付宝支付</text>
        </view>
        <label class="radio">
          <radio name="payType" value="" color="#fa436a" :checked="payType == 1" />
        </label>
      </view>
      <view class="type-item b-b" @click="handleChangePayType(2)">
        <text class="icon yticon icon-weixinzhifu"></text>
        <view class="con">
          <text class="tit">微信支付</text>
        </view>
        <label class="radio">
          <radio name="payType" value="" color="#fa436a" :checked="payType == 2" />
        </label>
      </view>
    </view>

    <text class="mix-btn" @click="handleConfirmPay">确认支付</text>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getOrderDetailAPI, createWechatNativePayAPI } from '@/apis/order'
import type { OmsOrderDetail } from '@/types/order'

// 是否使用支付宝支付（H5端启用，通过环境变量配置）
const USE_ALIPAY = import.meta.env.VITE_USE_ALIPAY === 'true'

// ===== 页面数据 =====
// 订单ID
const orderId = ref<number | null>(null)
// 支付方式：1->支付宝；2->微信
const payType = ref(1)
// 订单信息
const orderInfo = ref<Partial<OmsOrderDetail>>({})

// ===== 数据加载 =====
// 加载订单详情
const loadData = async () => {
  try {
    const res = await getOrderDetailAPI(orderId.value!)
    orderInfo.value = res.data
  } catch (e) {
    console.error('加载订单详情失败', e)
  }
}

// ===== 生命周期 =====
// 页面加载
onLoad(async (options: any) => {
  orderId.value = options.orderId
  loadData()
})

// ===== 事件处理方法 =====
// 选择支付方式
const handleChangePayType = (type: number) => {
  payType.value = type
}

// 确认支付
const handleConfirmPay = async () => {
  // H5 真实支付：支付宝跳转收银台；微信需在具备微信商户配置的端到端接口后启用。
  if (payType.value === 2) {
    try {
      const res = await createWechatNativePayAPI(orderId.value!)
      // Native 支付返回二维码地址；H5 环境打开地址便于扫码工具读取。
      uni.setClipboardData({ data: res.data.codeUrl })
      uni.showModal({ title: '微信支付二维码地址', content: res.data.codeUrl, showCancel: false })
    } catch (e) {
      uni.showToast({ title: '微信支付暂未配置或创建失败', icon: 'none' })
    }
    return
  }
  if (USE_ALIPAY) {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
    window.location.href = apiBaseUrl + '/alipay/webPay?outTradeNo=' + encodeURIComponent(String(orderInfo.value.orderSn)) + '&subject=' + encodeURIComponent((orderInfo.value.receiverName || 'Mall') + '的商品订单') + '&totalAmount=' + encodeURIComponent(String(orderInfo.value.payAmount || orderInfo.value.totalAmount))
    return
  }
  /* 本地开发模式仅允许显式调用模拟成功接口，生产环境必须配置 VITE_USE_ALIPAY=true。 */
  if (import.meta.env.PROD) {
    uni.showToast({ title: '支付服务未配置', icon: 'none' })
    return
  }
  // ===== 开发环境模拟支付 =====
  // if (USE_ALIPAY) {
  //   if (payType.value != 1) {
  //     uni.showToast({
  //       title: '暂不支持微信支付！',
  //       icon: 'none',
  //     })
  //     return
  //   }
  //   const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
  //   window.location.href =
  //     apiBaseUrl +
  //     '/alipay/webPay?outTradeNo=' +
  //     orderInfo.value.orderSn +
  //     '&subject=' +
  //     orderInfo.value.receiverName +
  //     '的商品订单' +
  //     '&totalAmount=' +
  //     orderInfo.value.totalAmount
  //   return
  // }
  // ===== 原逻辑结束 =====

  try {
    await payOrderSuccessAPI({
      orderId: orderId.value!,
      payType: payType.value,
    })
    uni.redirectTo({
      url: '/pages/money/paySuccess',
    })
  } catch (e) {
    console.error('支付失败', e)
  }
}
</script>

<style lang="scss" scoped>
.app {
  width: 100%;
}

.price-box {
  background-color: #fff;
  height: 265rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  font-size: 28rpx;
  color: #909399;

  .price {
    font-size: 50rpx;
    color: #303133;
    margin-top: 12rpx;

    &:before {
      content: '￥';
      font-size: 40rpx;
    }
  }
}

.pay-type-list {
  margin-top: 20rpx;
  background-color: #fff;
  padding-left: 60rpx;

  .type-item {
    height: 120rpx;
    padding: 20rpx 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-right: 60rpx;
    font-size: 30rpx;
    position: relative;
  }

  .icon {
    width: 100rpx;
    font-size: 52rpx;
  }

  .icon-erjiye-yucunkuan {
    color: #fe8e2e;
  }

  .icon-weixinzhifu {
    color: #36cb59;
  }

  .icon-alipay {
    color: #01aaef;
  }

  .tit {
    font-size: $font-lg;
    color: $font-color-dark;
    margin-bottom: 4rpx;
  }

  .con {
    flex: 1;
    display: flex;
    flex-direction: column;
    font-size: $font-sm;
    color: $font-color-light;
  }
}

.mix-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 630rpx;
  height: 80rpx;
  margin: 80rpx auto 30rpx;
  font-size: $font-lg;
  color: #fff;
  background-color: $base-color;
  border-radius: 10rpx;
  box-shadow: 1px 2px 5px rgba(219, 63, 96, 0.4);
}
</style>
