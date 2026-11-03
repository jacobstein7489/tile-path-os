/* Print one piece of the page (the scope of work, a PO) — clean, without the app around it. The paper's own name
 * (the project and what it is) is the page's title while it prints, so a saved PDF is named that way too. */
export function printNode(el: HTMLElement | null, title?: string) {
  if (!el) return
  let root = document.getElementById('print-root')
  if (!root) {
    root = document.createElement('div')
    root.id = 'print-root'
    document.body.appendChild(root)
  }
  root.innerHTML = el.outerHTML
  const was = document.title
  if (title) document.title = title
  const done = () => { if (root) root.innerHTML = ''; document.title = was; window.removeEventListener('afterprint', done) }
  window.addEventListener('afterprint', done)
  try { window.print() } catch { done() }
}
