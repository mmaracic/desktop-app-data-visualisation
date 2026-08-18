import { useState } from 'react'
import type { PageConfig } from '../types'
import { DevicesTab } from '../components/DevicesTab'

const BLUETOOTH_TABS = [{ id: 'devices', label: 'Devices' }]

export function BluetoothPage({ page }: { page: PageConfig }) {
    const [activeTab, setActiveTab] = useState(0)

    return (
        <div className="page">
            <h2 className="page-title">{page.title}</h2>
            <div className="tabs">
                {BLUETOOTH_TABS.map((tab, i) => (
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
                {activeTab === 0 && <DevicesTab />}
            </div>
        </div>
    )
}
