export interface DataItem {
    id: string
    creation_date_time: string
    data: {
        internal_temperature: string
        light_voltage: string
        temperature_voltage: string
    }
}

export interface TabConfig {
    id: string
    label: string
    description: string
    field: keyof DataItem['data']
    unit: string
}

export interface PageConfig {
    id: string
    label: string
    title: string
    kind: 'charts' | 'bluetooth'
    tabs: TabConfig[]
}

export interface BleDevice {
    address: string
    name: string | null
    details: string
}

export interface BleCharacteristic {
    uuid: string
    description: string
    properties: string[]
    value: string | null
}

export interface BleService {
    uuid: string
    description: string
    characteristics: BleCharacteristic[]
}

export interface BleDeviceInfo {
    name: string | null
    address: string
    services: BleService[]
}

export interface TabState {
    startDate: string
    startTime: string
    endDate: string
    endTime: string
}

export interface Tooltip {
    x: number
    y: number
    date: Date
    value: number
}
