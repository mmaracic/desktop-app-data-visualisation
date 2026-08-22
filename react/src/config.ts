import type { PageConfig, TabConfig } from './types'

export const CONTAINER_NAME = 'temperature-light-data-punat'

// Matches CAMERA_SERVICE_UUID in src/api/camera.py
export const CAMERA_SERVICE_UUID = 'ba6a8c7b-a79d-4e66-b91e-2fe9f9e962ec'

export const DEFAULT_START_HOURS_AGO = 168

export const TABS: TabConfig[] = [
    {
        id: 'internal_temperature',
        label: 'Internal Temperature',
        description: 'Internal temperature of the device over time',
        field: 'internal_temperature',
        unit: '°C',
    },
    {
        id: 'light_voltage',
        label: 'Light Voltage',
        description: 'Light sensor voltage over time',
        field: 'light_voltage',
        unit: 'V',
    },
    {
        id: 'temperature_voltage',
        label: 'Temperature Voltage',
        description: 'Temperature sensor voltage over time',
        field: 'temperature_voltage',
        unit: 'V',
    },
]

export const PAGES: PageConfig[] = [
    {
        id: 'light-and-temperature',
        label: 'Light & Temperature',
        title: 'Light and Temperature',
        kind: 'charts',
        tabs: TABS,
    },
    {
        id: 'bluetooth',
        label: 'Bluetooth',
        title: 'Bluetooth',
        kind: 'bluetooth',
        tabs: [],
    },
]
