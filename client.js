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
    /** One session's chat body, tagged with `data-conversation-session`. */
    const CONTENT = '[data-conversation-content]'
    /** v0.1 kept one switch for every session and window here. */
    const LEGACY_STORAGE_KEY = 'dsh-think-expand.expandAll'
    /**
     * Fold animations hold clicks for about 200 ms: skins such as
     * dsh-claude-style swallow every chat click while a fold rolls shut. A
     * toggle that did not take is pressed again after this long.
     */
    const RETRY_MS = 260
    /** Presses per row or control before giving up, reset once it reaches the wanted state. */
    const MAX_ATTEMPTS = 5
    /** A chat body can mount after its header; look for it this often, this many times. */
    const FIND_MS = 200
    const FIND_TRIES = 25
    /**
     * The reader's place is held after this pane opens or closes something,
     * until it has not moved for HOLD_QUIET_MS: long reasoning keeps growing
     * for seconds while its Markdown and code blocks render. Never longer than
     * HOLD_MAX_MS, and real input from the reader ends it at once.
     */
    const HOLD_QUIET_MS = 600
    const HOLD_MAX_MS = 15000
    /** Each chat node and group carries one; their tops locate what the reader is looking at. */
    const ANCHOR = '[data-chat-anchor-key]'
    /** Marks the chat body of a pane whose switch is on. */
    const PANE_ATTRIBUTE = 'data-dsh-think-expand'
    const STYLE_ID = 'dsh-think-expand-style'
    /**
     * An open step group caps its body at min(400px, 50vh) with a scrollbar of
     * its own. With every group open, the transcript turns into a stack of
     * such boxes: the wheel scrolls inside whichever one is under the pointer
     * and the page barely moves, so history loaded above by "Load earlier"
     * seems never to arrive. While the switch is on, groups grow with their
     * rows and the page scrolls as one.
     */
    const PANE_STYLE = `[${PANE_ATTRIBUTE}] [data-step-process] > [data-step-process-body] {
  max-height: none;
  overflow-y: visible;
  scrollbar-gutter: auto;
}`

    /**
     * Sessions whose switch is on in this window. Kept in memory only, so
     * another window, a reload, another session, or a subagent opened from
     * here starts with the switch off and leaves Think rows to the reader.
     */
    const enabledSessions = new Set()

    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY)
    } catch {
      // Private mode can refuse localStorage; nothing reads the key any more.
    }

    function ensureStyle() {
      if (document.getElementById(STYLE_ID) !== null) return
      const style = document.createElement('style')
      style.id = STYLE_ID
      style.textContent = PANE_STYLE
      document.head.append(style)
    }

    function toggleOf(row) {
      return row.querySelector(THINK_TOGGLE) ?? row.querySelector('[aria-expanded]')
    }

    function isOpen(control) {
      return control.getAttribute('aria-expanded') === 'true'
    }

    function stepHeaderOf(group) {
      const body = group.querySelector(STEP_BODY)
      if (body === null) return null
      for (const header of group.querySelectorAll(STEP_HEADER)) {
        if (header.getAttribute('aria-controls') === body.id) return header
      }
      return null
    }

    function stepHeaderAt(target) {
      const header = target.closest(STEP_HEADER)
      if (header === null) return null
      const group = header.closest(STEP_GROUP)
      if (group === null) return null
      return stepHeaderOf(group) === header ? header : null
    }

    function outermostHidden(row, content) {
      let outer = null
      for (let node = row.closest(HIDDEN); node !== null && content.contains(node); node = node.parentElement?.closest(HIDDEN) ?? null) {
        outer = node
      }
      return outer
    }

    /**
     * Toggle a Think row. Its header is a `role="button"` row whose own key
     * handler toggles on Enter, so the keyboard path is used: skins that
     * animate folds intercept clicks, and Enter reaches the host untouched.
     */
    function pressRow(toggle) {
      if (toggle.getAttribute('role') === 'button' && toggle.tagName !== 'BUTTON') {
        toggle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
        return
      }
      toggle.click()
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

    /**
     * Whether a batch of mutations can change what the switch has to do: a
     * fold or reveal (`hidden`, `aria-expanded`), or a Think row arriving.
     * Streaming text inside an answer or an open Think body is neither, so it
     * no longer costs a pass every frame.
     */
    function relevant(records) {
      for (const record of records) {
        if (record.type === 'attributes') return true
        for (const node of record.addedNodes) {
          if (node.nodeType !== 1) continue
          if (node.matches(THINK_ROW) || node.querySelector(THINK_ROW) !== null) return true
        }
      }
      return false
    }

    /**
     * Drive the Think rows of one session pane: the chat body that shares an
     * ancestor with this header button. Panes elsewhere, such as a subagent
     * chat in the right Sidebar, are never touched. Nothing is observed while
     * the switch is off, apart from finishing the collapse it asked for.
     * @param button - this pane's header switch.
     * @param sessionId - the session the header belongs to.
     * @param onChange - hears the switch state.
     */
    function createPane(button, sessionId, onChange) {
      let enabled = enabledSessions.has(sessionId)
      let root = null
      let observer = null
      let frame = 0
      let retryTimer = 0
      let userCollapsed = new WeakSet()
      /** Group and turn controls the user closed by hand since the last switch press. */
      let userClosed = new WeakSet()
      /** Group and turn controls this pane opened, closed again by the off switch. */
      let autoOpened = new Set()
      /** Rows and controls the off switch still has to close. */
      let pendingCollapse = new Set()
      let pendingClose = new Set()
      let attempts = new WeakMap()
      let acting = false
      let findTimer = 0
      let findTries = 0
      /** The chat body this pane marked for uncapped groups. */
      let marked = null
      /** The reader's place, held for a moment while this pane's own changes settle. */
      let hold = null
      let holdFrame = 0
      /** During a batch of changes: the chat body, and the place noted before the first change. */
      let changing = null
      let noted

      function contentIn(node) {
        for (const content of node.querySelectorAll(CONTENT)) {
          if (content.getAttribute('data-conversation-session') === sessionId) return content
        }
        return null
      }

      /** The nearest ancestor of the button that also holds this session's chat body. */
      function findRoot() {
        if (root !== null && root.isConnected && root.contains(button)) return root
        root = null
        for (let node = button.parentElement; node !== null; node = node.parentElement) {
          if (contentIn(node) !== null) {
            root = node
            break
          }
        }
        return root
      }

      function content() {
        const scope = findRoot()
        return scope === null ? null : contentIn(scope)
      }

      function mark(body) {
        if (marked === body && body.hasAttribute(PANE_ATTRIBUTE)) return
        unmark()
        noteChange()
        ensureStyle()
        body.setAttribute(PANE_ATTRIBUTE, '')
        marked = body
      }

      function unmark() {
        if (marked !== null) {
          noteChange()
          marked.removeAttribute(PANE_ATTRIBUTE)
        }
        marked = null
      }

      /** The conversation's own scrollport inside this chat body. */
      function scrollerOf(body) {
        for (let node = body.querySelector('[data-chat-flow]'); node !== null && body.contains(node); node = node.parentElement) {
          const overflow = getComputedStyle(node).overflowY
          if ((overflow === 'auto' || overflow === 'scroll') && node.scrollHeight > node.clientHeight) return node
        }
        return null
      }

      /**
       * The first chat node that starts inside the visible area, or the one
       * spanning its top edge, with its offset from that edge. None while the
       * reader follows the newest output: the host keeps that pinned itself.
       */
      function readerPlace(body) {
        if (body.querySelector('[data-chat-following-tail]') !== null) return null
        const scroller = scrollerOf(body)
        if (scroller === null) return null
        if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2) return null
        const top = scroller.getBoundingClientRect().top
        let spanning = null
        for (const element of body.querySelectorAll(ANCHOR)) {
          const rect = element.getBoundingClientRect()
          if (rect.height === 0) continue
          if (rect.top >= top) return { scroller, element, offset: rect.top - top }
          if (rect.bottom > top) spanning = { scroller, element, offset: rect.top - top }
        }
        return spanning
      }

      /** Record the reader's place before the first change of the current batch. */
      function noteChange() {
        if (changing === null || noted !== undefined) return
        noted = hold ?? readerPlace(changing)
      }

      /**
       * Run one batch of opening or closing in `body`, then keep the reader's
       * place while it settles. Content this pane opens above the reader, such
       * as a page of history that "Load earlier" just brought in, would
       * otherwise push what they were reading out of view.
       */
      function changes(body, run) {
        changing = body
        noted = undefined
        try {
          run()
        } finally {
          const place = noted
          changing = null
          noted = undefined
          if (place !== null && place !== undefined) holdPlace(place)
        }
      }

      function onReaderMove(event) {
        if (event.isTrusted) releasePlace()
      }

      function holdPlace(place) {
        if (hold === null) {
          for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
            document.addEventListener(type, onReaderMove, { capture: true, passive: true })
          }
        }
        const now = performance.now()
        if (hold !== place) {
          hold = place
          hold.started = now
        }
        hold.moved = now
        if (holdFrame === 0) holdFrame = requestAnimationFrame(keepPlace)
      }

      function keepPlace() {
        holdFrame = 0
        const place = hold
        if (place === null) return
        const { scroller, element, offset } = place
        if (!scroller.isConnected || !element.isConnected || element.closest(HIDDEN) !== null) {
          releasePlace()
          return
        }
        const drift = element.getBoundingClientRect().top - scroller.getBoundingClientRect().top - offset
        const now = performance.now()
        if (Math.abs(drift) >= 1) {
          scroller.scrollTo({ top: scroller.scrollTop + drift, behavior: 'instant' })
          place.moved = now
        }
        if (now - place.moved >= HOLD_QUIET_MS || now - place.started >= HOLD_MAX_MS) {
          releasePlace()
          return
        }
        holdFrame = requestAnimationFrame(keepPlace)
      }

      /** Hand the scroll position back to the reader and the host. */
      function releasePlace() {
        if (hold !== null) {
          for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
            document.removeEventListener(type, onReaderMove, { capture: true })
          }
        }
        hold = null
        if (holdFrame !== 0) cancelAnimationFrame(holdFrame)
        holdFrame = 0
      }

      function schedule() {
        if (frame !== 0) return
        frame = requestAnimationFrame(() => {
          frame = 0
          pass()
        })
      }

      /** Press once more unless this target has used up its attempts; re-check after the animation window. */
      function attempt(target, press) {
        const count = attempts.get(target) ?? 0
        if (count >= MAX_ATTEMPTS) return false
        attempts.set(target, count + 1)
        noteChange()
        press()
        if (retryTimer === 0) {
          retryTimer = setTimeout(() => {
            retryTimer = 0
            schedule()
          }, RETRY_MS)
        }
        return true
      }

      /**
       * Only real input inside this pane counts as the reader's choice. Other
       * plugins press the same controls with untrusted clicks: a skin folding
       * a finished Think row, or replaying a click it held for its animation.
       */
      function onUserInput(event) {
        if (acting || !event.isTrusted) return
        if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return
        const target = event.target
        if (!(target instanceof Element) || root === null || !root.contains(target)) return
        const row = target.closest(THINK_ROW)
        const toggle = row === null ? null : toggleOf(row)
        if (toggle !== null && toggle.contains(target)) {
          pendingCollapse.delete(row)
          if (isOpen(toggle)) userCollapsed.add(row)
          else userCollapsed.delete(row)
        }
        // Native buttons turn Enter and Space into clicks, so clicks cover the keyboard too.
        if (event.type !== 'click') return
        const header = target.closest(TURN_PROCESS) ?? stepHeaderAt(target)
        if (header === null) return
        pendingClose.delete(header)
        if (isOpen(header)) userClosed.add(header)
        else userClosed.delete(header)
      }

      function watch() {
        if (observer !== null) return
        const scope = findRoot()
        if (scope === null) {
          if (findTimer === 0 && findTries < FIND_TRIES) {
            findTries++
            findTimer = setTimeout(() => {
              findTimer = 0
              watch()
              if (observer !== null) schedule()
            }, FIND_MS)
          }
          return
        }
        findTries = 0
        observer = new MutationObserver((records) => {
          if (relevant(records)) schedule()
        })
        observer.observe(scope, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ['hidden', 'aria-expanded'],
        })
        document.addEventListener('click', onUserInput, true)
        document.addEventListener('keydown', onUserInput, true)
      }

      function unwatch() {
        if (observer !== null) observer.disconnect()
        observer = null
        document.removeEventListener('click', onUserInput, true)
        document.removeEventListener('keydown', onUserInput, true)
        if (frame !== 0) cancelAnimationFrame(frame)
        frame = 0
        if (retryTimer !== 0) clearTimeout(retryTimer)
        retryTimer = 0
        if (findTimer !== 0) clearTimeout(findTimer)
        findTimer = 0
      }

      function pass() {
        const body = content()
        if (body !== null) {
          changes(body, () => {
            if (enabled) {
              mark(body)
              openRows(body)
            } else {
              settleCollapse()
            }
          })
        }
        if (!enabled && pendingCollapse.size === 0 && pendingClose.size === 0) unwatch()
      }

      /**
       * Open visible Think rows the user has not collapsed by hand, and
       * reveal the folded group or turn around each hidden one. Revealing
       * re-renders the host, and the next pass opens the rows it uncovered.
       */
      function openRows(body) {
        let turns = null
        const turnButton = (turn) => {
          if (turns === null) {
            turns = new Map()
            for (const button of body.querySelectorAll(TURN_PROCESS)) {
              const key = button.getAttribute('data-turn-process')
              if (!turns.has(key)) turns.set(key, [])
              turns.get(key).push(button)
            }
          }
          return (turns.get(turn) ?? []).find(button => !button.disabled && !isOpen(button)) ?? null
        }
        /** The step group header for a folded group body, otherwise the owning turn's fold button. */
        const revealerOf = (hidden) => {
          if (hidden.matches(STEP_BODY)) {
            const group = hidden.closest(STEP_GROUP)
            return group === null ? null : stepHeaderOf(group)
          }
          const owner = hidden.closest(TURN_OWNER)
          return owner === null ? null : turnButton(owner.getAttribute('data-chat-turn'))
        }
        const revealers = new Set()
        acting = true
        try {
          for (const row of body.querySelectorAll(THINK_ROW)) {
            if (userCollapsed.has(row) || row.closest(CONTENT) !== body) continue
            const hidden = outermostHidden(row, body)
            if (hidden !== null) {
              const revealer = revealerOf(hidden)
              if (revealer !== null) revealers.add(revealer)
              continue
            }
            const toggle = toggleOf(row)
            if (toggle === null) continue
            if (isOpen(toggle)) {
              attempts.delete(row)
              continue
            }
            attempt(row, () => pressRow(toggle))
          }
          for (const control of autoOpened) {
            if (!control.isConnected) autoOpened.delete(control)
            else if (isOpen(control)) attempts.delete(control)
          }
          for (const revealer of revealers) {
            if (userClosed.has(revealer) || isOpen(revealer)) continue
            if (attempt(revealer, () => quietClick(revealer))) autoOpened.add(revealer)
          }
        } finally {
          acting = false
        }
      }

      /**
       * Press whatever the off switch still has to close. Turns go first: a
       * folding turn closes the groups inside it, and group headers are the
       * clicks a skin may hold for its animation, so they wait for a later pass.
       */
      function settleCollapse() {
        acting = true
        try {
          for (const row of pendingCollapse) {
            const toggle = toggleOf(row)
            if (!row.isConnected || toggle === null || !isOpen(toggle) || !attempt(row, () => pressRow(toggle))) {
              pendingCollapse.delete(row)
            }
          }
          for (const control of pendingClose) {
            if (!control.isConnected || control.disabled || !isOpen(control)) pendingClose.delete(control)
          }
          const turns = [...pendingClose].filter(control => control.matches(TURN_PROCESS))
          for (const control of turns.length > 0 ? turns : [...pendingClose]) {
            if (!attempt(control, () => quietClick(control))) pendingClose.delete(control)
          }
        } finally {
          acting = false
        }
      }

      /** The switch press: every Think row of this pane opens, or every one closes. */
      function toggle() {
        enabled = !enabled
        if (enabled) enabledSessions.add(sessionId)
        else enabledSessions.delete(sessionId)
        onChange(enabled)
        // An explicit switch press supersedes individual choices from before it.
        userCollapsed = new WeakSet()
        userClosed = new WeakSet()
        attempts = new WeakMap()
        pendingCollapse = new Set()
        pendingClose = new Set()
        const body = content()
        if (!enabled && body !== null) {
          changes(body, () => {
            unmark()
            for (const row of body.querySelectorAll(THINK_ROW)) {
              const toggle = toggleOf(row)
              if (row.closest(CONTENT) === body && toggle !== null && isOpen(toggle)) pendingCollapse.add(row)
            }
          })
          pendingClose = autoOpened
          autoOpened = new Set()
        }
        if (!enabled) unmark()
        watch()
        pass()
      }

      if (enabled) {
        watch()
        schedule()
      }

      return {
        toggle,
        /**
         * Stop driving this pane. Rows keep their state and the session keeps
         * its switch; the chat body is unmarked, since the pane may now show a
         * session whose switch is off.
         */
        dispose() {
          unwatch()
          releasePlace()
          unmark()
        },
      }
    }

    function ExpandToggle({ sessionId }) {
      const ref = React.useRef(null)
      const pane = React.useRef(null)
      const key = String(sessionId)
      const [on, setOn] = React.useState(() => enabledSessions.has(key))
      React.useEffect(() => {
        setOn(enabledSessions.has(key))
        if (ref.current === null) return undefined
        const controller = createPane(ref.current, key, setOn)
        pane.current = controller
        return () => {
          controller.dispose()
          if (pane.current === controller) pane.current = null
        }
      }, [key])
      return jsx('button', {
        ref,
        type: 'button',
        'aria-pressed': on,
        title: on ? '收起本会话的全部 Think' : '展开本会话的全部 Think',
        onClick: () => {
          pane.current?.toggle()
        },
        style: {
          cursor: 'pointer',
          border: 'none',
          background: on ? '#2b6cff' : 'rgba(43, 108, 255, 0.18)',
          color: on ? '#fff' : '#2b6cff',
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
      if (React === undefined || jsx === undefined) return
      ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register(
        {
          name: 'conversation.session.header.actions',
          id: 'think-expand',
          order: 40,
        },
        ExpandToggle,
      ))
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
