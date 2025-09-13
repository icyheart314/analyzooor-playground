'use client'

import { useEffect, useState } from 'react'

interface WhaleProfitData {
  tokenSymbol: string
  tokenAddress: string
  transactionTime: number
  buyPrice: number
  peakPrice: number
  profitPercent: number
  marketCap: number
  signature: string
}

export default function TopWhaleProfits() {
  const [profits, setProfits] = useState<WhaleProfitData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchProfits = async () => {
      try {
        const response = await fetch('/api/top-whale-profits')
        if (!response.ok) {
          throw new Error('Failed to fetch whale profits')
        }
        const data = await response.json()
        setProfits(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data')
      } finally {
        setLoading(false)
      }
    }

    fetchProfits()
  }, [])

  const formatPrice = (price: number) => {
    if (price >= 1) {
      return price.toFixed(4)
    } else if (price >= 0.01) {
      return price.toFixed(6)
    } else if (price >= 0.00001) {
      return price.toFixed(8)
    } else {
      // For very small numbers, use scientific notation but make it cleaner
      return price.toExponential(2)
    }
  }

  const formatMarketCap = (marketCap: number) => {
    if (marketCap >= 1e9) return `$${(marketCap / 1e9).toFixed(2)}B`
    if (marketCap >= 1e6) return `$${(marketCap / 1e6).toFixed(2)}M`
    if (marketCap >= 1e3) return `$${(marketCap / 1e3).toFixed(2)}K`
    return `$${marketCap.toFixed(2)}`
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  return (
    <div className="max-w-7xl p-8">
      <h1>Top 10 Whale Calls - Biggest Profit Last 24h</h1>
      
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
      
      {!loading && !error && (
        <div>
          {profits.length === 0 ? (
            <p>No profitable whale calls found in the last 24 hours</p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border p-2 text-left">Rank</th>
                  <th className="border p-2 text-left">Token</th>
                  <th className="border p-2 text-left">Contract Address</th>
                  <th className="border p-2 text-left">Purchase Time</th>
                  <th className="border p-2 text-left">Buy Price</th>
                  <th className="border p-2 text-left">Current Price</th>
                  <th className="border p-2 text-left">Profit %</th>
                  <th className="border p-2 text-left">Market Cap</th>
                  <th className="border p-2 text-left">Buy Tx</th>
                </tr>
              </thead>
              <tbody>
                {profits.map((profit, index) => (
                  <tr key={profit.signature} className="hover:bg-gray-50">
                    <td className="border p-2">{index + 1}</td>
                    <td className="border p-2">
                      <a 
                        href={`https://dexscreener.com/solana/${profit.tokenAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline"
                      >
                        {profit.tokenSymbol}
                      </a>
                    </td>
                    <td className="border p-2 font-mono text-sm">
                      <button 
                        onClick={() => navigator.clipboard.writeText(profit.tokenAddress)}
                        className="hover:bg-gray-200 p-1 rounded"
                        title="Click to copy"
                      >
                        {profit.tokenAddress.slice(0, 8)}...{profit.tokenAddress.slice(-8)}
                      </button>
                    </td>
                    <td className="border p-2">{formatTime(profit.transactionTime)}</td>
                    <td className="border p-2">${formatPrice(profit.buyPrice)}</td>
                    <td className="border p-2">${formatPrice(profit.peakPrice)}</td>
                    <td className="border p-2 font-bold" style={{color: profit.profitPercent > 0 ? 'green' : 'red'}}>
                      {profit.profitPercent.toFixed(2)}%
                    </td>
                    <td className="border p-2">{formatMarketCap(profit.marketCap)}</td>
                    <td className="border p-2">
                      <a 
                        href={`https://solscan.io/tx/${profit.signature}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline"
                      >
                        {profit.signature.slice(0, 8)}...
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}