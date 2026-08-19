import { useState } from 'react'
import axios from 'axios'
import type { BleDevice, BleDeviceInfo } from '../types'

export function DevicesTab({ onPaired }: { onPaired: (info: BleDeviceInfo) => void }) {
    const [state, setState] = useState<{
        devices: BleDevice[]
        loading: boolean
        error: string | null
    }>({ devices: [], loading: false, error: null })
    const [selectedAddress, setSelectedAddress] = useState<string | null>(null)
    const [pairing, setPairing] = useState(false)
    const [pairError, setPairError] = useState<string | null>(null)

    const scan = () => {
        setState({ devices: [], loading: true, error: null })
        setSelectedAddress(null)
        setPairError(null)
        axios
            .get<BleDevice[]>('/api/bluetooth/ble_list')
            .then((r) => setState({ devices: r.data, loading: false, error: null }))
            .catch((e: Error) => setState({ devices: [], loading: false, error: e.message }))
    }

    const selectDevice = (address: string) => {
        setSelectedAddress((current) => (current === address ? null : address))
        setPairError(null)
    }

    const pair = () => {
        if (!selectedAddress) return
        setPairing(true)
        setPairError(null)
        axios
            .get<BleDeviceInfo>(`/api/bluetooth/device/${selectedAddress}`)
            .then((r) => {
                setPairing(false)
                onPaired(r.data)
            })
            .catch((e: Error) => {
                setPairing(false)
                setPairError(e.message)
            })
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
            <button className="pair-button" disabled={!selectedAddress || pairing} onClick={pair}>
                {pairing ? 'Pairing…' : 'Pair'}
            </button>
            {selectedAddress && <p className="selected-address">Selected: {selectedAddress}</p>}
            {pairError && <p className="status error">Pairing failed: {pairError}</p>}
        </div>
    )
}
