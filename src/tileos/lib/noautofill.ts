/* No contact AutoFill over the keyboard (iPhone's "AutoFill Contact" bar, Android's suggestions, password managers):
 * typing a search, a name or a note shows just the keyboard.
 *   - every box gets autocomplete off and a plain name of its own the moment it appears
 *   - the words that make a phone think a box is for a contact (name, address, email, phone, company, city…) get an
 *     invisible break inside them in the box's hint and label — it reads the same, the phone no longer matches it
 * The sign-in's email and password say what they are and keep their AutoFill. */
const SKIP = new Set(['password', 'hidden', 'checkbox', 'radio', 'file', 'range', 'color', 'submit', 'button', 'reset', 'image'])
const WORDS = /\b(names?|address(?:es)?|e-?mails?|phones?|mobile|company|companies|city|zip|street|contacts?|organi[sz]ation)\b/i
const ZW = '‌'
const breakWords = (v: string) => v.replace(new RegExp(WORDS.source, 'gi'), (w) => w[0] + ZW + w.slice(1))
let n = 0
function quiet(el: Element) {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return
  const ac = el.getAttribute('autocomplete')
  if (ac && ac !== 'off') return
  if (el instanceof HTMLInputElement && SKIP.has(el.type)) return
  if (ac !== 'off') el.setAttribute('autocomplete', 'off')
  if (!el.hasAttribute('data-1p-ignore')) {
    el.setAttribute('data-1p-ignore', '')
    el.setAttribute('data-lpignore', 'true')
    el.setAttribute('data-form-type', 'other')
  }
  if (!el.getAttribute('name')) el.setAttribute('name', `tileos-box-${++n}`)
  for (const a of ['placeholder', 'aria-label']) {
    const v = el.getAttribute(a)
    if (v && WORDS.test(v)) el.setAttribute(a, breakWords(v))
  }
  /* a search box: no corrections either */
  if (el instanceof HTMLInputElement && (el.type === 'search' || el.getAttribute('role') === 'combobox' || el.hasAttribute('cmdk-input') || /search|find|type a|pick/i.test(el.placeholder))) {
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
    for (const m of list) {
      if (m.type === 'attributes') { quiet(m.target as Element); continue }
      m.addedNodes.forEach((x) => {
        if (!(x instanceof Element)) return
        quiet(x)
        if (x.firstElementChild) x.querySelectorAll('input, textarea').forEach(quiet)
      })
    }
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['placeholder', 'aria-label', 'autocomplete'] })
  /* a box that was there before and got focus: make sure too */
  document.addEventListener('focusin', (e) => { if (e.target instanceof Element) quiet(e.target) }, true)
}
