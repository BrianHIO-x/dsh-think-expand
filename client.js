window.__ModuleLoader__.load({
  id: 'dsh-think-expand',
  factory: () => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    /** Official Think row root. Other disclosures use different variants. */
    const THINK_ROW = '[data-variant="think"]'

    /**
     * Open every Think row while any of them is the streaming tail.
     * Leave them open after thinking ends; do not click them shut.
     */
    function syncThinkRows() {
      const rows = document.querySelectorAll(THINK_ROW)
      if (rows.length === 0) return
      const thinking = Array.prototype.some.call(
        rows,
        (row) => row.getAttribute('data-state') === 'running',
      )
      if (!thinking) return
      for (const row of rows) {
        const toggle = row.querySelector('[aria-expanded]')
        if (toggle === null) continue
        if (toggle.getAttribute('aria-expanded') === 'true') continue
        toggle.click()
      }
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
