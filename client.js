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
     * Open every Think row currently in the page.
     * Used while the switch is on, including after a session remount.
     */
    function syncThinkRows() {
      if (!enabled) return
      const rows = document.querySelectorAll(THINK_ROW)
      for (const row of rows) {
        const toggle = row.querySelector('[aria-expanded]')
        if (toggle === null) continue
        if (toggle.getAttribute('aria-expanded') === 'true') continue
        toggle.click()
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
          attributes: true,
          attributeFilter: ['data-state', 'aria-expanded'],
        })
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
          if (frame !== 0) cancelAnimationFrame(frame)
        }
      })
    }

    exports.apply = apply
    return module.exports
  },
})
