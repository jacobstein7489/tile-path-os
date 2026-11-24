/* Who an automation goes to, when the admin picked someone (Settings → Automations → Who gets it): the crew list, the
 * daily updates, Visit the jobs, installer pay, billing, invoice reminders. Nobody picked: the usual person (the site
 * manager, the admin, whoever does the books). */
import type { Store } from '@/tileos/store'
import type { PersonKey } from '@/tileos/data/model'

export const autoWho = (s: Pick<Store, 'rules'>, key: string): PersonKey | undefined => s.rules.autoWho?.[key]
