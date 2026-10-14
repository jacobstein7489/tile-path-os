/* Print one piece of the page (the scope of work, a PO) — clean, without the app around it. */
export function printNode(el: HTMLElement | null) {
  if (!el) return
  let root = document.getElementById('print-root')
  if (!root) {
    root = document.createElement('div')
    root.id = 'print-root'
    document.body.appendChild(root)
  }
  root.innerHTML = el.outerHTML
  const done = () => { if (root) root.innerHTML = ''; window.removeEventListener('afterprint', done) }
  window.addEventListener('afterprint', done)
  try { window.print() } catch { done() }
}
