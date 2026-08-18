import type { PageConfig, TabConfig } from './types'

export const CONTAINER_NAME = 'temperature-light-data-punat'

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
        tabs: TABS,
    },
]
