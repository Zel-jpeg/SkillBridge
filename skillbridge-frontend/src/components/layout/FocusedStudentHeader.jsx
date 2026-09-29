import { useCallback, useState } from 'react'
import { useLocation } from 'react-router-dom'
import ProfileMenu from './ProfileMenu'

// Mounted only on the integrity agreement, never during a monitored attempt.
export default function FocusedStudentHeader({ student }) {
  const { key } = useLocation()
  const [openKey, setOpenKey] = useState(null)
  const [previousKey, setPreviousKey] = useState(key)
  if (previousKey !== key) {
    setPreviousKey(key)
    setOpenKey(null)
  }
  const close = useCallback(() => setOpenKey(null), [])
  const open = openKey === key
  return <header className="sb-top-header">
    <div className="sb-focused-brand"><img src="/SB-logov1.png" alt="SkillBridge" /><span>SkillBridge</span></div>
    <ProfileMenu role="student" student={student} open={open} onClose={close} onToggle={() => setOpenKey(open ? null : key)} />
  </header>
}
