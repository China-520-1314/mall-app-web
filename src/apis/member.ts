import { http } from '@/utils/http'
import type {
  LoginResult,
  MemberInfo,
  LoginParam,
  RegisterParam,
  ResetPasswordParam,
  EmailCodePurpose,
  EmailCodeSendResult,
} from '@/types/member'

/** 登录 */
export const loginAPI = (data: LoginParam) => {
  return http<LoginResult>({
    method: 'POST',
    url: '/sso/login',
    header: {
      'content-type': 'application/x-www-form-urlencoded;charset=utf-8',
    },
    data,
  })
}

/** 通过QQ邮箱验证码登录 */
export const loginByEmailCodeAPI = (data: { email: string; authCode: string }) => {
  return http<LoginResult>({
    method: 'POST',
    url: '/sso/loginByEmailCode',
    auth: false,
    header: { 'content-type': 'application/x-www-form-urlencoded;charset=utf-8' },
    data,
  })
}

/** 获取用户信息 */
export const getMemberInfoAPI = () => {
  return http<MemberInfo>({
    method: 'GET',
    url: '/sso/info',
  })
}

/** 注册 */
export const registerAPI = (data: RegisterParam) => {
  return http({
    method: 'POST',
    url: '/sso/register',
    header: {
      'content-type': 'application/x-www-form-urlencoded;charset=utf-8',
    },
    data,
  })
}

/** 发送QQ邮箱验证码 */
export const sendEmailCodeAPI = (email: string, purpose: EmailCodePurpose) => {
  return http({
    method: 'POST',
    url: '/sso/sendEmailCode',
    timeout: 30000,
    auth: purpose === 'CHANGE_PASSWORD',
    header: {
      'content-type': 'application/x-www-form-urlencoded;charset=utf-8',
    },
    data: { email, purpose },
  })
}

/** 通过邮箱验证码重置密码 */
export const resetPasswordAPI = (data: ResetPasswordParam) => {
  return http({
    method: 'POST',
    url: '/sso/updatePassword',
    header: {
      'content-type': 'application/x-www-form-urlencoded;charset=utf-8',
    },
    data,
  })
}

/** 发送当前账号的修改密码验证码 */
export const sendChangePasswordEmailCodeAPI = () => {
  return http<EmailCodeSendResult>({
    method: 'POST',
    url: '/sso/sendChangePasswordEmailCode',
    timeout: 30000,
  })
}

/** 修改当前登录会员密码 */
export const changePasswordAPI = (data: {
  authCode: string
  newPassword: string
  confirmPassword: string
}) => {
  return http({
    method: 'POST',
    url: '/sso/changePassword',
    header: { 'content-type': 'application/x-www-form-urlencoded;charset=utf-8' },
    data,
  })
}
