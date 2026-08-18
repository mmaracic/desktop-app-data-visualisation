import { useState } from 'react'
import './App.css'
import { PAGES } from './config'
import { SideMenu } from './components/SideMenu'
import { LightTemperaturePage } from './pages/LightTemperaturePage'

function App() {
  const [activePageId, setActivePageId] = useState(PAGES[0].id)
  const [menuCollapsed, setMenuCollapsed] = useState(false)

  const activePage = PAGES.find((p) => p.id === activePageId) ?? PAGES[0]

  return (
    <div className="app">
      <SideMenu
        pages={PAGES}
        activePageId={activePageId}
        collapsed={menuCollapsed}
        onSelectPage={setActivePageId}
        onToggleCollapsed={() => setMenuCollapsed(!menuCollapsed)}
      />
      <div className="app-content">
        <main className="page-content">
          <LightTemperaturePage page={activePage} />
        </main>
      </div>
    </div>
  )
}

export default App

