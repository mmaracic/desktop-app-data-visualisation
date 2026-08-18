import type { PageConfig } from '../types'

export function SideMenu({
    pages,
    activePageId,
    collapsed,
    onSelectPage,
    onToggleCollapsed,
}: {
    pages: PageConfig[]
    activePageId: string
    collapsed: boolean
    onSelectPage: (id: string) => void
    onToggleCollapsed: () => void
}) {
    return (
        <nav className={`side-menu ${collapsed ? 'collapsed' : ''}`}>
            <button
                className="side-menu-toggle"
                onClick={onToggleCollapsed}
                aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
            >
                {collapsed ? '»' : '«'}
            </button>
            <ul className="side-menu-list">
                {pages.map((page) => (
                    <li key={page.id}>
                        <button
                            className={`side-menu-item ${activePageId === page.id ? 'active' : ''}`}
                            onClick={() => onSelectPage(page.id)}
                            title={page.label}
                        >
                            {collapsed ? page.label.charAt(0) : page.label}
                        </button>
                    </li>
                ))}
            </ul>
        </nav>
    )
}
