const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const vue = require('vue')

function setup() {
  const member = vue.reactive({ memberInfo: { id: 1 } })
  const pending = []
  const storage = new Map()
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/composables/useAssistantChat.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(code, {
    exports, Date, JSON,
    sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    require: name => {
      if (name === 'vue') return vue
      if (name === '@/stores/member') return { useMemberStore: () => member }
      if (name === '@/apis/assistant') return { sendAssistantMessageAPI: request => new Promise((resolve, reject) => pending.push({ request, resolve, reject })) }
      throw new Error(`Unexpected module: ${name}`)
    },
  })
  const scope = vue.effectScope()
  const chat = scope.run(() => exports.useAssistantChat())
  return { chat, member, pending, storage, stop: () => scope.stop() }
}

test('账号切换后丢弃旧请求，不覆盖新账号的发送状态与记录', async () => {
  const ctx = setup()
  try {
    const oldRequest = ctx.chat.sendMessage('旧账号问题')
    ctx.member.memberInfo = { id: 2 }
    assert.equal(ctx.chat.messages.value.length, 1)
    const newRequest = ctx.chat.sendMessage('新账号问题')
    ctx.pending[0].resolve({ data: { reply: '旧账号回答', fallback: false } })
    await oldRequest
    assert.equal(ctx.chat.isSending.value, true)
    assert.equal(ctx.chat.messages.value.some(item => item.content === '旧账号回答'), false)
    ctx.pending[1].resolve({ data: { reply: '新账号回答', fallback: true } })
    await newRequest
    assert.equal(ctx.chat.isSending.value, false)
    assert.equal(ctx.chat.messages.value.at(-1).content, '新账号回答')
  } finally { ctx.stop() }
})

test('保留等待时输入的草稿，限制历史长度，并保留具体失败原因', async () => {
  const ctx = setup()
  try {
    ctx.chat.messages.value = Array.from({ length: 60 }, () => ({ role: 'assistant', content: 'a'.repeat(1500) }))
    ctx.chat.inputValue.value = '当前问题'
    const request = ctx.chat.sendMessage()
    ctx.chat.inputValue.value = '下一条草稿'
    assert.equal(ctx.pending[0].request.history.length, 8)
    assert.ok(ctx.pending[0].request.history.every(item => item.content.length === 800))
    ctx.pending[0].reject({ data: { message: '客服繁忙，请稍后重试' } })
    await request
    assert.equal(ctx.chat.inputValue.value, '下一条草稿')
    assert.equal(ctx.chat.errorMessage.value, '客服繁忙，请稍后重试')
    assert.ok(ctx.chat.messages.value.length <= 60)
  } finally { ctx.stop() }
})
