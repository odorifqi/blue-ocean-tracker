const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const abs = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
})
const short = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000], ['month', 2_592_000], ['week', 604_800], ['day', 86_400], ['hour', 3_600], ['minute', 60],
]

export function relativeTime(iso: string, now = Date.now()) {
  const secs = (new Date(iso).getTime() - now) / 1000
  for (const [unit, size] of UNITS) {
    if (Math.abs(secs) >= size) return rtf.format(Math.round(secs / size), unit)
  }
  return 'just now'
}

export const absoluteTime = (iso: string) => abs.format(new Date(iso))
const pad = (n: number) => String(n).padStart(2, '0')
/** e.g. "03-10-2026, 14:02" (DD-MM-YYYY, 24-hour), in the viewer's time zone. */
export function dateTime(iso: string) {
  const d = new Date(iso)
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export const shortDate = (iso: string) => short.format(new Date(iso))
export const utcTime = (iso: string) => new Date(iso).toISOString().replace('T', ' ').replace(/:\d{2}\.\d{3}Z$/, ' UTC')
