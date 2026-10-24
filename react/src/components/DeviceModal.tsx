import { useState, Fragment } from 'react'
import type { BleDevice, BluetoothDeviceMetadata } from '../types'

interface DeviceModalProps {
    device: BleDevice | null
    metadata: BluetoothDeviceMetadata | undefined
    onClose: () => void
    onSaveMetadata: (metadata: Partial<BluetoothDeviceMetadata>) => void
}

export function DeviceModal({
    device,
    metadata,
    onClose,
    onSaveMetadata,
}: Readonly<DeviceModalProps>) {
    const [noteDraft, setNoteDraft] = useState(metadata?.note ?? '')
    const [saving, setSaving] = useState(false)

    if (!device) return null

    const handleSaveMetadata = () => {
        setSaving(true)
        onSaveMetadata({
            name: device.name ?? null,
            note: noteDraft,
        })
        setSaving(false)
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            // Could add a toast notification here
        }).catch((err) => {
            console.error('Failed to copy:', err)
        })
    }

    const parseDetails = (details: string | null): Array<{ key: string; value: string }> => {
        if (!details) return []
        try {
            const rows: Array<{ key: string; value: string }> = []
            const walk = (prefix: string, val: unknown) => {
                if (Array.isArray(val)) {
                    rows.push({ key: prefix, value: val.map(String).join(', ') })
                } else if (val !== null && typeof val === 'object') {
                    for (const [k, v] of Object.entries(val)) walk(prefix ? `${prefix}.${k}` : k, v)
                } else {
                    rows.push({ key: prefix, value: String(val ?? '') })
                }
            }
            walk('', JSON.parse(details))
            return rows.filter(r => r.key)
        } catch {
            // Not JSON: fall back to "key: value" lines
        }
        const lines = details.split('\n').filter(line => line.trim())
        return lines.map(line => {
            const idx = line.indexOf(':')
            if (idx > 0) {
                return { key: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() }
            }
            // If no colon found, treat entire line as key with empty value
            return { key: line.trim(), value: '' }
        })
    }

    const allDetails = parseDetails(device.details)
    const nested = (name: string) => new RegExp(`^(.*\\.)?${name}(\\.|$)`, 'i')
    const serviceRe = nested('ServiceData')
    const manufacturerRe = nested('ManufacturerData')
    const isPropsRow = (key: string) => /^props(\.|$)/i.test(key)
    const isSubRow = (key: string) => serviceRe.test(key) || manufacturerRe.test(key)
    const strip = (rows: typeof allDetails, name: string) =>
        rows.map(a => ({
            ...a,
            key: a.key.replace(new RegExp(`^(.*\\.)?${name}\\.?`, 'i'), '') || name,
        }))
    const detailsAttributes = allDetails.filter(a => !isSubRow(a.key) && !isPropsRow(a.key))
    const propsAttributes = allDetails
        .filter(a => !isSubRow(a.key) && isPropsRow(a.key))
        .map(a => ({ ...a, key: a.key.replace(/^props\.?/i, '') || 'props' }))
    const serviceAttributes = strip(allDetails.filter(a => serviceRe.test(a.key)), 'ServiceData')
    const manufacturerAttributes = strip(allDetails.filter(a => manufacturerRe.test(a.key)), 'ManufacturerData')

    const renderAttributeRow = (
        label: string,
        value: string | null,
        isCopyable?: boolean
    ) => (
        <div className="attribute-row">
            <span className="attribute-label">
                {label}:
                <button
                    className="copy-button"
                    onClick={() => copyToClipboard(label)}
                    title="Copy name to clipboard"
                >
                    📋
                </button>
            </span>
            <span className="attribute-value">
                {value ?? '—'}
                {isCopyable && value && (
                    <button
                        className="copy-button"
                        onClick={() => copyToClipboard(value)}
                        title="Copy to clipboard"
                    >
                        📋
                    </button>
                )}
            </span>
        </div>
    )

    return (
        <div
            className="modal-overlay"
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
            onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px', boxSizing: 'border-box' }}
        >
            <div className="modal-dialog" role="dialog" aria-modal="true" style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', width: '100%', maxWidth: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)' }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">
                        {device.name ?? 'Unknown Device'}
                        {metadata && (
                            <span className="modal-updated">
                                {' '}
                                — last saved {new Date(metadata.updated_at).toLocaleString()}
                            </span>
                        )}
                    </h2>
                    <button
                        className="modal-close"
                        onClick={onClose}
                        aria-label="Close dialog"
                        style={{ background: 'none', border: 'none', color: 'var(--text)', fontSize: '1.5rem', cursor: 'pointer', padding: '4px 8px', lineHeight: '1' }}
                    >
                        ✕
                    </button>
                </div>

                <div className="modal-body">
                    {/* Device Details Section */}
                    <div className="section">
                        <h3 className="section-title">Device Details</h3>
                        <div className="attribute-list">
                            {renderAttributeRow('Address', device.address, true)}
                            {device.name && renderAttributeRow('Name', device.name, true)}
                            {detailsAttributes.length > 0 && detailsAttributes.map((attr, index) => (
                                <Fragment key={`${attr.key}-${index}`}>
                                    {attr.value && renderAttributeRow(attr.key, attr.value, true)}
                                    {!attr.value && renderAttributeRow(attr.key, '—')}
                                </Fragment>
                            ))}
                        </div>
                    </div>

                    {propsAttributes.length > 0 && (
                        <div className="section">
                            <h3 className="section-title">Properties</h3>
                            <div className="attribute-list">
                                {propsAttributes.map((attr, index) => (
                                    <Fragment key={`${attr.key}-${index}`}>
                                        {renderAttributeRow(attr.key, attr.value || null, true)}
                                    </Fragment>
                                ))}
                            </div>
                        </div>
                    )}

                    {serviceAttributes.length > 0 && (
                        <div className="section">
                            <h3 className="section-title">Service Data</h3>
                            <div className="attribute-list">
                                {serviceAttributes.map((attr, index) => (
                                    <Fragment key={`${attr.key}-${index}`}>
                                        {renderAttributeRow(attr.key, attr.value || null, true)}
                                    </Fragment>
                                ))}
                            </div>
                        </div>
                    )}

                    {manufacturerAttributes.length > 0 && (
                        <div className="section">
                            <h3 className="section-title">Manufacturer Data</h3>
                            <div className="attribute-list">
                                {manufacturerAttributes.map((attr, index) => (
                                    <Fragment key={`${attr.key}-${index}`}>
                                        {renderAttributeRow(attr.key, attr.value || null, true)}
                                    </Fragment>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Metadata Section */}
                    <div className="section">
                        <h3 className="section-title">Metadata</h3>
                        <textarea
                            className="metadata-note"
                            value={noteDraft}
                            placeholder="Add a note about this device (e.g. what it is, where you saw it)…"
                            onChange={(e) => setNoteDraft(e.target.value)}
                            rows={4}
                        />

                    </div>

                    {/* Device Information Section */}
                    <div className="section">
                        <h3 className="section-title">Additional Information</h3>
                        {metadata && renderAttributeRow('Last Updated', metadata.updated_at, true)}
                    </div>
                </div>

                <div className="modal-footer">
                    <button
                        className="secondary-button"
                        onClick={onClose}
                    >
                        Close
                    </button>
                    <button
                        className="save-metadata-button"
                        onClick={handleSaveMetadata}
                        disabled={saving}
                    >
                        {saving ? 'Saving…' : 'Save Metadata'}
                    </button>
                </div>
            </div>
        </div>
    )
}
