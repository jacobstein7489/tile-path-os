/* Web Push, by hand (no library): a notification to a phone or a computer, through that device's own push service
 * (Apple's, Google's, Mozilla's). The message is sealed for that one device (RFC 8291, "aes128gcm") and signed as
 * ours (VAPID, RFC 8292), so the push service knows who sends it and can't read it. Only the browser's own crypto. */
const enc = new TextEncoder()

export const b64u = (b: ArrayBuffer | Uint8Array): string => {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b)
  let s = ''
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export const unb64u = (s: string): Uint8Array => {
  const t = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(t + '==='.slice((t.length + 3) % 4))
  const u = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i)
  return u
}
const cat = (...xs: Uint8Array[]): Uint8Array => {
  const o = new Uint8Array(xs.reduce((n, x) => n + x.length, 0))
  let i = 0
  for (const x of xs) { o.set(x, i); i += x.length }
  return o
}
async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', key as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data as BufferSource))
}

export type VapidKeys = { publicKey: string; privateJwk: JsonWebKey }
/** a new pair of our push keys: the public one (base64url, the uncompressed point) goes to each browser, the private
 *  one (JWK) stays on the server */
export async function newVapidKeys(): Promise<VapidKeys> {
  const kp = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey))
  return { publicKey: b64u(raw), privateJwk: await crypto.subtle.exportKey('jwk', kp.privateKey) }
}

/** the message sealed for one device (its p256dh key and auth secret, as the browser gave them). `salt` and `asKeys`
 *  only to check it against the RFC's own example */
export async function encrypt(payload: Uint8Array, p256dh: string, auth: string, o: { salt?: Uint8Array; asKeys?: CryptoKeyPair } = {}): Promise<Uint8Array> {
  const uaPub = unb64u(p256dh)
  const authSecret = unb64u(auth)
  const salt = o.salt || crypto.getRandomValues(new Uint8Array(16))
  const as = o.asKeys || ((await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair)
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey))
  const uaKey = await crypto.subtle.importKey('raw', uaPub as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256))
  /* RFC 8291 §3.3–3.4: the shared secret and the device's auth secret → the key and nonce for this one message */
  const prkKey = await hmac(authSecret, ecdh)
  const ikm = (await hmac(prkKey, cat(enc.encode('WebPush: info\0'), uaPub, asPub, new Uint8Array([1])))).slice(0, 32)
  const prk = await hmac(salt, ikm)
  const cek = (await hmac(prk, cat(enc.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16)
  const nonce = (await hmac(prk, cat(enc.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12)
  const key = await crypto.subtle.importKey('raw', cek as BufferSource, { name: 'AES-GCM' }, false, ['encrypt'])
  /* one record: the message, then 2 (it's the last one) */
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce as BufferSource }, key, cat(payload, new Uint8Array([2])) as BufferSource))
  const rs = new Uint8Array(4)
  new DataView(rs.buffer).setUint32(0, 4096)
  return cat(salt, rs, new Uint8Array([asPub.length]), asPub, sealed)
}

/** our signature for the device's push service (VAPID): good for 12 hours */
export async function vapidAuth(endpoint: string, keys: VapidKeys, subject: string): Promise<string> {
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const body = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })))
  const key = await crypto.subtle.importKey('jwk', keys.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${body}`) as BufferSource))
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${keys.publicKey}`
}

export type PushTarget = { endpoint: string; p256dh: string; auth: string }
/** one notification to one device. The push service answers 201 (on its way); 404 or 410: that device is gone */
export async function sendPush(to: PushTarget, message: unknown, keys: VapidKeys, subject: string, ttl = 3600): Promise<number> {
  const body = await encrypt(enc.encode(JSON.stringify(message)), to.p256dh, to.auth)
  const res = await fetch(to.endpoint, {
    method: 'POST',
    headers: { 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: String(ttl), Urgency: 'high', Authorization: await vapidAuth(to.endpoint, keys, subject) },
    body: body as BodyInit,
  })
  return res.status
}
