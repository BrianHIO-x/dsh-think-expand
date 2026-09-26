window.__ModuleLoader__.load({
  id: 'dsh-think-expand',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    let React
    let jsx
    try {
      React = require('react')
      jsx = require('react/jsx-runtime').jsx
    } catch {
      React = undefined
      jsx = undefined
    }

    /** Official Think row root. Other disclosures use different variants. */
    const THINK_ROW = '[data-variant="think"]'
    /** DSH 0.1.7 marks the Think header itself; older builds only set aria-expanded. */
    const THINK_TOGGLE = '[data-disclosure-row][aria-expanded]'
    /** Folded turn processes and step groups use `hidden="until-found"`. */
    const HIDDEN = '[hidden]'
    /** Step group root, its collapsible body, and the header button that controls it. */
    const STEP_GROUP = '[data-step-process]'
    const STEP_BODY = '[data-step-process-body]'
    const STEP_HEADER = 'button[aria-controls]'
    /** Whole-turn fold control; `data-turn-process` holds the turn number. */
    const TURN_PROCESS = 'button[data-turn-process]'
    const TURN_OWNER = '[data-chat-turn]'
    const STORAGE_KEY = 'dsh-think-expand.expandAll'
    const listeners = new Set()
    let userCollapsed = new WeakSet()
    /** Group and turn controls the user closed by hand since the last bulk action. */
    let userClosed = new WeakSet()
    /** Group and turn controls this plugin opened, closed again by the off switch. */
    let autoOpened = new Set()
    let suppressingClick = false

    function readEnabled() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw === null) return true
        return raw === '1'
      } catch {
        return true
      }
    }

    let enabled = readEnabled()

    function toggleOf(row) {
      return row.querySelector(THINK_TOGGLE) ?? row.querySelector('[aria-expanded]')
    }

    function isOpen(control) {
      return control.getAttribute('aria-expanded') === 'true'
    }

    function rememberUserToggle(event) {
      if (suppressingClick) return
      const target = event.target
      if (!(target instanceof Element)) return
      const row = target.closest(THINK_ROW)
      if (row === null) return
      const toggle = toggleOf(row)
      if (toggle === null) return
      if (!toggle.contains(target)) return
      if (isOpen(toggle)) {
        userCollapsed.add(row)
        return
      }
      userCollapsed.delete(row)
    }

    /** Native buttons turn Enter and Space into clicks, so clicks cover the keyboard too. */
    function rememberUserFold(event) {
      if (suppressingClick) return
      const target = event.target
      if (!(target instanceof Element)) return
      const turn = target.closest(TURN_PROCESS)
      const header = turn ?? stepHeaderAt(target)
      if (header === null) return
      if (isOpen(header)) {
        userClosed.add(header)
        return
      }
      userClosed.delete(header)
    }

    function stepHeaderAt(target) {
      const header = target.closest(STEP_HEADER)
      if (header === null) return null
      const group = header.closest(STEP_GROUP)
      if (group === null) return null
      return stepHeaderOf(group) === header ? header : null
    }

    function stepHeaderOf(group) {
      const body = group.querySelector(STEP_BODY)
      if (body === null) return null
      for (const header of group.querySelectorAll(STEP_HEADER)) {
        if (header.getAttribute('aria-controls') === body.id) return header
      }
      return null
    }

    function outermostHidden(row) {
      let outer = null
      for (let node = row.closest(HIDDEN); node !== null; node = node.parentElement?.closest(HIDDEN) ?? null) {
        outer = node
      }
      return outer
    }

    /**
     * The control that reveals one hidden subtree: the step group header for a
     * folded group body, otherwise the fold button of the owning turn.
     */
    function revealerOf(hidden) {
      if (hidden.matches(STEP_BODY)) {
        const group = hidden.closest(STEP_GROUP)
        return group === null ? null : stepHeaderOf(group)
      }
      const owner = hidden.closest(TURN_OWNER)
      if (owner === null) return null
      const turn = owner.getAttribute('data-chat-turn')
      for (const button of document.querySelectorAll(TURN_PROCESS)) {
        if (button.getAttribute('data-turn-process') === turn && !button.disabled && !isOpen(button)) return button
      }
      return null
    }

    /**
     * Click a host control without letting it move focus. Group and turn
     * headers focus themselves on click, which would scroll the conversation.
     */
    function quietClick(control) {
      control.focus = () => {}
      try {
        control.click()
      } finally {
        delete control.focus
      }
    }

    function setEnabled(next) {
      // An explicit bulk action supersedes individual choices from before it.
      userCollapsed = new WeakSet()
      userClosed = new WeakSet()
      enabled = next
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {
        // Private mode can refuse localStorage; the in-memory flag still works.
      }
      for (const listener of listeners) listener()
      if (next) {
        syncThinkRows()
        return
      }
      collapseThinkRows()
    }

    /**
     * Open visible Think rows that the user has not collapsed by hand, and
     * reveal the folded group or turn around each hidden one. Revealing
     * re-renders the host, and the next pass opens the rows it uncovered.
     * A session remount creates new nodes, so those expand again.
     */
    function syncThinkRows() {
      if (!enabled) return
      const revealers = new Set()
      suppressingClick = true
      try {
        for (const row of document.querySelectorAll(THINK_ROW)) {
          if (userCollapsed.has(row)) continue
          const hidden = outermostHidden(row)
          if (hidden !== null) {
            const revealer = revealerOf(hidden)
            if (revealer !== null) revealers.add(revealer)
            continue
          }
          const toggle = toggleOf(row)
          if (toggle === null || isOpen(toggle)) continue
          toggle.click()
        }
        for (const revealer of revealers) {
          if (userClosed.has(revealer) || isOpen(revealer)) continue
          autoOpened.add(revealer)
          quietClick(revealer)
        }
      } finally {
        suppressingClick = false
      }
    }

    /**
     * Close every Think row, hidden ones included, then fold the groups and
     * turns this plugin opened. Used when the header switch turns off.
     */
    function collapseThinkRows() {
      const opened = autoOpened
      autoOpened = new Set()
      suppressingClick = true
      try {
        for (const row of document.querySelectorAll(THINK_ROW)) {
          const toggle = toggleOf(row)
          if (toggle !== null && isOpen(toggle)) toggle.click()
        }
        // Inner groups first, so a turn folds over groups that are already closed.
        for (const control of [...opened].reverse()) {
          if (control.isConnected && !control.disabled && isOpen(control)) quietClick(control)
        }
      } finally {
        suppressingClick = false
      }
    }

    function ExpandToggle() {
      const [, bump] = React.useState(0)
      React.useEffect(() => {
        const onChange = () => bump((value) => value + 1)
        listeners.add(onChange)
        return () => {
          listeners.delete(onChange)
        }
      }, [])
      return jsx('button', {
        type: 'button',
        'aria-pressed': enabled,
        title: enabled ? '收起全部 Think' : '展开全部 Think',
        onClick: () => {
          setEnabled(!enabled)
        },
        style: {
          cursor: 'pointer',
          border: 'none',
          background: enabled ? '#2b6cff' : 'rgba(43, 108, 255, 0.18)',
          color: enabled ? '#fff' : '#2b6cff',
          borderRadius: '8px',
          height: '28px',
          padding: '0 10px',
          fontSize: '13px',
          lineHeight: '28px',
          fontWeight: 600,
        },
        children: 'Think',
      })
    }

    const inject = ['slots']

    function apply(ctx) {
      ctx.effect(() => {
        let frame = 0
        const schedule = () => {
          if (frame !== 0) return
          frame = requestAnimationFrame(() => {
            frame = 0
            syncThinkRows()
          })
        }
        const observer = new MutationObserver(schedule)
        observer.observe(document.documentElement, {
          subtree: true,
          childList: true,
          // Expanding a folded turn or step group only removes `hidden`.
          attributes: true,
          attributeFilter: ['hidden'],
        })
        const onUserToggle = (event) => {
          if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return
          rememberUserToggle(event)
          if (event.type === 'click') rememberUserFold(event)
        }
        document.addEventListener('click', onUserToggle, true)
        document.addEventListener('keydown', onUserToggle, true)
        schedule()
        return () => {
          observer.disconnect()
          document.removeEventListener('click', onUserToggle, true)
          document.removeEventListener('keydown', onUserToggle, true)
          if (frame !== 0) cancelAnimationFrame(frame)
        }
      })

      if (React !== undefined && jsx !== undefined) {
        ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register(
          {
            name: 'conversation.session.header.actions',
            id: 'think-expand',
            order: 40,
          },
          ExpandToggle,
        ))
      }
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
