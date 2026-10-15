/* When this copy of the app was built — the account menu shows it, so anyone can tell whether they're on the latest
 * (the live link only changes when someone presses Publish → Update in Lovable). */
declare const __BUILT__: string
const iso: string = typeof __BUILT__ !== 'undefined' ? __BUILT__ : ''
export const BUILT = iso
  ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  : ''
