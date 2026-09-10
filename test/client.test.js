import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')

// Run the shipped module through its public loader and header slot.
function setup(initial = '1') {
  let plugin, Header, observerCallback, cleanup
  const handlers = new Map()
  const frames = new Map()
  const storage = new Map([['dsh-think-expand.expandAll', initial]])
  const rows = []
  let frameId = 0
  class Element {
    constructor(parent = null) { this.parent = parent }
    closest() {
      for (let node = this; node; node = node.parent) {
        if (rows.includes(node)) return node
      }
      return null
    }
    contains(target) {
      for (let node = target; node; node = node.parent) {
        if (node === this) return true
      }
      return false
    }
  }
  const dispatch = (type, target, key) => handlers.get(type)?.({ type, target, key })
  const addRow = (open = false) => {
    const row = new Element()
    const toggle = new Element(row)
    row.open = open
    row.toggle = toggle
    row.body = new Element(row)
    row.icon = new Element(toggle)
    row.querySelector = () => toggle
    toggle.getAttribute = () => String(row.open)
    toggle.click = () => {
      dispatch('click', toggle)
      row.open = !row.open
      observerCallback?.()
    }
    rows.push(row)
    observerCallback?.()
    return row
  }
  const flush = () => {
    for (let i = 0; frames.size; i++) {
      assert.ok(i < 20, 'observer must settle')
      const pending = [...frames.values()]
      frames.clear()
      for (const callback of pending) callback()
    }
  }
  const React = { useState: () => [0, () => {}], useEffect: () => {} }
  vm.runInNewContext(source, {
    Element,
    window: { __ModuleLoader__: { load({ factory }) {
      plugin = factory((name) => name === 'react'
        ? React : { jsx: (type, props) => ({ type, props }) })
    } } },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    document: {
      documentElement: {},
      querySelectorAll: () => rows,
      addEventListener: (type, handler) => handlers.set(type, handler),
      removeEventListener: (type) => handlers.delete(type),
    },
    MutationObserver: class {
      constructor(callback) { observerCallback = callback }
      observe() {}
      disconnect() {}
    },
    requestAnimationFrame(callback) {
      frames.set(++frameId, callback)
      return frameId
    },
    cancelAnimationFrame: (id) => frames.delete(id),
  })
  plugin.apply({
    effect(callback) { cleanup = callback() },
    slots: {
      inject(name, callback) { callback() },
      register(options, component) { Header = component },
    },
  })
  const bulk = () => { Header().props.onClick(); flush() }
  return { addRow, flush, bulk, dispatch, cleanup: () => cleanup(), rows, storage }
}

test('bulk switch reopens manually collapsed rows across repeated cycles', () => {
  const app = setup()
  const first = app.addRow()
  const second = app.addRow()
  app.flush()
  assert.deepEqual(app.rows.map(row => row.open), [true, true])
  for (let i = 0; i < 3; i++) {
    first.toggle.click()
    app.flush()
    assert.equal(first.open, false)
    assert.equal(second.open, true)
    app.bulk()
    assert.deepEqual(app.rows.map(row => row.open), [false, false])
    app.bulk()
    assert.deepEqual(app.rows.map(row => row.open), [true, true])
  }
  app.cleanup()
})

test('bulk collapse includes rows manually opened while disabled', () => {
  const app = setup('0')
  const row = app.addRow()
  app.flush()
  assert.equal(row.open, false)
  row.toggle.click()
  app.flush()
  assert.equal(row.open, true)
  app.bulk()
  app.bulk()
  assert.equal(row.open, false)
  assert.equal(app.storage.get('dsh-think-expand.expandAll'), '0')
})

test('body clicks and body keyboard events do not record a manual collapse', () => {
  for (const type of ['click', 'keydown']) {
    const app = setup()
    const row = app.addRow()
    app.flush()
    app.dispatch(type, row.body, 'Enter')
    // Simulate the host replacing the disclosure content in this row.
    row.open = false
    app.addRow()
    app.flush()
    assert.equal(row.open, true)
  }
})

test('nested toggle targets and keyboard activation retain manual intent until bulk action', () => {
  for (const type of ['click', 'keydown']) {
    const app = setup()
    const row = app.addRow()
    app.flush()
    app.dispatch(type, row.icon, 'Enter')
    row.open = false
    const newRow = app.addRow()
    app.flush()
    assert.equal(row.open, false)
    assert.equal(newRow.open, true)
    app.bulk()
    app.bulk()
    assert.equal(row.open, true)
  }
})
