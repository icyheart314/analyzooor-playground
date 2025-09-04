import { useState, useEffect } from 'react'
import { whaleooorClient, TimeIntervalData } from '@/lib/whaleooor-client'

// Since we only have 60 minutes of data, adjust intervals accordingly
export function useWhaleData(timeInterval: '5min' | '1hour' | '24hour') {
  const [data, setData] = useState<TimeIntervalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // For now, since we only have 60 mins of data:
        // - 5min: show last 5 minutes
        // - 1hour: show all 60 minutes
        // - 24hour: show all available data (60 minutes) with a note
        
        const effectiveInterval = timeInterval === '24hour' ? '1hour' : timeInterval
        const analyticsData = await whaleooorClient.getAnalyticsData(effectiveInterval)
        
        setData(analyticsData)
      } catch (err) {
        console.error('Error fetching whale data:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    
    // Refresh data every 30 seconds for real-time updates
    const interval = setInterval(fetchData, 30000)
    
    return () => clearInterval(interval)
  }, [timeInterval])

  return { data, loading, error, limitedTo60Min: timeInterval === '24hour' }
}