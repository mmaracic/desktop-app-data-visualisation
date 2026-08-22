import { useEffect, useRef, useState } from 'react'
import axios from 'axios'

interface CameraFrameResponse {
    image: string
    mask_image: string
    timestamp: string
}

function extractErrorMessage(e: unknown): string {
    if (axios.isAxiosError(e)) {
        const detail = e.response?.data?.detail
        if (typeof detail === 'string') return detail
    }
    return e instanceof Error ? e.message : String(e)
}

export function CameraFrame({ address }: { address: string }) {
    const [numRows, setNumRows] = useState(480)
    const [numCols, setNumCols] = useState(640)
    const [bytesPerPixel, setBytesPerPixel] = useState(3)
    const [period, setPeriod] = useState(60.0)
    const [autoFetch, setAutoFetch] = useState(true)
    const [collecting, setCollecting] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [frame, setFrame] = useState<CameraFrameResponse | null>(null)

    const fetchFrame = () => {
        setLoading(true)
        setError(null)
        axios
            .get<CameraFrameResponse>(`/api/bluetooth/camera/${address}/frame`)
            .then((r) => {
                setLoading(false)
                setFrame(r.data)
            })
            .catch((e: unknown) => {
                setLoading(false)
                setError(extractErrorMessage(e))
            })
    }

    const startCollecting = () => {
        setError(null)
        axios
            .post(`/api/bluetooth/camera/${address}/start`, null, {
                params: { num_rows: numRows, num_cols: numCols, bytes_per_pixel: bytesPerPixel },
            })
            .then(() => setCollecting(true))
            .catch((e: unknown) => setError(extractErrorMessage(e)))
    }

    const stopCollecting = () => {
        setError(null)
        axios
            .post(`/api/bluetooth/camera/${address}/stop`)
            .then(() => setCollecting(false))
            .catch((e: unknown) => setError(extractErrorMessage(e)))
    }

    const fetchFrameRef = useRef(fetchFrame)
    useEffect(() => {
        fetchFrameRef.current = fetchFrame
    })

    useEffect(() => {
        if (!autoFetch || period <= 0) return
        const id = setInterval(() => fetchFrameRef.current(), period * 1000)
        return () => clearInterval(id)
    }, [autoFetch, period])

    return (
        <div className="camera-frame-section">
            <h3 className="service-list-title">Camera</h3>
            <div className="camera-frame-controls">
                <label>
                    Rows{' '}
                    <input type="number" min={1} value={numRows} onChange={(e) => setNumRows(Number(e.target.value))} />
                </label>
                <label>
                    Cols{' '}
                    <input type="number" min={1} value={numCols} onChange={(e) => setNumCols(Number(e.target.value))} />
                </label>
                <label>
                    Bytes/px{' '}
                    <input
                        type="number"
                        min={1}
                        max={4}
                        value={bytesPerPixel}
                        onChange={(e) => setBytesPerPixel(Number(e.target.value))}
                    />
                </label>
                <label>
                    Auto-fetch period (s){' '}
                    <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={period}
                        onChange={(e) => setPeriod(Number(e.target.value))}
                    />
                </label>
                <label>
                    Auto-fetch{' '}
                    <input type="checkbox" checked={autoFetch} onChange={(e) => setAutoFetch(e.target.checked)} />
                </label>
                <button onClick={startCollecting} disabled={collecting}>
                    Start Collecting
                </button>
                <button onClick={stopCollecting} disabled={!collecting}>
                    Stop Collecting
                </button>
                <button onClick={fetchFrame} disabled={loading}>
                    {loading ? 'Fetching…' : 'Fetch Image'}
                </button>
            </div>
            {error && <p className="status error">Error: {error}</p>}
            {frame && (
                <>
                    <p className="status">Last fetched: {new Date(frame.timestamp).toLocaleString()}</p>
                    <div className="camera-frame-images">
                        <img className="camera-frame-image" src={`data:image/png;base64,${frame.image}`} alt="Camera frame" />
                        <img
                            className="camera-frame-image"
                            src={`data:image/png;base64,${frame.mask_image}`}
                            alt="Camera frame receipt mask"
                        />
                    </div>
                </>
            )}
        </div>
    )
}

