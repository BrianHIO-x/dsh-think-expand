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
    const STORAGE_KEY = 'dsh-think-expand.expandAll'
    const listeners = new Set()
    const userCollapsed = new WeakSet()
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

    function rememberUserToggle(event) {
      if (suppressingClick) return
      const target = event.target
      if (!(target instanceof Element)) return
      const row = target.closest(THINK_ROW)
      if (row === null) return
      const toggle = row.querySelector('[aria-expanded]')
      if (toggle === null) return
      if (toggle.getAttribute('aria-expanded') === 'true') {
        userCollapsed.add(row)
        return
      }
      userCollapsed.delete(row)
    }

    function setEnabled(next) {
      enabled = next
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {
        // Private mode can refuse localStorage; the in-memory flag still works.
      }
      for (const listener of listeners) listener()
      if (next) syncThinkRows()
    }

    /**
     * Open Think rows that the user has not collapsed by hand.
     * A session remount creates new nodes, so those expand again.
     */
    function syncThinkRows() {
      if (!enabled) return
      const rows = document.querySelectorAll(THINK_ROW)
      suppressingClick = true
      try {
        for (const row of rows) {
          if (userCollapsed.has(row)) continue
          const toggle = row.querySelector('[aria-expanded]')
          if (toggle === null) continue
          if (toggle.getAttribute('aria-expanded') === 'true') continue
          toggle.click()
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
        title: enabled ? '自动展开全部 Think：开' : '自动展开全部 Think：关',
        onClick: () => {
          setEnabled(!enabled)
        },
        style: {
          cursor: 'pointer',
          border: 'none',
          background: enabled ? 'var(--dsw-alias-interactive-bg-hover)' : 'transparent',
          color: 'var(--dsw-alias-label-secondary)',
          borderRadius: '8px',
          height: '28px',
          padding: '0 8px',
          fontSize: '13px',
          lineHeight: '28px',
        },
        children: 'Think',
      })
    }

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
        })
        const onUserToggle = (event) => {
          if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return
          rememberUserToggle(event)
        }
        document.addEventListener('click', onUserToggle, true)
        document.addEventListener('keydown', onUserToggle, true)
        schedule()

        const slots = ctx.get('slots')
        if (slots !== undefined && React !== undefined && jsx !== undefined) {
          slots.inject('conversation.session.header.actions', () => slots.register(
            {
              name: 'conversation.session.header.actions',
              id: 'think-expand',
              order: 40,
            },
            ExpandToggle,
          ))
        }

        return () => {
          observer.disconnect()
          document.removeEventListener('click', onUserToggle, true)
          document.removeEventListener('keydown', onUserToggle, true)
          if (frame !== 0) cancelAnimationFrame(frame)
        }
      })
    }

    exports.apply = apply
    return module.exports
  },
})
