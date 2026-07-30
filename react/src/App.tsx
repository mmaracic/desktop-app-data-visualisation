import { useState } from 'react'
import './App.css'
import { TABS } from './config'
import { defaultStart } from './utils'
import type { TabState } from './types'
import { TabPanel } from './components/TabPanel'

function App() {
  const [activeTab, setActiveTab] = useState(0)
  const [tabStates, setTabStates] = useState<TabState[]>(
    TABS.map(() => defaultStart()),
  )

  return (
    <div className="app">
      <header className="app-header">
        <h1>Sensor Data</h1>
      </header>
      <div className="tabs">
        {TABS.map((tab, i) => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === i ? 'active' : ''}`}
            onClick={() => setActiveTab(i)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <main className="tab-content">
        {TABS.map((tab, i) =>
          activeTab === i ? (
            <TabPanel
              key={tab.id}
              tab={tab}
              tabState={tabStates[i]}
              onTabStateChange={(s) => {
                const next = [...tabStates]
                next[i] = s
                setTabStates(next)
              }}
            />
          ) : null,
        )}
      </main>
    </div>
  )
}

export default App
