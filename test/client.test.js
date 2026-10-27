import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import jsdomUtils from 'jsdom/lib/jsdom/living/generated/utils.js'

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

// React renders the header switch for real, so it needs a DOM before it loads.
const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true })
const { window } = dom
const { document } = window
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'MutationObserver']) {
  Object.defineProperty(globalThis, name, { value: name === 'window' ? window : window[name], configurable: true, writable: true })
}
globalThis.IS_REACT_ACT_ENVIRONMENT = false
const React = await import('react')
const { createRoot } = await import('react-dom/client')
const { flushSync } = await import('react-dom')
const jsxRuntime = await import('react/jsx-runtime')

const frames = []
window.requestAnimationFrame = (callback) => frames.push(callback)
window.cancelAnimationFrame = () => {}

/**
 * Load a fresh copy of the shipped module and model the DSH 0.1.7 to 0.2.x
 * conversation markup around it: a pane holds the session header (where the
 * real switch renders) and that session's chat body with Think rows, step
 * groups, and whole-turn folds.
 */
function setup() {
  document.body.replaceChildren()
  frames.length = 0
  let plugin, Header
  window.__ModuleLoader__ = { load({ factory }) {
    plugin = factory(name => name === 'react' ? React : jsxRuntime)
  } }
  window.eval(source)
  plugin.apply({
    slots: {
      inject(name, callback) { callback() },
      register(options, component) { Header = component },
    },
  })
  let nextId = 0
  const focused = []
  const roots = []
  const aborts = []

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
  const think = (parent) => {
    const root = el('div', { 'data-variant': 'think' }, parent)
    const toggle = el('div', { 'data-disclosure-row': '', role: 'button', tabindex: '0', 'aria-expanded': 'false' }, root)
    const icon = el('span', {}, toggle)
    let body = null
    const set = (open) => {
      toggle.setAttribute('aria-expanded', String(open))
      if (open && body === null) body = el('div', { class: 'thinkBody' }, root)
      if (!open && body !== null) { body.remove(); body = null }
    }
    const flip = () => set(toggle.getAttribute('aria-expanded') !== 'true')
    toggle.addEventListener('click', flip)
    // DisclosureRow's own key handler on the role="button" row.
    toggle.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      flip()
    })
    return {
      root, toggle, icon, reset: () => set(false),
      get open() { return toggle.getAttribute('aria-expanded') === 'true' },
      get body() { return body },
    }
  }

  /** ChatGroupSeat: header button controlling a searchable-hidden body. */
  const group = (parent) => {
    const root = el('div', { 'data-step-process': '' }, parent)
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
  const turn = (parent, number, open = false) => {
    const button = el('button', { type: 'button', 'data-turn-process': String(number), 'aria-expanded': String(open) }, parent)
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
      const wrapper = el('div', { 'data-chat-turn': String(number), 'data-turn-process-member': '' }, parent)
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

  /** The pieces of one chat body, bound to it. */
  const bodyKit = content => ({
    content,
    think: (parent = content) => think(parent),
    group: () => group(content),
    turn: (number, open) => turn(content, number, open),
  })

  /** ConversationMainPanel: a header with the real switch beside one session's chat body. */
  const pane = (sessionId) => {
    const root = el('div', { 'data-phase': 'active' })
    const actions = el('div', {}, el('header', {}, root))
    const content = el('div', { 'data-conversation-content': '', 'data-conversation-session': sessionId }, root)
    const reactRoot = createRoot(actions)
    roots.push(reactRoot)
    const render = id => flushSync(() => reactRoot.render(React.createElement(Header, { sessionId: id })))
    render(sessionId)
    const button = () => actions.querySelector('button')
    return {
      ...bodyKit(content),
      root, button,
      get on() { return button().getAttribute('aria-pressed') === 'true' },
      /** Press the switch and let the passes run. */
      async press() { button().click(); await flush() },
      /** Show another session in this pane, the way selecting one in the sidebar does. */
      async show(id) {
        content.replaceChildren()
        content.setAttribute('data-conversation-session', id)
        render(id)
        await flush()
      },
      /** Show another session whose chat body mounts only after `ms`. */
      async showLate(id, ms) {
        content.remove()
        content.replaceChildren()
        content.setAttribute('data-conversation-session', id)
        render(id)
        await flush()
        await sleep(ms)
        root.append(content)
      },
    }
  }

  /** The right Sidebar's embedded subagent chat: a chat body with no header and no switch. */
  const sidebar = sessionId => bodyKit(el('div', { 'data-conversation-content': '', 'data-conversation-session': sessionId }))

  const flush = async () => {
    for (let i = 0; ; i++) {
      assert.ok(i < 30, 'observer must settle')
      await new Promise(resolve => setTimeout(resolve, 0))
      if (frames.length === 0) return
      for (const callback of frames.splice(0)) callback()
    }
  }
  /** Keep passing frames and retry timers until `ms` has elapsed. */
  const settle = async (ms) => {
    const end = Date.now() + ms
    while (Date.now() < end) {
      await flush()
      await sleep(20)
    }
    await flush()
  }
  /** Real input is trusted; jsdom only dispatches trusted events through its internals. */
  const trusted = (node, event) => {
    const impl = jsdomUtils.implForWrapper(event)
    impl.isTrusted = true
    jsdomUtils.implForWrapper(node)._dispatch(impl)
  }
  const click = (node) => trusted(node, new window.MouseEvent('click', { bubbles: true, cancelable: true }))
  const key = (node) => trusted(node, new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))

  /**
   * A skin in the style of dsh-claude-style's fold glide: it holds a closing
   * click for a 200 ms animation, swallows every other chat click meanwhile,
   * then replays the held click. Opening clicks and turn headers pass through.
   */
  const skin = () => {
    let shutting = false
    let replaying = false
    const stats = { held: 0, swallowed: 0 }
    const abort = new window.AbortController()
    aborts.push(abort)
    document.addEventListener('click', (event) => {
      if (replaying) return
      const control = event.target.closest('[data-disclosure-row], [aria-expanded]')
      if (control === null) return
      if (shutting) {
        event.stopPropagation()
        event.preventDefault()
        stats.swallowed++
        return
      }
      if (control.closest('[data-turn-process]') !== null) return
      if (control.getAttribute('aria-expanded') !== 'true') return
      event.stopPropagation()
      event.preventDefault()
      stats.held++
      shutting = true
      setTimeout(() => {
        shutting = false
        replaying = true
        try { control.click() } finally { replaying = false }
      }, 200)
    }, { capture: true, signal: abort.signal })
    return stats
  }

  /** Swallow every click on one control, as a stuck skin would, and count them. */
  const jam = (control) => {
    const stats = { presses: 0 }
    const abort = new window.AbortController()
    aborts.push(abort)
    document.addEventListener('click', (event) => {
      if (event.target !== control) return
      stats.presses++
      event.stopPropagation()
    }, { capture: true, signal: abort.signal })
    return stats
  }

  const cleanup = () => {
    for (const root of roots) flushSync(() => root.unmount())
    for (const abort of aborts) abort.abort()
  }

  return { pane, sidebar, flush, settle, click, key, skin, jam, focused, cleanup }
}

/** Run one scenario on a fresh module and DOM, and tear the panes down afterwards. */
function scenario(name, body) {
  test(name, async () => {
    const app = setup()
    try {
      await body(app)
    } finally {
      app.cleanup()
    }
  })
}

scenario('the switch starts off and leaves every row to the reader', async (app) => {
  const chat = app.pane('s1')
  const row = chat.think()
  const grouped = chat.group()
  chat.think(grouped.content)
  await app.flush()
  assert.equal(chat.on, false)
  assert.equal(row.open, false)
  assert.equal(grouped.open, false)
  app.click(row.toggle)
  await app.flush()
  assert.equal(row.open, true)
  app.click(row.toggle)
  await app.flush()
  assert.equal(row.open, false)
})

scenario('the switch reopens manually collapsed rows across repeated cycles', async (app) => {
  const chat = app.pane('s1')
  const first = chat.think()
  const second = chat.think()
  await chat.press()
  assert.equal(chat.on, true)
  assert.deepEqual([first.open, second.open], [true, true])
  for (let i = 0; i < 3; i++) {
    app.click(first.toggle)
    await app.flush()
    assert.equal(first.open, false)
    assert.equal(second.open, true)
    await chat.press()
    assert.deepEqual([first.open, second.open], [false, false])
    await chat.press()
    assert.deepEqual([first.open, second.open], [true, true])
  }
})

scenario('switching off closes rows the reader opened by hand', async (app) => {
  const chat = app.pane('s1')
  const row = chat.think()
  app.click(row.toggle)
  await app.flush()
  assert.equal(row.open, true)
  await chat.press()
  await chat.press()
  assert.equal(chat.on, false)
  assert.equal(row.open, false)
})

scenario('body clicks and body keyboard events do not record a manual collapse', async (app) => {
  for (const send of ['click', 'key']) {
    const chat = app.pane(`s-${send}`)
    const row = chat.think()
    await chat.press()
    app[send](row.body)
    // Simulate the host resetting this row in place.
    row.reset()
    await app.flush()
    assert.equal(row.open, true)
  }
})

scenario('nested toggle targets and keyboard activation retain manual intent until the switch is pressed', async (app) => {
  for (const send of ['click', 'key']) {
    const chat = app.pane(`s-${send}`)
    const row = chat.think()
    await chat.press()
    app[send](row.icon)
    row.reset()
    const newRow = chat.think()
    await app.flush()
    assert.equal(row.open, false)
    assert.equal(newRow.open, true)
    await chat.press()
    await chat.press()
    assert.equal(row.open, true)
  }
})

scenario('the old global switch in localStorage is dropped and opens nothing', async () => {
  window.localStorage.setItem('dsh-think-expand.expandAll', '1')
  const app = setup()
  try {
    const chat = app.pane('s1')
    const row = chat.think()
    await app.flush()
    assert.equal(window.localStorage.getItem('dsh-think-expand.expandAll'), null)
    assert.equal(chat.on, false)
    assert.equal(row.open, false)
  } finally {
    app.cleanup()
  }
})

scenario('each session keeps its own switch, in memory for this window only', async (app) => {
  const chat = app.pane('s1')
  const row = chat.think()
  await chat.press()
  assert.equal(row.open, true)
  // Another session, a subagent opened in this pane included, starts off.
  await chat.show('child-1')
  const childRow = chat.think()
  await app.flush()
  assert.equal(chat.on, false)
  assert.equal(childRow.open, false)
  // Coming back finds the session as it was left.
  await chat.show('s1')
  const again = chat.think()
  await app.flush()
  assert.equal(chat.on, true)
  assert.equal(again.open, true)
  // A new window loads a fresh module: every session starts off there.
  const fresh = setup()
  try {
    const elsewhere = fresh.pane('s1')
    const elsewhereRow = elsewhere.think()
    await fresh.flush()
    assert.equal(elsewhere.on, false)
    assert.equal(elsewhereRow.open, false)
  } finally {
    fresh.cleanup()
  }
})

scenario('a pane never touches another pane or the Sidebar subagent chat', async (app) => {
  const main = app.pane('s1')
  const other = app.pane('s2')
  const side = app.sidebar('child-1')
  const mainRow = main.think()
  const otherRow = other.think()
  const sideRow = side.think()
  const sideGroup = side.group()
  side.think(sideGroup.content)
  await main.press()
  assert.equal(mainRow.open, true)
  assert.equal(otherRow.open, false)
  assert.equal(sideRow.open, false)
  assert.equal(sideGroup.open, false)
  assert.equal(other.on, false)
  // A row arriving in the Sidebar later is not opened either.
  const late = side.think()
  await app.flush()
  assert.equal(late.open, false)
  // The other pane's own switch drives only that pane.
  app.click(otherRow.toggle)
  await other.press()
  await other.press()
  assert.equal(otherRow.open, false)
  assert.equal(mainRow.open, true)
})

scenario('nothing is observed while the switch is off', async (app) => {
  const chat = app.pane('s1')
  for (let i = 0; i < 5; i++) chat.think()
  await app.flush()
  chat.think()
  chat.content.append(document.createElement('p'))
  await sleep(0)
  assert.equal(frames.length, 0)
  await chat.press()
  await chat.press()
  chat.think()
  await sleep(0)
  assert.equal(frames.length, 0)
})

scenario('streaming text does not queue passes, a new Think row does', async (app) => {
  const chat = app.pane('s1')
  const row = chat.think()
  await chat.press()
  assert.equal(row.open, true)
  for (let i = 0; i < 20; i++) row.body.append(document.createElement('p'))
  chat.content.append(document.createElement('p'))
  await sleep(0)
  assert.equal(frames.length, 0)
  const next = chat.think()
  await app.flush()
  assert.equal(next.open, true)
})

scenario('opens step groups holding Think rows and leaves other groups closed', async (app) => {
  const chat = app.pane('s1')
  const withThink = chat.group()
  const row = chat.think(withThink.content)
  const toolsOnly = chat.group()
  await chat.press()
  assert.equal(withThink.open, true)
  assert.equal(row.open, true)
  assert.equal(toolsOnly.open, false)
})

scenario('opens a folded turn, then the groups inside it, then their Think rows', async (app) => {
  const chat = app.pane('s1')
  const turn = chat.turn(3)
  const grouped = turn.group(2)
  const direct = turn.think()
  await chat.press()
  assert.equal(turn.open, true)
  assert.equal(grouped.open, true)
  assert.deepEqual(grouped.rows.map(row => row.open), [true, true])
  assert.equal(direct.open, true)
})

scenario('reopens a turn the host folds when it finishes', async (app) => {
  const chat = app.pane('s1')
  const turn = chat.turn(1, true)
  const grouped = turn.group()
  await chat.press()
  assert.equal(grouped.rows[0].open, true)
  turn.set(false)
  await app.flush()
  assert.equal(turn.open, true)
  assert.equal(grouped.open, true)
  assert.equal(grouped.rows[0].open, true)
})

scenario('opening groups and turns never moves focus', async (app) => {
  const chat = app.pane('s1')
  const turn = chat.turn(2)
  turn.group()
  await chat.press()
  assert.equal(turn.open, true)
  assert.deepEqual(app.focused, [])
})

scenario('groups and turns the user closes stay closed until the switch is pressed again', async (app) => {
  const chat = app.pane('s1')
  const turn = chat.turn(5)
  const grouped = turn.group()
  const other = chat.group()
  chat.think(other.content)
  await chat.press()
  assert.equal(grouped.open, true)
  app.click(other.header)
  await app.flush()
  assert.equal(other.open, false)
  app.click(turn.button)
  await app.flush()
  assert.equal(turn.open, false)
  await chat.press()
  await chat.press()
  assert.equal(turn.open, true)
  assert.equal(grouped.open, true)
  assert.equal(other.open, true)
})

scenario('switching off collapses Think rows and refolds only what the plugin opened', async (app) => {
  const chat = app.pane('s1')
  const turn = chat.turn(4)
  const grouped = turn.group()
  const mine = chat.group()
  mine.set(true)
  const row = chat.think(mine.content)
  await chat.press()
  assert.equal(turn.open, true)
  assert.equal(row.open, true)
  await chat.press()
  assert.equal(row.open, false)
  assert.equal(grouped.rows[0].open, false)
  assert.equal(grouped.open, false)
  assert.equal(turn.open, false)
  assert.equal(mine.open, true)
  assert.deepEqual(app.focused, [])
})

scenario('clicks from other plugins are not the reader\'s choice', async (app) => {
  const chat = app.pane('s1')
  const row = chat.think()
  const grouped = chat.group()
  const inner = chat.think(grouped.content)
  await chat.press()
  assert.equal(row.open, true)
  assert.equal(inner.open, true)
  // A skin folding a finished Think row, and a skin folding a finished group.
  row.toggle.click()
  grouped.header.click()
  await app.settle(50)
  assert.equal(row.open, true)
  assert.equal(grouped.open, true)
  assert.equal(inner.open, true)
})

scenario('Think rows toggle through their keyboard path, untouched by click interceptors', async (app) => {
  const chat = app.pane('s1')
  const stats = app.skin()
  const rows = [chat.think(), chat.think(), chat.think()]
  await chat.press()
  assert.deepEqual(rows.map(row => row.open), [true, true, true])
  await chat.press()
  assert.deepEqual(rows.map(row => row.open), [false, false, false])
  assert.equal(stats.held + stats.swallowed, 0)
})

scenario('switching off under a click-holding skin still closes every row, group and turn', async (app) => {
  const chat = app.pane('s1')
  const turn = chat.turn(7)
  const folded = turn.group(2)
  const loose = [chat.group(), chat.group(), chat.group()]
  for (const grouped of loose) chat.think(grouped.content)
  await chat.press()
  const stats = app.skin()
  assert.equal(turn.open, true)
  assert.ok(loose.every(grouped => grouped.open))
  await chat.press()
  await app.settle(1800)
  assert.equal(turn.open, false)
  assert.equal(folded.open, false)
  assert.deepEqual(folded.rows.map(row => row.open), [false, false])
  assert.deepEqual(loose.map(grouped => grouped.open), [false, false, false])
  assert.ok(stats.held > 0, 'the skin held at least one group click')
  await chat.press()
  await app.settle(600)
  assert.equal(turn.open, true)
  assert.ok(loose.every(grouped => grouped.open))
  assert.deepEqual(folded.rows.map(row => row.open), [true, true])
})

scenario('a control that never responds is pressed a bounded number of times', async (app) => {
  const chat = app.pane('s1')
  const grouped = chat.group()
  chat.think(grouped.content)
  const stats = app.jam(grouped.header)
  await chat.press()
  await app.settle(2200)
  assert.equal(grouped.open, false)
  assert.ok(stats.presses >= 2 && stats.presses <= 5, `pressed ${stats.presses} times`)
})

scenario('a session whose chat body mounts after its header still opens', async (app) => {
  const chat = app.pane('s1')
  chat.think()
  await chat.press()
  await chat.show('s2')
  await chat.showLate('s1', 300)
  const row = chat.think()
  await app.settle(400)
  assert.equal(chat.on, true)
  assert.equal(row.open, true)
})
