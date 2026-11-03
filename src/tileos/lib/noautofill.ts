/* No contact AutoFill over the keyboard (iPhone's "AutoFill Contact" bar, Android's suggestions, password managers):
 * typing a search, a name or a note shows just the keyboard. Every box the app puts on the screen gets autocomplete off
 * the moment it appears — except the ones that say what they are (the sign-in's email and password keep theirs). */
const SKIP = new Set(['password', 'hidden', 'checkbox', 'radio', 'file', 'range', 'color', 'submit', 'button', 'reset', 'image'])
function quiet(el: Element) {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return
  if (el.hasAttribute('autocomplete')) return
  if (el instanceof HTMLInputElement && SKIP.has(el.type)) return
  el.setAttribute('autocomplete', 'off')
  el.setAttribute('data-1p-ignore', '')
  el.setAttribute('data-lpignore', 'true')
  el.setAttribute('data-form-type', 'other')
  /* a search box: no corrections either */
  if (el instanceof HTMLInputElement && (el.type === 'search' || el.getAttribute('role') === 'combobox' || /search|find|type a|pick/i.test(el.placeholder))) {
    if (!el.hasAttribute('autocorrect')) el.setAttribute('autocorrect', 'off')
    if (!el.hasAttribute('spellcheck')) el.setAttribute('spellcheck', 'false')
  }
}
let on = false
export function noAutofill() {
  if (on || typeof document === 'undefined' || typeof MutationObserver === 'undefined') return
  on = true
  document.querySelectorAll('input, textarea').forEach(quiet)
  new MutationObserver((list) => {
    for (const m of list) m.addedNodes.forEach((n) => {
      if (!(n instanceof Element)) return
      quiet(n)
      if (n.firstElementChild) n.querySelectorAll('input, textarea').forEach(quiet)
    })
  }).observe(document.documentElement, { childList: true, subtree: true })
  /* a box that was there before and got focus: make sure too */
  document.addEventListener('focusin', (e) => { if (e.target instanceof Element) quiet(e.target) }, true)
}
