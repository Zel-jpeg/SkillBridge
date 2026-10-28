import { useCallback, useState } from 'react'
import { Button } from 'react-aria-components/Button'
import { Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components/Menu'
import { ChevronDown } from './Icons'

/** Keep popovers in their native dialog's top layer, outside its scrolling body. */
export default function ActionMenu({ label, children, items, onAction, disabled, className = '' }) {
  const [portalContainer, setPortalContainer] = useState(undefined)
  const attach = useCallback(node => setPortalContainer(node?.closest('dialog') || undefined), [])
  return <span ref={attach} className="inline-flex shrink-0">
    <MenuTrigger>
      <Button aria-label={label} isDisabled={disabled} className={className}>
        {children || <>{label}<ChevronDown size={14} /></>}
      </Button>
      <Popover UNSTABLE_portalContainer={portalContainer} boundaryElement={portalContainer} placement="bottom end" offset={6}
        className="z-[100] min-w-48 max-w-[calc(100vw-32px)] rounded-xl border border-gray-200 bg-white p-1.5 text-xs text-gray-800 shadow-lg dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
        <Menu aria-label={label} onAction={onAction} className="outline-none">
          {items.map(item => <MenuItem key={item.id} id={item.id} textValue={item.label} isDisabled={item.disabled}
            className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 outline-none data-disabled:cursor-not-allowed data-disabled:opacity-50 ${item.danger ? 'text-rose-700 data-focused:bg-rose-50 dark:text-rose-300 dark:data-focused:bg-rose-950' : 'data-focused:bg-green-50 dark:data-focused:bg-green-950'}`}>
            {item.icon}<span>{item.label}</span>
          </MenuItem>)}
        </Menu>
      </Popover>
    </MenuTrigger>
  </span>
}
