'use client'

import { useEffect, useState } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function Home() {
  const [swaps, setSwaps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSwaps = async () => {
      try {
        const response = await fetch('/api/swaps')
        if (!response.ok) {
          throw new Error('Failed to fetch swaps')
        }
        const data = await response.json()
        setSwaps(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data')
      } finally {
        setLoading(false)
      }
    }

    fetchSwaps()
  }, [])

  return (
    <div className="max-w-7xl p-8">
      <h1>Whale Swaps Data</h1>
      
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
      
      {!loading && !error && (
        <div>
          <p>Total swaps: {swaps.length}</p>
          <div className="max-h-screen overflow-y-auto">
            <pre>
              {JSON.stringify(swaps, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
