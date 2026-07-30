import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { DataItem, Tooltip } from '../types'
import { parseValue } from '../utils'

export function D3Chart({
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
