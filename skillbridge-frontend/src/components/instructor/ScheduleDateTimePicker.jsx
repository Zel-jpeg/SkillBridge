import { useId, useState, useSyncExternalStore } from 'react'
import { Button, Calendar, CalendarCell, CalendarGrid, CalendarGridBody, CalendarGridHeader, CalendarHeaderCell, Heading } from 'react-aria-components/Calendar'
import { DateInput, DateSegment, Label } from 'react-aria-components/DateField'
import { Dialog, DialogTrigger } from 'react-aria-components/Dialog'
import { I18nProvider } from 'react-aria-components/I18nProvider'
import { Popover } from 'react-aria-components/Popover'
import { Modal, ModalOverlay } from 'react-aria-components/Modal'
import { TimeField } from 'react-aria-components/TimeField'
import { Time, today, toCalendarDate, toTime } from '@internationalized/date'
import { CalendarIcon, ChevronDown, ChevronRightIcon } from '../Icons'
import { parseScheduleValue, scheduleLabel, scheduleValue } from '../../utils/scheduleDateTime'

const secondary = 'inline-flex h-9 cursor-pointer items-center justify-center rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-600 outline-none transition-colors hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-green-600 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'

const compactQuery = '(max-width: 640px), (max-height: 760px)'
const compactSnapshot = () => window.matchMedia(compactQuery).matches
function subscribeCompact(listener) {
  const media = window.matchMedia(compactQuery)
  media.addEventListener('change', listener)
  return () => media.removeEventListener('change', listener)
}
const pickerSurface = 'overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 text-gray-800 shadow-xl outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100'

export default function ScheduleDateTimePicker({ label, value, onChange, error }) {
  const id = useId()
  const compact = useSyncExternalStore(subscribeCompact, compactSnapshot, () => false)
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(null)
  const [time, setTime] = useState(new Time(9))
  function changeOpen(next) {
    if (next) {
      const current = parseScheduleValue(value)
      setDate(current ? toCalendarDate(current) : null)
      setTime(current ? toTime(current) : new Time(9))
    }
    setOpen(next)
  }
  const content = (
        <Dialog aria-label={`${label} date and time`} className="outline-none">
          <div className="mb-3 flex items-baseline justify-between gap-3"><h3 className="text-xs font-semibold">{label}</h3><span className="text-[11px] text-gray-500 dark:text-gray-400">Asia/Manila</span></div>
          <Calendar aria-label={`${label} calendar`} value={date} onChange={setDate} defaultFocusedValue={date || today('Asia/Manila')} firstDayOfWeek="sun" className="w-full">
            <header className="mb-2 flex items-center justify-between gap-2">
              <Button slot="previous" aria-label="Previous month" className={`${secondary} w-8 border-0 px-0`}><span aria-hidden="true" className="rotate-180"><ChevronRightIcon size={16} /></span></Button>
              <Heading className="text-sm font-semibold" />
              <Button slot="next" aria-label="Next month" className={`${secondary} w-8 border-0 px-0`}><ChevronRightIcon size={16} /></Button>
            </header>
            <CalendarGrid className="w-full border-separate border-spacing-y-1 text-center text-xs">
              <CalendarGridHeader>{day => <CalendarHeaderCell className="pb-1 text-[11px] font-medium text-gray-400 dark:text-gray-500">{day}</CalendarHeaderCell>}</CalendarGridHeader>
              <CalendarGridBody>{day => <CalendarCell date={day} className="mx-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-xs outline-none hover:bg-green-50 focus-visible:ring-2 focus-visible:ring-green-600 data-[selected]:bg-green-600 data-[selected]:font-semibold data-[selected]:text-white data-[outside-month]:text-gray-400 data-[today]:ring-1 data-[today]:ring-green-500 dark:hover:bg-green-950 dark:data-[selected]:bg-green-600 dark:data-[outside-month]:text-gray-600" />}</CalendarGridBody>
            </CalendarGrid>
          </Calendar>
          <TimeField aria-label={`${label} time`} value={time} onChange={setTime} granularity="minute" hourCycle={12} className="mt-3 flex items-center justify-between gap-3 border-t border-gray-100 pt-3 dark:border-gray-800">
            <Label className="text-xs font-medium text-gray-600 dark:text-gray-300">Time</Label>
            <DateInput className="flex items-center rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800">{segment => <DateSegment segment={segment} className="rounded px-1 py-0.5 tabular-nums outline-none data-[focused]:bg-green-600 data-[focused]:text-white data-[placeholder]:text-gray-400 data-[type=literal]:px-0" />}</DateInput>
          </TimeField>
          <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">Choose a date, then set the time.</p>
          <div className="mt-4 flex items-center justify-between gap-2">
            <Button onPress={() => { onChange(''); setOpen(false) }} className="cursor-pointer rounded px-1 py-2 text-xs font-medium text-gray-500 outline-none hover:text-rose-700 focus-visible:ring-2 focus-visible:ring-green-600 dark:text-gray-400 dark:hover:text-rose-300">Clear</Button>
            <div className="flex gap-2"><Button onPress={() => setOpen(false)} className={secondary}>Cancel</Button><Button isDisabled={!date || !time} onPress={() => { onChange(scheduleValue(date, time)); setOpen(false) }} className="h-9 cursor-pointer rounded-lg bg-green-600 px-3 text-xs font-semibold text-white outline-none hover:bg-green-700 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40">Apply</Button></div>
          </div>
        </Dialog>
  )
  return <I18nProvider locale="en-PH"><div className="min-w-0 space-y-1.5">
    <span id={id} className="block text-xs font-medium text-gray-600 dark:text-gray-300">{label}</span>
    <DialogTrigger isOpen={open} onOpenChange={changeOpen}>
      <Button aria-label={`${label}: ${scheduleLabel(value)}`} aria-describedby={error ? `${id}-error` : undefined} aria-invalid={!!error} className={`flex h-10 w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg border bg-white px-3 text-left text-xs outline-none transition-colors hover:border-green-400 focus-visible:ring-2 focus-visible:ring-green-600 dark:bg-gray-800 ${error ? 'border-rose-500' : 'border-gray-200 dark:border-gray-700'}`}>
        <span aria-hidden="true" className="shrink-0 text-gray-400"><CalendarIcon size={15} /></span><span className={`min-w-0 flex-1 truncate ${value ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>{scheduleLabel(value)}</span><span aria-hidden="true" className="shrink-0 text-gray-400"><ChevronDown size={13} open={open} /></span>
      </Button>
      {compact ? <ModalOverlay isDismissable className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 p-3"><Modal className={`max-h-[calc(100dvh-24px)] w-[304px] max-w-full ${pickerSurface}`}>{content}</Modal></ModalOverlay> : <Popover placement="bottom start" offset={6} containerPadding={12} className={`z-[100] max-h-[calc(100dvh-24px)] w-[min(304px,calc(100vw-24px))] ${pickerSurface}`}>{content}</Popover>}
    </DialogTrigger>
    {error && <p id={`${id}-error`} role="alert" className="text-xs text-rose-700 dark:text-rose-300">{error}</p>}
  </div></I18nProvider>
}
