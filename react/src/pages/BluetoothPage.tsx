import { useState } from 'react'
import type { BleDeviceInfo, PageConfig } from '../types'
import { DevicesTab } from '../components/DevicesTab'
import { DeviceInfoTab } from '../components/DeviceInfoTab'

const DEVICES_TAB_ID = 'devices'

export function BluetoothPage({ page }: { page: PageConfig }) {
    const [activeTabId, setActiveTabId] = useState(DEVICES_TAB_ID)
    const [deviceTabs, setDeviceTabs] = useState<BleDeviceInfo[]>([])

    const handlePaired = (info: BleDeviceInfo) => {
        setDeviceTabs((current) => [...current.filter((d) => d.address !== info.address), info])
        setActiveTabId(info.address)
    }

    const closeDeviceTab = (address: string) => {
        setDeviceTabs((current) => current.filter((d) => d.address !== address))
        setActiveTabId((current) => (current === address ? DEVICES_TAB_ID : current))
    }

    return (
        <div className="page">
            <h2 className="page-title">{page.title}</h2>
            <div className="tabs">
                <button
                    className={`tab-button ${activeTabId === DEVICES_TAB_ID ? 'active' : ''}`}
                    onClick={() => setActiveTabId(DEVICES_TAB_ID)}
                >
                    Devices
                </button>
                {deviceTabs.map((device) => (
                    <button
                        key={device.address}
                        className={`tab-button device-tab-button ${activeTabId === device.address ? 'active' : ''}`}
                        onClick={() => setActiveTabId(device.address)}
                    >
                        {device.address}
                        <span
                            className="tab-close"
                            role="button"
                            aria-label={`Close ${device.address}`}
                            onClick={(e) => {
                                e.stopPropagation()
                                closeDeviceTab(device.address)
                            }}
                        >
                            ×
                        </span>
                    </button>
                ))}
            </div>
            <div className="tab-content">
                {activeTabId === DEVICES_TAB_ID && <DevicesTab onPaired={handlePaired} />}
                {deviceTabs.map(
                    (device) =>
                        activeTabId === device.address && <DeviceInfoTab key={device.address} device={device} />,
                )}
            </div>
        </div>
    )
}
