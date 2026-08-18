import { useState } from 'react'
import axios from 'axios'
import type { BleDevice } from '../types'

export function DevicesTab() {
    const [state, setState] = useState<{
        devices: BleDevice[]
        loading: boolean
        error: string | null
    }>({ devices: [], loading: false, error: null })
    const [selectedAddress, setSelectedAddress] = useState<string | null>(null)

    const scan = () => {
        setState({ devices: [], loading: true, error: null })
        setSelectedAddress(null)
        axios
            .get<BleDevice[]>('/api/bluetooth/ble_list')
            .then((r) => setState({ devices: r.data, loading: false, error: null }))
            .catch((e: Error) => setState({ devices: [], loading: false, error: e.message }))
    }

    const selectDevice = (address: string) => {
        setSelectedAddress((current) => (current === address ? null : address))
    }

    const { devices, loading, error } = state

    return (
        <div className="tab-panel">
            <button className="scan-button" onClick={scan} disabled={loading}>
                {loading ? 'Scanning…' : 'Scan'}
            </button>
            {error && <p className="status error">Error: {error}</p>}
            <ul className="device-list">
                {devices.map((device) => (
                    <li
                        key={device.address}
                        className={`device-item ${selectedAddress === device.address ? 'selected' : ''}`}
                        onClick={() => selectDevice(device.address)}
                    >
                        <span className="device-name">{device.name ?? 'Unknown'}</span>
                        <span className="device-address">{device.address}</span>
                        <span className="device-details">{device.details}</span>
                    </li>
                ))}
            </ul>
            <button className="pair-button" disabled={!selectedAddress}>
                Pair
            </button>
            {selectedAddress && <p className="selected-address">Selected: {selectedAddress}</p>}
        </div>
    )
}
