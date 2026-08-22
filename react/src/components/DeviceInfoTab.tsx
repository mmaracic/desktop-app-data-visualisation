import type { BleDeviceInfo } from '../types'
import { CAMERA_SERVICE_UUID } from '../config'
import { CameraFrame } from './CameraFrame'

export function DeviceInfoTab({ device }: { device: BleDeviceInfo }) {
    const isCamera = device.services.some((service) => service.uuid.toLowerCase() === CAMERA_SERVICE_UUID)

    return (
        <div className="tab-panel">
            <p className="device-info-row">
                <span className="device-info-label">Name:</span> {device.name ?? 'Unknown'}
            </p>
            <p className="device-info-row">
                <span className="device-info-label">Address:</span> {device.address}
            </p>
            <h3 className="service-list-title">Services</h3>
            <div className="service-list">
                {device.services.map((service) => (
                    <div key={service.uuid} className="service-item">
                        <p className="service-title">
                            <span className="field-label">Service:</span> {service.description || service.uuid}
                        </p>
                        <p className="service-uuid">
                            <span className="field-label">UUID:</span> {service.uuid}
                        </p>
                        <ul className="characteristic-list">
                            {service.characteristics.map((characteristic) => (
                                <li key={characteristic.uuid} className="characteristic-item">
                                    <span className="characteristic-field">
                                        <span className="field-label">Characteristic:</span>{' '}
                                        {characteristic.description || characteristic.uuid}
                                    </span>
                                    <span className="characteristic-field characteristic-uuid">
                                        <span className="field-label">UUID:</span> {characteristic.uuid}
                                    </span>
                                    <span className="characteristic-field characteristic-properties">
                                        <span className="field-label">Properties:</span>{' '}
                                        {characteristic.properties.join(', ')}
                                    </span>
                                    <span className="characteristic-field characteristic-value">
                                        <span className="field-label">Value:</span>{' '}
                                        {characteristic.value ?? 'N/A'}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
            {isCamera && <CameraFrame address={device.address} />}
        </div>
    )
}
