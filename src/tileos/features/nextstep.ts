/* What a to-do is for, read from its words wherever the verb is: "yakov lets do this together tom order missing tiles
 * 15 pieces 48x48" is an order, not a plain to-do. Its button says what doing it is (Ordered, Called, Sent, Fixed…),
 * and the ones with something after them carry on by themselves:
 *   an order (order, reorder, place the order)  Ordered → how it gets there, and the day → it waits for it → Came in?
 *   something to buy (buy, purchase)            Bought → it's there already, or someone brings it (on their Today)
 *   a call (call, text, ask, find out, tell…)   Called → what did they say (no answer: tomorrow)
 *   anything else it knows (send, fix, pick up) its own word, and it's done
 * A verb counts wherever it is, but not as a noun: "the order", "PO order", "after the call", "order #4471". */
import { PEOPLE } from '@/tileos/data/model'

export type NextKind = 'order' | 'buy' | 'call' | 'do'
export type Next = { kind: NextKind; word: string; /** the words after the verb: what it's about ("missing tiles 15 pieces 48x48") */ rest: string }

/** a verb: its words, what kind of to-do it makes, the word for having done it — and (first) whether it only counts
 *  as the first word (after a name, "lets", "please"…): the ones that are as often a noun ("the check", "spec book") */
type Verb = [RegExp, NextKind, string, boolean?]
const VERBS: Verb[] = [
  /* calls and questions first: "check with" is asking, not checking */
  [/\bfollow[\s-]?up(?:\s+(?:with|on|about)\b)?/gi, 'call', 'Followed up'],
  [/\breach(?:ed)? out(?:\s+to\b)?/gi, 'call', 'Reached out'],
  [/\bcheck(?:\s+in)?\s+with\b/gi, 'call', 'Asked'],
  [/\bfind out\b/gi, 'call', 'Asked'],
  [/\bask\b/gi, 'call', 'Asked'],
  [/\b(?:call|phone|ring)\b/gi, 'call', 'Called'],
  [/\btext\b/gi, 'call', 'Texted'],
  [/\b(?:speak|talk)\s+(?:to|with)\b/gi, 'call', 'Talked'],
  [/\btell\b/gi, 'call', 'Told'],
  [/\blet\s+(?!us\b|me\b)\w+\s+know\b/gi, 'call', 'Told'],
  /* orders */
  [/\b(?:place|put in)\s+(?:the\s+|an\s+|a\s+)?(?:re-?)?order\b/gi, 'order', 'Ordered'],
  [/\b(?:re-?)?order\b/gi, 'order', 'Ordered'],
  [/\b(?:buy|purchase)\b/gi, 'buy', 'Bought'],
  /* the rest: the word for having done it */
  [/\b(?:send|email|e-mail)\b/gi, 'do', 'Sent'],
  [/\bmail\b/gi, 'do', 'Sent', true],
  [/\b(?:pick\s*up|pickup)\b/gi, 'do', 'Picked up'],
  [/\bcollect\b/gi, 'do', 'Collected'],
  [/\bdeliver\b/gi, 'do', 'Delivered'],
  [/\b(?:drop\s*off|bring(?!\s+up\b))\b/gi, 'do', 'Dropped off'],
  [/\b(?:fix|repair|patch)\b/gi, 'do', 'Fixed'],
  [/\binstall\b/gi, 'do', 'Installed'],
  [/\b(?:inspect|verify)\b/gi, 'do', 'Checked'],
  [/\bcheck\b/gi, 'do', 'Checked', true],
  [/\bconfirm\b/gi, 'do', 'Confirmed'],
  [/\bschedule\b/gi, 'do', 'Booked'],
  [/\bbook\b/gi, 'do', 'Booked', true],
  [/\bset\s*up\b/gi, 'do', 'Set up'],
  [/\bpay\b/gi, 'do', 'Paid', true],
  [/\bmeasure\b/gi, 'do', 'Measured'],
  [/\bupload\b/gi, 'do', 'Uploaded'],
  [/\bprint\b/gi, 'do', 'Printed', true],
  [/\bclean\b/gi, 'do', 'Cleaned', true],
  [/\bclear\b/gi, 'do', 'Cleared', true],
  [/\bsign\b/gi, 'do', 'Signed', true],
  [/\bprice\b/gi, 'do', 'Priced', true],
]
/** said as a thing, not a thing to do: a word like "the", "PO", "after" just before it… */
const NOUN_BEFORE = /(?:^|[\s,(])(?:the|a|an|this|that|these|those|my|your|his|her|our|their|its|po|purchase|work|change|back|special|tile|tiles|grout|new|same|next|last|first|per|in|on|of|from|for|after|before|about|by|no|any|each|every|whole|full|old|big|small|phone|conference|zoom|spec|site)\s+$/i
/** …or a word just after it: "order #4471", "the call is at 3", "order came in" */
const NOUN_AFTER = /^\s*(?:#|number\b|no\.?\s*\d|is\b|was\b|came\b|arrived\b|status\b|confirmation\b|form\b|sheet\b|date\b|total\b|of\b|list\b|log\b|app\b)/i
/** what can come before the first word without being the to-do: a name, "lets", "please", "need to"… */
const FILLER = ['hey', 'hi', 'yo', 'ok', 'okay', 'please', 'pls', 'plz', 'lets', "let's", 'let’s', 'let us', 'we', 'i', 'you', 'u', 'can you', 'could you', 'need to', 'needs to', 'have to', 'has to', 'got to', 'gotta', 'must', 'should', 'make sure to', 'make sure you', 'remember to', "don't forget to", 'dont forget to', 'don’t forget to', 'go', 'and', 'then', 'also', 'asap', 'urgent', 'urgently', 'today', 'tomorrow', 'tmrw', 'tmr', 'to']
const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** the team's places that aren't a person's name ("Back office", "Tile OS"): their words stay words */
const NOT_NAMES = new Set(['system', 'office', 'takeoff', 'estimator', 'materials', 'accounting', 'gcpp'])
function leadIn(): RegExp {
  const names = Object.values(PEOPLE).filter((p) => !NOT_NAMES.has(p.key)).flatMap((p) => [p.short, p.name, p.name?.split(' ')[0]]).filter((x): x is string => !!x && x.length > 1 && !/[()]/.test(x))
  const words = Array.from(new Set([...FILLER, ...names.map((x) => x.toLowerCase())])).sort((a, b) => b.length - a.length).map(esc)
  return new RegExp(`^(?:[\\s,.:;!\\-–—]+|(?:${words.join('|')})(?=$|[\\s,.:;!\\-–—]))`, 'i')
}
/** where the to-do itself starts: past a name, "lets", "please"… ("Yakov, please call the GC" → "call the GC") */
export function startOf(title: string): number {
  const re = leadIn()
  let i = 0
  for (let n = 0; n < 12; n++) {
    const m = title.slice(i).match(re)
    if (!m || !m[0]) break
    i += m[0].length
  }
  return i
}

/** what the to-do is for, from its words — the first verb in it that's a thing to do (none: a plain to-do) */
export function nextOf(title: string): Next | undefined {
  const text = title || ''
  /* waiting for something isn't a thing to do */
  if (/^\s*waiting\s+(?:for|on)\b/i.test(text)) return undefined
  const start = startOf(text)
  let best: { at: number; end: number; kind: NextKind; word: string } | undefined
  for (const [re, kind, word, first] of VERBS) {
    re.lastIndex = 0
    for (const m of text.matchAll(re)) {
      const at = m.index ?? 0
      if (best && at >= best.at) break
      if (first && at !== start) continue
      const before = text.slice(0, at)
      const after = text.slice(at + m[0].length)
      /* the first word is a verb unless a word after it says it's a thing ("Order #4471 came"); later ones not when a
         word before or after says so */
      if (NOUN_AFTER.test(after) || (at > start && NOUN_BEFORE.test(before))) continue
      best = { at, end: at + m[0].length, kind, word }
      break
    }
  }
  if (!best) return undefined
  const rest = text.slice(best.end).replace(/^[\s,.:;\-–—]+/, '').trim()
  return { kind: best.kind, word: best.word, rest }
}
/** the word for having done it: Ordered, Called, Sent, Fixed… — else Done */
export const doneWord = (title: string) => nextOf(title)?.word || 'Done'
/** a call, a text, a question: its button asks what they said */
export const isCall = (title: string) => nextOf(title)?.kind === 'call'
/** something to order or buy: its button asks how it gets there, then it's followed until it's there */
export const isOrder = (title: string) => { const k = nextOf(title)?.kind; return k === 'order' || k === 'buy' }
/** what's being ordered, in a few words for the one who brings it ("Missing tiles 15 pieces 48x48") */
export function whatOf(title: string): string {
  const n = nextOf(title)
  const w = (n?.rest || title).replace(/\s+/g, ' ').trim()
  return w ? w.charAt(0).toUpperCase() + w.slice(1) : title
}
