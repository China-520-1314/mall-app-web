const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const vue = require('vue')

function setup(props) {
  const source = fs.readFileSync(path.join(__dirname, '../src/components/uni-number-box.vue'), 'utf8')
    .match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
  const code = ts.transpileModule(source + '\nexports.box = { inputValue, _calcValue, _onBlur };', {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const context = { exports: {}, require: () => vue, defineProps: () => props, defineEmits: () => () => {} }
  const scope = vue.effectScope()
  scope.run(() => vm.runInNewContext(code, context))
  return { ...context.exports.box, stop: () => scope.stop() }
}

test('小数步长到达上下界时保持正确数量', () => {
  const box = setup({ value: 0.9, min: 0.5, max: 1, step: 0.2 })
  try {
    box._calcValue('add')
    assert.equal(box.inputValue.value, 1)
    box._calcValue('subtract')
    assert.equal(box.inputValue.value, 0.8)
    box._calcValue('subtract')
    box._calcValue('subtract')
    assert.equal(box.inputValue.value, 0.5)
  } finally { box.stop() }
})

test('禁用状态不能通过按钮或失焦修改数量', () => {
  const box = setup({ value: 2, disabled: true })
  try {
    box._calcValue('add')
    box._onBlur({ detail: { value: '9' } })
    assert.equal(box.inputValue.value, 2)
  } finally { box.stop() }
})

test('非法输入回到有效下界，手动输入后可以重新递增', () => {
  const box = setup({ value: 1, min: 1, max: 3 })
  try {
    box._onBlur({ detail: { value: '3' } })
    box._onBlur({ detail: { value: 'invalid' } })
    assert.equal(box.inputValue.value, 1)
    box._calcValue('add')
    assert.equal(box.inputValue.value, 2)
  } finally { box.stop() }
})
