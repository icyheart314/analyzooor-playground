'use client'

import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

interface ActivityData {
  timestamp: number
  time: string
  swaps: number
}

export default function ActivityPage() {
  const [activityData, setActivityData] = useState<ActivityData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchActivityData = async () => {
      try {
        const response = await fetch('/api/activity-data')
        if (!response.ok) {
          throw new Error('Failed to fetch activity data')
        }
        const data = await response.json()
        setActivityData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data')
      } finally {
        setLoading(false)
      }
    }

    fetchActivityData()
  }, [])

  const totalSwaps = activityData.reduce((sum, item) => sum + item.swaps, 0)
  const avgSwapsPerInterval = totalSwaps > 0 ? Math.round(totalSwaps / activityData.length) : 0
  const maxSwapsInInterval = Math.max(...activityData.map(item => item.swaps), 0)

  // Find hot hours (above average activity)
  const hotHours = activityData
    .filter(item => item.swaps > avgSwapsPerInterval * 1.5) // 50% above average = hot
    .sort((a, b) => b.swaps - a.swaps)
    .slice(0, 3) // Top 3 hot periods

  // Find quiet hours (below average activity)  
  const quietHours = activityData
    .filter(item => item.swaps < avgSwapsPerInterval * 0.5) // 50% below average = quiet
    .sort((a, b) => a.swaps - b.swaps)
    .slice(0, 3) // Top 3 quiet periods

  return (
    <div className="max-w-7xl p-8">
      <h1>Whale Activity - Last 24 Hours</h1>
      <p>Number of whale swaps every 15 minutes</p>
      
      {loading && <p>Loading activity data...</p>}
      {error && <p>Error: {error}</p>}
      
      {!loading && !error && (
        <div>
          <div>
            <div>
              <h3>Total Swaps</h3>
              <p>{totalSwaps.toLocaleString()}</p>
            </div>
            <div>
              <h3>Average per 15min</h3>
              <p>{avgSwapsPerInterval}</p>
            </div>
            <div>
              <h3>Peak Activity</h3>
              <p>{maxSwapsInInterval} swaps</p>
            </div>
          </div>

          <div>
            <div>
              <h3>🔥 Hot Hours (High Activity)</h3>
              {hotHours.length > 0 ? (
                <div>
                  {hotHours.map((hour, index) => (
                    <div key={hour.timestamp}>
                      <span>{hour.time}</span>
                      <span> - {hour.swaps} swaps</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No hot periods detected</p>
              )}
            </div>
            
            <div>
              <h3>😴 Quiet Hours (Low Activity)</h3>
              {quietHours.length > 0 ? (
                <div>
                  {quietHours.map((hour, index) => (
                    <div key={hour.timestamp}>
                      <span>{hour.time}</span>
                      <span> - {hour.swaps} swaps</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No quiet periods detected</p>
              )}
            </div>
          </div>

          {activityData.length > 0 ? (
            <div style={{ width: '100%', height: '400px' }}>
              <ResponsiveContainer>
                <LineChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="time" 
                    tick={{ fontSize: 12 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    label={{ value: 'Number of Swaps', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    labelFormatter={(label) => `Time: ${label}`}
                    formatter={(value: number, name) => {
                      const isHot = value > avgSwapsPerInterval * 1.5
                      const isQuiet = value < avgSwapsPerInterval * 0.5
                      let status = ''
                      if (isHot) status = ' 🔥 HOT'
                      else if (isQuiet) status = ' 😴 QUIET'
                      return [value + status, 'Swaps']
                    }}
                  />
                  {/* Average line reference */}
                  <ReferenceLine 
                    y={avgSwapsPerInterval} 
                    stroke="#9ca3af" 
                    strokeDasharray="5 5"
                    label={{ value: "Average", position: "topRight" }}
                  />
                  {/* Hot threshold line */}
                  <ReferenceLine 
                    y={avgSwapsPerInterval * 1.5} 
                    stroke="#ef4444" 
                    strokeDasharray="3 3"
                    label={{ value: "Hot Zone", position: "topRight" }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="swaps" 
                    stroke="#2563eb" 
                    strokeWidth={2}
                    dot={(props: any) => {
                      const { cx, cy, payload } = props
                      const isHot = payload.swaps > avgSwapsPerInterval * 1.5
                      const isQuiet = payload.swaps < avgSwapsPerInterval * 0.5
                      let fill = '#2563eb'
                      if (isHot) fill = '#ef4444' // Red for hot
                      else if (isQuiet) fill = '#6b7280' // Gray for quiet
                      return <circle key={payload.timestamp} cx={cx} cy={cy} r={3} fill={fill} strokeWidth={2} stroke={fill} />
                    }}
                    activeDot={{ r: 5, stroke: '#2563eb', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p>No activity data available for the last 24 hours</p>
          )}
        </div>
      )}
    </div>
  )
}