import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { JSDOM } from 'jsdom'

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')

/**
 * Run the shipped module in jsdom against a small model of the DSH 0.1.7
 * conversation markup: Think rows, step groups, and whole-turn folds.
 */
function setup(initial = '1') {
  const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/', runScripts: 'outside-only' })
  const { window } = dom
  const { document } = window
  window.localStorage.setItem('dsh-think-expand.expandAll', initial)
  const frames = []
  window.requestAnimationFrame = (callback) => frames.push(callback)
  window.cancelAnimationFrame = () => {}
  let plugin, Header, cleanup
  window.__ModuleLoader__ = { load({ factory }) {
    plugin = factory((name) => name === 'react'
      ? { useState: () => [0, () => {}], useEffect: () => {} }
      : { jsx: (type, props) => ({ type, props }) })
  } }
  window.eval(source)
  plugin.apply({
    effect(callback) { cleanup = callback() },
    slots: {
      inject(name, callback) { callback() },
      register(options, component) { Header = component },
    },
  })
  let nextId = 0
  const focused = []

  const el = (tag, attrs = {}, parent = document.body) => {
    const node = document.createElement(tag)
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value)
    parent.append(node)
    return node
  }
  const hide = (node, hidden) => {
    if (hidden) node.setAttribute('hidden', 'until-found')
    else node.removeAttribute('hidden')
  }

  /** ReasoningRow + DisclosureRow with `expandOnRowClick`. */
  const think = (parent = document.body) => {
    const root = el('div', { 'data-variant': 'think' }, parent)
    const toggle = el('div', { 'data-disclosure-row': '', role: 'button', tabindex: '0', 'aria-expanded': 'false' }, root)
    const icon = el('span', {}, toggle)
    let body = null
    const set = (open) => {
      toggle.setAttribute('aria-expanded', String(open))
      if (open && body === null) body = el('div', { class: 'thinkBody' }, root)
      if (!open && body !== null) { body.remove(); body = null }
    }
    toggle.addEventListener('click', () => set(toggle.getAttribute('aria-expanded') !== 'true'))
    return {
      root, toggle, icon, reset: () => set(false),
      get open() { return toggle.getAttribute('aria-expanded') === 'true' },
      get body() { return body },
    }
  }

  /** ChatGroupSeat: header button controlling a searchable-hidden body. */
  const group = (parent = document.body, turn) => {
    const root = el('div', { 'data-step-process': '', ...(turn === undefined ? {} : { 'data-chat-turn': String(turn) }) }, parent)
    const id = `:r${nextId++}:`
    const header = el('button', { type: 'button', 'aria-expanded': 'false', 'aria-controls': id }, el('div', {}, root))
    const body = el('div', { id, 'data-step-process-body': '', hidden: 'until-found' }, root)
    const content = el('div', { 'data-step-process-content': '' }, body)
    const set = (open) => {
      header.setAttribute('aria-expanded', String(open))
      hide(body, !open)
    }
    header.addEventListener('click', (event) => {
      event.currentTarget.focus()
      if (document.activeElement === header) focused.push(header)
      set(header.getAttribute('aria-expanded') !== 'true')
    })
    return {
      root, header, content, set,
      get open() { return header.getAttribute('aria-expanded') === 'true' },
    }
  }

  /**
   * TurnProcessNodeView plus the process members it folds. Folding hides each
   * member, closes its groups, and resets its Think rows like the host does.
   */
  const turn = (number, open = false) => {
    const button = el('button', { type: 'button', 'data-turn-process': String(number), 'aria-expanded': String(open) })
    const members = []
    const set = (next) => {
      button.setAttribute('aria-expanded', String(next))
      for (const member of members) {
        hide(member.wrapper, !next)
        if (next) continue
        member.group?.set(false)
        for (const row of member.rows) row.reset()
      }
    }
    button.addEventListener('click', (event) => {
      event.currentTarget.focus()
      if (document.activeElement === button) focused.push(button)
      set(button.getAttribute('aria-expanded') !== 'true')
    })
    const member = () => {
      const wrapper = el('div', { 'data-chat-turn': String(number), 'data-turn-process-member': '' })
      hide(wrapper, button.getAttribute('aria-expanded') !== 'true')
      const entry = { wrapper, rows: [], group: undefined }
      members.push(entry)
      return entry
    }
    return {
      button, set,
      get open() { return button.getAttribute('aria-expanded') === 'true' },
      /** A Think row directly in a process member. */
      think() { const entry = member(); const row = think(entry.wrapper); entry.rows.push(row); return row },
      /** A step group in a process member, filled with Think rows. */
      group(count = 1) {
        const entry = member()
        entry.group = group(entry.wrapper)
        const rows = Array.from({ length: count }, () => think(entry.group.content))
        entry.rows.push(...rows)
        return { ...entry.group, rows, get open() { return entry.group.open } }
      },
    }
  }

  const flush = async () => {
    for (let i = 0; ; i++) {
      assert.ok(i < 30, 'observer must settle')
      await new Promise(resolve => setTimeout(resolve, 0))
      if (frames.length === 0) return
      for (const callback of frames.splice(0)) callback()
    }
  }
  const bulk = async () => { Header().props.onClick(); await flush() }
  const click = (node) => node.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  const key = (node) => node.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))

  return {
    window, document, think, group, turn, flush, bulk, click, key, focused,
    cleanup: () => cleanup(), storage: window.localStorage,
  }
}

test('bulk switch reopens manually collapsed rows across repeated cycles', async () => {
  const app = setup()
  const first = app.think()
  const second = app.think()
  await app.flush()
  assert.deepEqual([first.open, second.open], [true, true])
  for (let i = 0; i < 3; i++) {
    first.toggle.click()
    await app.flush()
    assert.equal(first.open, false)
    assert.equal(second.open, true)
    await app.bulk()
    assert.deepEqual([first.open, second.open], [false, false])
    await app.bulk()
    assert.deepEqual([first.open, second.open], [true, true])
  }
  app.cleanup()
})

test('bulk collapse includes rows manually opened while disabled', async () => {
  const app = setup('0')
  const row = app.think()
  await app.flush()
  assert.equal(row.open, false)
  row.toggle.click()
  await app.flush()
  assert.equal(row.open, true)
  await app.bulk()
  await app.bulk()
  assert.equal(row.open, false)
  assert.equal(app.storage.getItem('dsh-think-expand.expandAll'), '0')
})

test('body clicks and body keyboard events do not record a manual collapse', async () => {
  for (const send of ['click', 'key']) {
    const app = setup()
    const row = app.think()
    await app.flush()
    app[send](row.body)
    // Simulate the host resetting this row in place.
    row.reset()
    await app.flush()
    assert.equal(row.open, true)
  }
})

test('nested toggle targets and keyboard activation retain manual intent until bulk action', async () => {
  for (const send of ['click', 'key']) {
    const app = setup()
    const row = app.think()
    await app.flush()
    app[send](row.icon)
    row.reset()
    const newRow = app.think()
    await app.flush()
    assert.equal(row.open, false)
    assert.equal(newRow.open, true)
    await app.bulk()
    await app.bulk()
    assert.equal(row.open, true)
  }
})

test('opens step groups holding Think rows and leaves other groups closed', async () => {
  const app = setup()
  const withThink = app.group()
  const row = app.think(withThink.content)
  const toolsOnly = app.group()
  await app.flush()
  assert.equal(withThink.open, true)
  assert.equal(row.open, true)
  assert.equal(toolsOnly.open, false)
})

test('opens a folded turn, then the groups inside it, then their Think rows', async () => {
  const app = setup()
  const turn = app.turn(3)
  const grouped = turn.group(2)
  const direct = turn.think()
  await app.flush()
  assert.equal(turn.open, true)
  assert.equal(grouped.open, true)
  assert.deepEqual(grouped.rows.map(row => row.open), [true, true])
  assert.equal(direct.open, true)
})

test('reopens a turn the host folds when it finishes', async () => {
  const app = setup()
  const turn = app.turn(1, true)
  const grouped = turn.group()
  await app.flush()
  assert.equal(grouped.rows[0].open, true)
  turn.set(false)
  await app.flush()
  assert.equal(turn.open, true)
  assert.equal(grouped.open, true)
  assert.equal(grouped.rows[0].open, true)
})

test('opening groups and turns never moves focus', async () => {
  const app = setup()
  const turn = app.turn(2)
  turn.group()
  await app.flush()
  assert.equal(turn.open, true)
  assert.deepEqual(app.focused, [])
})

test('groups and turns the user closes stay closed until the next bulk action', async () => {
  const app = setup()
  const turn = app.turn(5)
  const grouped = turn.group()
  const other = app.group()
  app.think(other.content)
  await app.flush()
  assert.equal(grouped.open, true)
  app.click(other.header)
  await app.flush()
  assert.equal(other.open, false)
  app.click(turn.button)
  await app.flush()
  assert.equal(turn.open, false)
  await app.bulk()
  await app.bulk()
  assert.equal(turn.open, true)
  assert.equal(grouped.open, true)
  assert.equal(other.open, true)
})

test('switching off collapses Think rows and refolds only what the plugin opened', async () => {
  const app = setup()
  const turn = app.turn(4)
  const grouped = turn.group()
  const mine = app.group()
  mine.set(true)
  const row = app.think(mine.content)
  await app.flush()
  assert.equal(turn.open, true)
  assert.equal(row.open, true)
  await app.bulk()
  assert.equal(row.open, false)
  assert.equal(grouped.rows[0].open, false)
  assert.equal(grouped.open, false)
  assert.equal(turn.open, false)
  assert.equal(mine.open, true)
  assert.deepEqual(app.focused, [])
})

test('does nothing to folds while switched off', async () => {
  const app = setup('0')
  const turn = app.turn(6)
  turn.group()
  const loose = app.group()
  app.think(loose.content)
  await app.flush()
  assert.equal(turn.open, false)
  assert.equal(loose.open, false)
})
