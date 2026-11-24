import * as React from 'react'

/** one part that can't be drawn doesn't take the page down with it: it's left out (or shows `fallback`), and the
 *  error still goes out as an error of the page (the console, any monitoring, the tests), so it gets fixed */
export class Safe extends React.Component<{ children: React.ReactNode; fallback?: React.ReactNode; name?: string }, { failed: boolean }> {
  override state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  override componentDidCatch(e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e))
    if (this.props.name) err.message = `${this.props.name}: ${err.message}`
    setTimeout(() => {
      throw err
    })
  }
  override render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children
  }
}
