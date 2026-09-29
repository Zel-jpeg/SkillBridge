import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useSession } from '../../context/SessionContext'
import { ROLE_METADATA, ROLE_NAVIGATION, activeNavigationPath, readSidebarPreference, persistSidebarPreference } from '../../navigation/navigation'
import { BriefcaseIcon, CompanyIcon, GridIcon, ListIcon, MenuIcon, PanelIcon, PlusIcon, ReportIcon, SkillIcon, UserIcon, XIcon } from '../Icons'
import ProfileMenu from './ProfileMenu'
import ModalLayer from './ModalLayer'

const NAV_ICONS = { dashboard: GridIcon, assessments: ListIcon, skills: SkillIcon, users: UserIcon, create: PlusIcon, companies: CompanyIcon, placements: BriefcaseIcon, reports: ReportIcon }

function Brand({ role, compact = false }) {
  return <div className="sb-brand"><img src="/SB-logov1.png" alt="SkillBridge" />{!compact && <div><p>SkillBridge</p><span>{ROLE_METADATA[role].label}</span></div>}</div>
}

function Navigation({ role, collapsed = false, onNavigate, id }) {
  const { pathname } = useLocation()
  const active = activeNavigationPath(role, pathname)
  return <nav id={id} aria-label={`${ROLE_METADATA[role].label} navigation`} className={`sb-navigation ${collapsed ? 'is-collapsed' : ''}`}>
    {ROLE_NAVIGATION[role].map(item => <NavigationItem key={item.path} item={item} active={active === item.path} collapsed={collapsed} onNavigate={onNavigate} tooltipId={`${id}-${item.icon}-tooltip`} />)}
  </nav>
}

function NavigationItem({ item, active, collapsed, onNavigate, tooltipId }) {
  const Icon = NAV_ICONS[item.icon]
  const [tooltip, setTooltip] = useState(null)
  function showTooltip(event) {
    const rect = event.currentTarget.getBoundingClientRect()
    setTooltip({ left: rect.right + 16, top: rect.top + rect.height / 2 })
  }
  return <div className="sb-nav-item" onMouseLeave={event => { if (!event.currentTarget.contains(document.activeElement)) setTooltip(null) }}>
        <NavLink to={item.path} end={false} onClick={onNavigate} onMouseEnter={collapsed ? showTooltip : undefined} onFocus={collapsed ? showTooltip : undefined} onBlur={event => { if (!event.currentTarget.matches(':hover')) setTooltip(null) }} onKeyDown={event => { if (event.key === 'Escape') setTooltip(null) }} aria-current={active ? 'page' : undefined} aria-label={item.label} aria-describedby={collapsed && tooltip ? tooltipId : undefined} className={`sb-nav-link ${active ? 'is-active' : ''}`}>
          <span aria-hidden="true" className="sb-nav-icon"><Icon size={20} /></span>
          <span className={collapsed ? 'sr-only' : 'sb-nav-label'}>{item.label}</span>
        </NavLink>
        {collapsed && tooltip && createPortal(<span id={tooltipId} role="tooltip" className="sb-nav-tooltip" style={tooltip}>{item.label}</span>, document.body)}
      </div>
}

function ShellChrome({ role, children }) {
  const location = useLocation()
  const { expired } = useSession()
  const [collapsed, setCollapsed] = useState(() => readSidebarPreference(localStorage))
  // Key open UI to the current history entry so back/forward and direct navigation close it.
  const [drawerKey, setDrawerKey] = useState(null)
  const [profileKey, setProfileKey] = useState(null)
  const [previousLocationKey, setPreviousLocationKey] = useState(location.key)
  if (previousLocationKey !== location.key) {
    setPreviousLocationKey(location.key)
    setDrawerKey(null)
    setProfileKey(null)
  }
  const drawerOpen = !expired && drawerKey === location.key
  const profileOpen = !expired && profileKey === location.key
  const menuTrigger = useRef(null)
  const closeDrawer = useCallback(() => setDrawerKey(null), [])
  const closeProfile = useCallback(() => setProfileKey(null), [])

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)')
    function closeOnDesktop(event) { if (event.matches) closeDrawer() }
    media.addEventListener('change', closeOnDesktop)
    return () => media.removeEventListener('change', closeOnDesktop)
  }, [closeDrawer])

  function toggleCollapse() {
    const next = !collapsed
    setCollapsed(next)
    persistSidebarPreference(localStorage, next)
  }

  return <div className={`sb-shell ${collapsed ? 'sb-shell-collapsed' : ''}`}>
    <a className="sb-skip-link" href="#sb-main">Skip to content</a>
    <aside className="sb-desktop-sidebar" aria-label="Application sidebar">
      <Brand role={role} compact={collapsed} />
      <Navigation role={role} collapsed={collapsed} id="sb-desktop-navigation" />
      <button type="button" onClick={toggleCollapse} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} aria-controls="sb-desktop-navigation" className="sb-collapse-control"><PanelIcon collapsed={collapsed} />{!collapsed && <span>Collapse sidebar</span>}</button>
    </aside>
    <div className="sb-workspace">
      <header className="sb-top-header">
        <div className="sb-header-start"><button ref={menuTrigger} type="button" aria-label="Open navigation menu" aria-expanded={drawerOpen} aria-controls="sb-mobile-navigation" onClick={() => { closeProfile(); setDrawerKey(location.key) }} className="sb-menu-trigger"><MenuIcon /></button><span className="sb-header-role">{ROLE_METADATA[role].label} workspace</span></div>
        <ProfileMenu key={role} role={role} open={profileOpen} onClose={closeProfile} onToggle={() => { closeDrawer(); setProfileKey(profileOpen ? null : location.key) }} />
      </header>
      <main id="sb-main" tabIndex={-1} className="sb-main">{children}</main>
    </div>
    {drawerOpen && <ModalLayer label={`${ROLE_METADATA[role].label} navigation drawer`} onClose={closeDrawer} restoreRef={menuTrigger} className="sb-drawer-layer">
      <div className="sb-drawer-heading"><Brand role={role} /><button type="button" onClick={closeDrawer} aria-label="Close navigation menu" className="sb-drawer-close"><XIcon size={20} /></button></div>
      <Navigation role={role} id="sb-mobile-navigation" onNavigate={closeDrawer} />
    </ModalLayer>}
  </div>
}

export default function AuthenticatedShell({ role }) {
  // Stable children keep page content out of menu/collapse state updates.
  return <ShellChrome role={role}><Outlet /></ShellChrome>
}
