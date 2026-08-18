import { useState } from 'react'
import type { PageConfig, TabState } from '../types'
import { defaultStart } from '../utils'
import { TabPanel } from '../components/TabPanel'

export function LightTemperaturePage({ page }: { page: PageConfig }) {
    const [activeTab, setActiveTab] = useState(0)
    const [tabStates, setTabStates] = useState<TabState[]>(
        page.tabs.map(() => defaultStart()),
    )

    return (
        <div className="page">
            <h2 className="page-title">{page.title}</h2>
            <div className="tabs">
                {page.tabs.map((tab, i) => (
                    <button
                        key={tab.id}
                        className={`tab-button ${activeTab === i ? 'active' : ''}`}
                        onClick={() => setActiveTab(i)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            <div className="tab-content">
                {page.tabs.map((tab, i) =>
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
            </div>
        </div>
    )
}
