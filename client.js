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
    /** Folded turn and step process groups use `hidden="until-found"`. */
    const HIDDEN = '[hidden]'
    const STORAGE_KEY = 'dsh-think-expand.expandAll'
    const listeners = new Set()
    let userCollapsed = new WeakSet()
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

    function rememberUserToggle(event) {
      if (suppressingClick) return
      const target = event.target
      if (!(target instanceof Element)) return
      const row = target.closest(THINK_ROW)
      if (row === null) return
      const toggle = toggleOf(row)
      if (toggle === null) return
      if (!toggle.contains(target)) return
      if (toggle.getAttribute('aria-expanded') === 'true') {
        userCollapsed.add(row)
        return
      }
      userCollapsed.delete(row)
    }

    function setEnabled(next) {
      // An explicit bulk action supersedes individual choices from before it.
      userCollapsed = new WeakSet()
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

    function clickThinkRows(shouldOpen) {
      const rows = document.querySelectorAll(THINK_ROW)
      suppressingClick = true
      try {
        for (const row of rows) {
          if (shouldOpen && userCollapsed.has(row)) continue
          // A hidden row opens once its process group is revealed. The host
          // also resets it to collapsed when its turn folds, so opening it
          // while hidden would only render the reasoning off screen.
          if (shouldOpen && row.closest(HIDDEN) !== null) continue
          const toggle = toggleOf(row)
          if (toggle === null) continue
          const open = toggle.getAttribute('aria-expanded') === 'true'
          if (open === shouldOpen) continue
          toggle.click()
        }
      } finally {
        suppressingClick = false
      }
    }

    /**
     * Open visible Think rows that the user has not collapsed by hand.
     * A session remount creates new nodes, so those expand again.
     */
    function syncThinkRows() {
      if (!enabled) return
      clickThinkRows(true)
    }

    /** Close every Think row, hidden ones included. Used when the header switch turns off. */
    function collapseThinkRows() {
      clickThinkRows(false)
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
