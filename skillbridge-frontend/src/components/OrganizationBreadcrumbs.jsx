import { Link } from 'react-router-dom'
import { ChevronRightIcon, GridIcon } from './Icons'
import './organizationBreadcrumbs.css'

export default function OrganizationBreadcrumbs({ items, label = 'Institute and program path', currentRef }) {
  return <nav aria-label={label} className="sb-organization-breadcrumbs">
    <ol>
      {items.map((item, index) => <li key={item.to || item.label}>
        {index > 0 && <span className="sb-organization-breadcrumb-separator" aria-hidden="true"><ChevronRightIcon /></span>}
        {item.to ? <Link to={item.to}>
          {index === 0 && <span aria-hidden="true"><GridIcon /></span>}{item.label}
        </Link> : item.onClick ? <button type="button" onClick={item.onClick}>
          {index === 0 && <span aria-hidden="true"><GridIcon /></span>}{item.label}
        </button> : <span className="sb-organization-breadcrumb-current" aria-current="page"
          ref={currentRef} tabIndex={currentRef ? -1 : undefined}>{item.label}</span>}
      </li>)}
    </ol>
  </nav>
}
