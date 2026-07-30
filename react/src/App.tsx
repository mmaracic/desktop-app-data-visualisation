import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import * as d3 from 'd3'
import './App.css'

const CONTAINER_NAME = 'temperature-light-data-punat'

interface DataItem {
  id: string
  creation_date_time: string
  data: {
    internal_temperature: string
    light_voltage: string
    temperature_voltage: string
  }
}

interface TabConfig {
  id: string
  label: string
  description: string
  field: keyof DataItem['data']
  unit: string
}

const TABS: TabConfig[] = [
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

function parseValue(raw: string): number {
  return parseFloat(raw.split(' ')[0])
}

const pad = (n: number) => String(n).padStart(2, '0')

function toDateStr(date: Date): string {
  return (
    date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate())
  )
}

function toTimeStr(date: Date): string {
  return pad(date.getHours()) + ':' + pad(date.getMinutes())
}

function combineToISO(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString()
}

interface TabState {
  startDate: string
  startTime: string
  endDate: string
  endTime: string
}

function defaultStart(): TabState {
  const d = new Date()
  d.setHours(d.getHours() - 168)
  const now = new Date()
  return {
    startDate: toDateStr(d),
    startTime: toTimeStr(d),
    endDate: toDateStr(now),
    endTime: toTimeStr(now),
  }
}

interface Tooltip {
  x: number
  y: number
  date: Date
  value: number
}

function D3Chart({
  data,
  field,
  unit,
}: {
  data: DataItem[]
  field: keyof DataItem['data']
  unit: string
}) {
  const ref = useRef<SVGSVGElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [, setSize] = useState(0)
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)

  useEffect(() => {
    if (!wrapperRef.current) return
    const observer = new ResizeObserver(() => setSize((s) => s + 1))
    observer.observe(wrapperRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!ref.current) return
    const svg = d3.select(ref.current)
    svg.selectAll('*').remove()

    const margin = { top: 20, right: 30, bottom: 50, left: 60 }
    const width = ref.current.clientWidth - margin.left - margin.right
    const height = ref.current.clientHeight - margin.top - margin.bottom

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    const points = data
      .map((d) => ({
        date: new Date(d.creation_date_time),
        value: parseValue(d.data[field]),
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime())

    if (points.length === 0) {
      svg
        .append('text')
        .attr('x', ref.current.clientWidth / 2)
        .attr('y', ref.current.clientHeight / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', 'var(--text)')
        .text('No data for selected range')
      return
    }

    const x = d3
      .scaleTime()
      .domain(d3.extent(points, (d) => d.date) as [Date, Date])
      .range([0, width])

    const [minVal, maxVal] = d3.extent(points, (d) => d.value) as [number, number]
    const padding = (maxVal - minVal) * 0.1 || 0.5
    const y = d3
      .scaleLinear()
      .domain([minVal - padding, maxVal + padding])
      .range([height, 0])

    g.append('g')
      .attr('class', 'grid')
      .call(
        d3
          .axisLeft(y)
          .tickSize(-width)
          .tickFormat(() => ''),
      )

    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(6))
      .selectAll('text')
      .style('fill', 'var(--text)')

    g.append('g')
      .call(d3.axisLeft(y))
      .selectAll('text')
      .style('fill', 'var(--text)')

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -50)
      .attr('x', -height / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--text)')
      .style('font-size', '12px')
      .text(unit)

    const line = d3
      .line<{ date: Date; value: number }>()
      .x((d) => x(d.date))
      .y((d) => y(d.value))
      .curve(d3.curveMonotoneX)

    g.append('path')
      .datum(points)
      .attr('fill', 'none')
      .attr('stroke', 'var(--accent)')
      .attr('stroke-width', 2)
      .attr('d', line)

    g.selectAll('circle')
      .data(points)
      .join('circle')
      .attr('cx', (d) => x(d.date))
      .attr('cy', (d) => y(d.value))
      .attr('r', 5)
      .attr('fill', 'var(--accent)')
      .style('cursor', 'pointer')
      .on('mouseover', (event: MouseEvent, d) => {
        const rect = ref.current!.getBoundingClientRect()
        setTooltip({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          date: d.date,
          value: d.value,
        })
      })
      .on('mousemove', (event: MouseEvent, d) => {
        const rect = ref.current!.getBoundingClientRect()
        setTooltip({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
          date: d.date,
          value: d.value,
        })
      })
      .on('mouseout', () => setTooltip(null))
  }, [data, field, unit, setSize])

  return (
    <div ref={wrapperRef} style={{ width: '100%', position: 'relative' }}>
      <svg ref={ref} style={{ width: '100%', height: '400px', display: 'block' }} />
      {tooltip && (
        <div
          className="chart-tooltip"
          style={{ left: tooltip.x + 12, top: tooltip.y - 12 }}
        >
          <div>{tooltip.date.toLocaleString()}</div>
          <div>
            {tooltip.value} {unit}
          </div>
        </div>
      )}
    </div>
  )
}

function TabPanel({
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

function App() {
  const [activeTab, setActiveTab] = useState(0)
  const [tabStates, setTabStates] = useState<TabState[]>(
    TABS.map(() => defaultStart()),
  )

  return (
    <div className="app">
      <header className="app-header">
        <h1>Sensor Data</h1>
      </header>
      <div className="tabs">
        {TABS.map((tab, i) => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === i ? 'active' : ''}`}
            onClick={() => setActiveTab(i)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <main className="tab-content">
        {TABS.map((tab, i) =>
          activeTab === i ? (
            <TabPanel
              key={tab.id}
              tab={tab}
              tabState={tabStates[i]}
              onTabStateChange={(s) => {
                const next = [...tabStates]
                next[i] = s
                setTabStates(next)
              }}
            />
          ) : null,
        )}
      </main>
    </div>
  )
}

export default App
