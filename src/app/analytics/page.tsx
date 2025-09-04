'use client'

import { useState, useEffect } from 'react'

type TimeInterval = '5min' | '1hour' | '24hour'

export default function AnalyticsPage() {
  const [timeInterval, setTimeInterval] = useState<TimeInterval>('24hour')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<unknown>(null)

  useEffect(() => {
    fetchData()
  }, [timeInterval])

  const fetchData = async () => {
    setLoading(true)
    // TODO: Implement API calls
    console.log('Fetching data for interval:', timeInterval)
    console.log('Data state:', data)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Whale Analytics</h1>
        
        {/* Time Interval Selector */}
        <div className="flex gap-2 mb-8">
          <button
            onClick={() => setTimeInterval('5min')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              timeInterval === '5min' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            5 Minutes
          </button>
          <button
            onClick={() => setTimeInterval('1hour')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              timeInterval === '1hour' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            1 Hour
          </button>
          <button
            onClick={() => setTimeInterval('24hour')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              timeInterval === '24hour' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            24 Hours
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-lg text-gray-600">Loading whale data...</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top 10 Token Buys */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Top 10 Token Buys ({timeInterval})
              </h2>
              <div className="space-y-3">
                {/* TODO: Map through top buys */}
                <p className="text-gray-500">Data will be displayed here</p>
              </div>
            </div>

            {/* Top 10 Token Sells */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Top 10 Token Sells ({timeInterval})
              </h2>
              <div className="space-y-3">
                {/* TODO: Map through top sells */}
                <p className="text-gray-500">Data will be displayed here</p>
              </div>
            </div>

            {/* Transaction Count Chart */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Whale Transactions ({timeInterval})
              </h2>
              <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg">
                <p className="text-gray-500">Transaction count chart</p>
              </div>
            </div>

            {/* Buy/Sell Count Chart */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Buy vs Sell Transactions ({timeInterval})
              </h2>
              <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg">
                <p className="text-gray-500">Buy/Sell count chart</p>
              </div>
            </div>

            {/* Volume Chart */}
            <div className="bg-white rounded-xl shadow-sm p-6 lg:col-span-2">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Buy & Sell Volume - Log Scale ({timeInterval})
              </h2>
              <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg">
                <p className="text-gray-500">Volume chart with logarithmic scale</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}