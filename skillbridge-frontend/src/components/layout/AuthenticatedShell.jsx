import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useSession } from '../../context/SessionContext'
import { ROLE_METADATA, ROLE_NAVIGATION_SECTIONS, activeNavigationPath, readSidebarPreference, persistSidebarPreference } from '../../navigation/navigation'
import { BriefcaseIcon, ChevronDown, CompanyIcon, GridIcon, ListIcon, MenuIcon, PanelIcon, RefreshIcon, ReportIcon, SkillIcon, UserIcon, UsersIcon, XIcon } from '../Icons'
import ProfileMenu from './ProfileMenu'
import NotificationMenu from './NotificationMenu'
import StudentNotificationMenu from './StudentNotificationMenu'
import ModalLayer from './ModalLayer'
import { promoteDestination } from '../../api/prefetch.js'

const NAV_ICONS = { dashboard: GridIcon, assessments: ListIcon, retakes: RefreshIcon, skills: SkillIcon, users: UserIcon, batches: UsersIcon, institutes: CompanyIcon, companies: CompanyIcon, placements: BriefcaseIcon, reports: ReportIcon }

function Brand({ role, compact = false }) {
  return <div className="sb-brand"><img src="/SB-logov1.png" alt="SkillBridge" />{!compact && <div><p>SkillBridge</p><span>{ROLE_METADATA[role].label}</span></div>}</div>
}

function Navigation({ role, collapsed = false, onNavigate, id }) {
  const { pathname } = useLocation()
  const active = activeNavigationPath(role, pathname)
  const activeGroup = ROLE_NAVIGATION_SECTIONS[role].find(section => section.label && section.items.some(item => item.path === active))?.id ?? null
  const [openGroup, setOpenGroup] = useState(activeGroup)
  const [previousPath, setPreviousPath] = useState(pathname)
  if (previousPath !== pathname) {
    setPreviousPath(pathname)
    setOpenGroup(activeGroup)
  }
  return <nav id={id} aria-label={`${ROLE_METADATA[role].label} navigation`} className={`sb-navigation ${collapsed ? 'is-collapsed' : ''}`}>
    {ROLE_NAVIGATION_SECTIONS[role].map(section => {
      const containsActive = section.items.some(item => item.path === active)
      const links = section.items.map(item => <NavigationItem key={item.path} item={item} active={active === item.path} collapsed={collapsed} onNavigate={onNavigate} tooltipId={`${id}-${item.path.replaceAll('/', '-')}-tooltip`} />)
      return section.label
        ? <NavigationGroup key={section.id} section={section} active={containsActive} collapsed={collapsed} open={openGroup === section.id} onToggle={() => setOpenGroup(current => current === section.id ? null : section.id)}>{links}</NavigationGroup>
        : <div key={section.id} className="sb-nav-links">{links}</div>
    })}
  </nav>
}

function NavigationGroup({ section, active, collapsed, children, open, onToggle }) {
  const panel = useId()
  const Icon = NAV_ICONS[section.icon]
  if (collapsed) return <div className="sb-nav-rail-group sb-nav-links" role="group" aria-label={section.label}>{children}</div>
  return <div className="sb-nav-group">
    <button type="button" className={`sb-nav-group-toggle ${active ? 'contains-current' : ''}`} aria-expanded={open} aria-controls={panel} onClick={onToggle}>
      <span aria-hidden="true" className="sb-nav-icon"><Icon size={20} /></span>
      <span>{section.label}</span>
      <span aria-hidden="true" className="sb-nav-group-chevron"><ChevronDown size={15} /></span>
    </button>
    <div id={panel} className="sb-nav-group-panel" data-open={open} inert={!open} aria-hidden={!open}>
      <div className="sb-nav-group-clip"><div className="sb-nav-group-links">{children}</div></div>
    </div>
  </div>
}

function NavigationItem({ item, active, collapsed, onNavigate, tooltipId }) {
  const Icon = NAV_ICONS[item.icon]
  const [tooltip, setTooltip] = useState(null)
  function showTooltip(event) {
    const rect = event.currentTarget.getBoundingClientRect()
    setTooltip({ left: rect.right + 16, top: rect.top + rect.height / 2 })
  }
  function prepare(event) {
    promoteDestination(item.path)
    if (collapsed) showTooltip(event)
  }
  return <div className="sb-nav-item" onMouseLeave={event => { if (!event.currentTarget.contains(document.activeElement)) setTooltip(null) }}>
        <Link to={item.path} onClick={onNavigate} onMouseEnter={prepare} onFocus={prepare} onBlur={event => { if (!event.currentTarget.matches(':hover')) setTooltip(null) }} onKeyDown={event => { if (event.key === 'Escape') setTooltip(null) }} aria-current={active ? 'page' : undefined} aria-label={item.label} aria-describedby={collapsed && tooltip ? tooltipId : undefined} className={`sb-nav-link ${active ? 'is-active' : ''}`}>
          <span aria-hidden="true" className="sb-nav-icon"><Icon size={20} /></span>
          <span className={collapsed ? 'sr-only' : 'sb-nav-label'}>{item.label}</span>
        </Link>
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
  const [notificationKey, setNotificationKey] = useState(null)
  const [previousLocationKey, setPreviousLocationKey] = useState(location.key)
  if (previousLocationKey !== location.key) {
    setPreviousLocationKey(location.key)
    setDrawerKey(null)
    setProfileKey(null)
    setNotificationKey(null)
  }
  const drawerOpen = !expired && drawerKey === location.key
  const profileOpen = !expired && profileKey === location.key
  const notificationOpen = !expired && notificationKey === location.key
  const menuTrigger = useRef(null)
  const closeDrawer = useCallback(() => setDrawerKey(null), [])
  const closeProfile = useCallback(() => setProfileKey(null), [])
  const closeNotifications = useCallback(() => setNotificationKey(null), [])

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
        <div className="sb-header-start"><button ref={menuTrigger} type="button" aria-label="Open navigation menu" aria-expanded={drawerOpen} aria-controls="sb-mobile-navigation" onClick={() => { closeProfile(); closeNotifications(); setDrawerKey(location.key) }} className="sb-menu-trigger"><MenuIcon /></button><span className="sb-header-role">{ROLE_METADATA[role].label} workspace</span></div>
        <div className="sb-header-actions">
          {role === 'student'
            ? <StudentNotificationMenu open={notificationOpen} onClose={closeNotifications} onToggle={() => { closeDrawer(); closeProfile(); setNotificationKey(notificationOpen ? null : location.key) }} />
            : <NotificationMenu role={role} open={notificationOpen} onClose={closeNotifications} onToggle={() => { closeDrawer(); closeProfile(); setNotificationKey(notificationOpen ? null : location.key) }} />}
          <ProfileMenu key={role} role={role} open={profileOpen} onClose={closeProfile} onToggle={() => { closeDrawer(); closeNotifications(); setProfileKey(profileOpen ? null : location.key) }} />
        </div>
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
