import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApi } from '../../hooks/useApi'
import { useSession } from '../../context/SessionContext'
import { logoutSession } from '../../api/logout'
import { ROLE_METADATA, profileIdentity, readCachedUser } from '../../navigation/navigation'
import { LogoutIcon, ThemeIcon, UserIcon } from '../Icons'
import ModalLayer from './ModalLayer'

export default function ProfileMenu({ role, open, onToggle, onClose, student }) {
  const navigate = useNavigate()
  const { expired } = useSession()
  const [cachedUser] = useState(() => readCachedUser(localStorage))
  const { data } = useApi(role === 'student' ? '/api/students/me/' : null, { initialData: cachedUser })
  const identity = profileIdentity(role, data ?? cachedUser)
  // The focused pre-start assessment supplies its existing identity shape.
  const hasIdentity = typeof data?.name === 'string' && data.name.trim().length > 0
  const name = hasIdentity ? identity.name : student?.name || identity.name
  const initials = hasIdentity ? identity.initials : student?.initials || identity.initials
  const photoUrl = hasIdentity ? identity.photoUrl : student?.photoUrl ?? identity.photoUrl
  const detail = hasIdentity ? identity.detail : student ? [student.course, student.studentId].filter(Boolean).join(' / ') : identity.detail
  const metadata = ROLE_METADATA[role]
  const [failedPhoto, setFailedPhoto] = useState(null)
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const [logoutOpen, setLogoutOpen] = useState(false)
  const ref = useRef(null)
  const trigger = useRef(null)
  const closeLogout = useCallback(() => setLogoutOpen(false), [])

  useEffect(() => {
    if (!open) return
    function outside(event) { if (!ref.current?.contains(event.target)) onClose() }
    function key(event) {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); trigger.current?.focus() }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', key)
    }
  }, [open, onClose])

  function toggleTheme() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    try { localStorage.setItem('sb-theme', next ? 'dark' : 'light') } catch { /* Keep the current theme in memory. */ }
  }

  return <>
    <div className="sb-profile" ref={ref} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) onClose() }}>
      <button ref={trigger} type="button" onClick={onToggle} aria-label="Open profile menu" aria-expanded={open} aria-controls="sb-profile-menu" className="sb-profile-trigger">
        <span className={`sb-avatar ${metadata.avatarClass}`}>
          {photoUrl && failedPhoto !== photoUrl
            ? <img src={photoUrl} alt={`${name}'s profile photo`} referrerPolicy="no-referrer" onError={() => setFailedPhoto(photoUrl)} />
            : initials}
        </span>
      </button>
      {open && <div id="sb-profile-menu" className="sb-profile-menu" aria-label={`${metadata.label} profile options`}>
        <div className="sb-profile-identity"><p>{name}</p><span>{detail || metadata.label}</span></div>
        {metadata.profilePath && <Link to={metadata.profilePath} onClick={onClose} className="sb-profile-action"><UserIcon size={18} />My profile</Link>}
        <button type="button" onClick={toggleTheme} aria-pressed={dark} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} className="sb-profile-action"><ThemeIcon size={18} /><span>{dark ? 'Dark mode' : 'Light mode'}</span><span aria-hidden="true" className={`sb-theme-switch ${dark ? 'is-dark' : ''}`} /></button>
        <button type="button" onClick={() => { onClose(); setLogoutOpen(true) }} className="sb-profile-action sb-logout"><LogoutIcon size={18} />Log out</button>
      </div>}
    </div>
    {logoutOpen && !expired && <ModalLayer labelId="sb-logout-title" onClose={closeLogout} restoreRef={trigger} className="sb-logout-layer">
      <div className="sb-logout-dialog">
        <h2 id="sb-logout-title">Log out of SkillBridge?</h2>
        <p>You can always log back in using your {role === 'student' ? 'DNSC Google ' : ''}account.</p>
        <div className="sb-dialog-actions"><button type="button" onClick={closeLogout}>Cancel</button><button type="button" className="sb-confirm-logout" onClick={() => logoutSession(navigate, role)}>Log out</button></div>
      </div>
    </ModalLayer>}
  </>
}
