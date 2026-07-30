import { useEffect, useState } from 'react'
import axios from 'axios'
import type { DataItem, TabConfig, TabState } from '../types'
import { CONTAINER_NAME } from '../config'
import { combineToISO } from '../utils'
import { D3Chart } from './D3Chart'

export function TabPanel({
    tab,
    tabState,
    onTabStateChange,
}: {
    tab: TabConfig
    tabState: TabState
    onTabStateChange: (s: TabState) => void
}) {
    const [state, setState] = useState<{
        items: DataItem[]
        loading: boolean
        error: string | null
    }>({ items: [], loading: false, error: null })

    useEffect(() => {
        let cancelled = false
        setState({ items: [], loading: true, error: null })
        axios
            .get<DataItem[]>('/api/items', {
                params: {
                    start: combineToISO(tabState.startDate, tabState.startTime),
                    end: combineToISO(tabState.endDate, tabState.endTime),
                    container_name: CONTAINER_NAME,
                },
            })
            .then((r) => {
                if (!cancelled) setState({ items: r.data, loading: false, error: null })
            })
            .catch((e: Error) => {
                if (!cancelled) setState({ items: [], loading: false, error: e.message })
            })
        return () => {
            cancelled = true
        }
    }, [tabState.startDate, tabState.startTime, tabState.endDate, tabState.endTime])

    const { items, loading, error } = state

    return (
        <div className="tab-panel">
            <p className="tab-description">{tab.description}</p>
            <div className="date-controls">
                <fieldset className="date-group">
                    <legend>From</legend>
                    <input
                        type="date"
                        value={tabState.startDate}
                        onChange={(e) => onTabStateChange({ ...tabState, startDate: e.target.value })}
                    />
                    <input
                        type="time"
                        value={tabState.startTime}
                        onChange={(e) => onTabStateChange({ ...tabState, startTime: e.target.value })}
                    />
                </fieldset>
                <fieldset className="date-group">
                    <legend>To</legend>
                    <input
                        type="date"
                        value={tabState.endDate}
                        onChange={(e) => onTabStateChange({ ...tabState, endDate: e.target.value })}
                    />
                    <input
                        type="time"
                        value={tabState.endTime}
                        onChange={(e) => onTabStateChange({ ...tabState, endTime: e.target.value })}
                    />
                </fieldset>
            </div>
            {loading && <p className="status">Loading…</p>}
            {error && <p className="status error">Error: {error}</p>}
            {!loading && !error && (
                <D3Chart data={items} field={tab.field} unit={tab.unit} />
            )}
        </div>
    )
}
