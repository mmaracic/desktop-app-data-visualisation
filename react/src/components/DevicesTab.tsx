import { useEffect, useState } from 'react'
import axios from 'axios'
import type { BleDevice, BleDeviceInfo, BluetoothDeviceMetadata } from '../types'
import { DeviceModal } from './DeviceModal'

export function DevicesTab({ onPaired }: { readonly onPaired: (info: BleDeviceInfo) => void }) {
    const [state, setState] = useState<{
        devices: BleDevice[]
        loading: boolean
        error: string | null
    }>({ devices: [], loading: false, error: null })
    const [metadataByAddress, setMetadataByAddress] = useState<Record<string, BluetoothDeviceMetadata>>({})
    const [selectedDevice, setSelectedDevice] = useState<BleDevice | null>(null)
    const [selectedMetadata, setSelectedMetadata] = useState<BluetoothDeviceMetadata | undefined>(undefined)
    const [pairing, setPairing] = useState(false)
    const [showModal, setShowModal] = useState(false)
    const [pairError, setPairError] = useState<string | null>(null)

    const loadMetadata = () => {
        axios
            .get<BluetoothDeviceMetadata[]>('/api/bluetooth/metadata')
            .then((r) => {
                const byAddress: Record<string, BluetoothDeviceMetadata> = {}
                for (const entry of r.data) byAddress[entry.address] = entry
                setMetadataByAddress(byAddress)
            })
            .catch(() => setMetadataByAddress({}))
    }

    useEffect(() => {
        loadMetadata()
    }, [])

    const scan = () => {
        setState({ devices: [], loading: true, error: null })
        setSelectedDevice(null)
        setPairError(null)
        setShowModal(false)
        axios
            .get<BleDevice[]>('/api/bluetooth/ble_list')
            .then((r) => {
                setState({ devices: r.data, loading: false, error: null })
                loadMetadata()
            })
            .catch((e: Error) => setState({ devices: [], loading: false, error: e.message }))
    }

    const selectDevice = (device: BleDevice) => {
        setSelectedDevice(device)
        setSelectedMetadata(metadataByAddress[device.address] ?? undefined)
        setPairError(null)
    }

    const closeDeviceModal = () => {
        setSelectedDevice(null)
        setSelectedMetadata(undefined)
        setShowModal(false)
        setPairError(null)
    }


    const pair = () => {
        if (!selectedDevice) return
        setPairing(true)
        setPairError(null)
        axios
            .get<BleDeviceInfo>(`/api/bluetooth/device/${selectedDevice.address}`)
            .then((r) => {
                setPairing(false)
                onPaired(r.data)
            })
            .catch((e: Error) => {
                setPairing(false)
                setPairError(e.message)
            })
    }

    const saveMetadata = (metadata: Partial<BluetoothDeviceMetadata>) => {
        if (!selectedDevice) return
        axios
            .post<BluetoothDeviceMetadata>(`/api/bluetooth/metadata/${selectedDevice.address}`, {
                name: metadata.name ?? selectedDevice.name ?? null,
                note: metadata.note ?? '',
            })
            .then((r) => {
                setSelectedMetadata(r.data)
                setMetadataByAddress((current) => ({ ...current, [r.data.address]: r.data }))
                setShowModal(false)
            })
            .catch((e: Error) => {
                console.error('Failed to save metadata', e.message)
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
                    <li key={device.address} className={`device-item ${selectedDevice?.address === device.address ? 'selected' : ''}`}>
                        <button
                            className="device-item-button"
                            onClick={() => selectDevice(device)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    selectDevice(device)
                                }
                            }}
                        >
                            <span className="device-name">{device.name ?? 'Unknown'}</span>
                            <span className="device-address">{device.address}</span>
                            <span className="device-note">
                                {metadataByAddress[device.address]?.note || '-'}
                            </span>
                            <span className="device-updated">
                                {metadataByAddress[device.address]?.updated_at ? new Date(metadataByAddress[device.address].updated_at).toLocaleString() : '-'}
                            </span>
                        </button>
                    </li>
                ))}
            </ul>
            {showModal && selectedDevice && (
                <DeviceModal
                    device={selectedDevice}
                    metadata={selectedMetadata}
                    onClose={closeDeviceModal}
                    onSaveMetadata={saveMetadata}
                />
            )}
            <button className="view-details-button" onClick={() => setShowModal(true)} disabled={!selectedDevice && !showModal}>
                Show Details
            </button>
            {selectedDevice && !showModal && (
                <button className="pair-button" onClick={pair} disabled={pairing}>
                    {pairing ? 'Pairing…' : 'Pair Device'}
                </button>
            )}
            {pairError && <p className="status error">Pairing failed: {pairError}</p>}
        </div>
    )
}
