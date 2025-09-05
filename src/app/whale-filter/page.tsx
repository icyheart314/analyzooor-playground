'use client'

import { useEffect, useState } from 'react'

interface FilteredSwap {
  id: string
  timestamp: number
  feePayer: string
  source: string
  signature: string
  description: string
  whaleAsset: string
  whaleSymbol: string
  inputToken?: {
    mint: string
    amount: number
    symbol: string
    marketCap?: number
    pairCreatedAt?: number
  }
  outputToken?: {
    mint: string
    amount: number
    symbol: string
    marketCap?: number
    pairCreatedAt?: number
  }
  usdValue?: number
}

export default function WhaleFilterPage() {
  const [filteredSwaps, setFilteredSwaps] = useState<FilteredSwap[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeFilter, setTimeFilter] = useState('<1D') // Time filter option
  const [marketCapFilter, setMarketCapFilter] = useState('<1mil') // Market cap filter option

  const getMarketCapData = async (mint: string) => {
    try {
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`)
      
      if (!response.ok) {
        return null
      }
      
      const data = await response.json()
      
      if (data.pairs && data.pairs.length > 0) {
        const pair = data.pairs[0]
        return {
          marketCap: pair.fdv || pair.marketCap || 0,
          pairCreatedAt: pair.pairCreatedAt || 0,
          priceUsd: parseFloat(pair.priceUsd) || 0
        }
      }
      
      return null
    } catch (error) {
      console.log(`Could not fetch market cap for ${mint}:`, error)
      return null
    }
  }

  const getTimeFilterValue = (filter: string) => {
    const now = Date.now()
    switch (filter) {
      case '<1H': return now - (1 * 60 * 60 * 1000)
      case '<4H': return now - (4 * 60 * 60 * 1000) 
      case '<12H': return now - (12 * 60 * 60 * 1000)
      case '<1D': return now - (24 * 60 * 60 * 1000)
      case '<3D': return now - (3 * 24 * 60 * 60 * 1000)
      case '<1W': return now - (7 * 24 * 60 * 60 * 1000)
      case '>1W': return 0 // Show everything older than 1 week
      case 'ALL': return 0 // Show all periods
      default: return now - (24 * 60 * 60 * 1000)
    }
  }

  const getMarketCapValue = (filter: string) => {
    switch (filter) {
      case '<100k': return 100000
      case '<300k': return 300000
      case '<500k': return 500000
      case '<1mil': return 1000000
      case '<3mil': return 3000000
      case '<5mil': return 5000000
      case '<10mil': return 10000000
      case '<20mil': return 20000000
      case '>20mil': return Infinity
      case 'ALL': return Infinity
      default: return 1000000
    }
  }

  const filterSwaps = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Fetch recent swaps from database
      const response = await fetch('/api/database-swaps')
      if (!response.ok) {
        throw new Error('Failed to fetch swaps')
      }
      
      const swaps = await response.json()
      const now = Date.now()
      const maxAge = getTimeFilterValue(timeFilter)
      const maxMarketCapValue = getMarketCapValue(marketCapFilter)
      
      const filtered: FilteredSwap[] = []
      
      for (const swap of swaps.slice(0, 50)) { // Process first 50 to avoid rate limits
        let passesFilter = false
        let usdValue = 0
        
        // Check input token
        if (swap.inputToken?.mint) {
          const marketCapData = await getMarketCapData(swap.inputToken.mint)
          if (marketCapData) {
            const pairAge = now - marketCapData.pairCreatedAt
            const marketCap = marketCapData.marketCap
            
            const timeCondition = timeFilter === 'ALL' ? true : timeFilter === '>1W' ? pairAge > (7 * 24 * 60 * 60 * 1000) : pairAge <= (now - maxAge)
            const marketCapCondition = marketCapFilter === 'ALL' ? true : marketCapFilter === '>20mil' ? marketCap > 20000000 : marketCap <= maxMarketCapValue
            
            if (timeCondition && marketCapCondition && marketCap > 0) {
              swap.inputToken.marketCap = marketCap
              swap.inputToken.pairCreatedAt = marketCapData.pairCreatedAt
              usdValue += (swap.inputToken.amount || 0) * marketCapData.priceUsd
              passesFilter = true
            }
          }
        }
        
        // Check output token
        if (swap.outputToken?.mint) {
          const marketCapData = await getMarketCapData(swap.outputToken.mint)
          if (marketCapData) {
            const pairAge = now - marketCapData.pairCreatedAt
            const marketCap = marketCapData.marketCap
            
            const timeCondition = timeFilter === 'ALL' ? true : timeFilter === '>1W' ? pairAge > (7 * 24 * 60 * 60 * 1000) : pairAge <= (now - maxAge)
            const marketCapCondition = marketCapFilter === 'ALL' ? true : marketCapFilter === '>20mil' ? marketCap > 20000000 : marketCap <= maxMarketCapValue
            
            if (timeCondition && marketCapCondition && marketCap > 0) {
              swap.outputToken.marketCap = marketCap
              swap.outputToken.pairCreatedAt = marketCapData.pairCreatedAt
              usdValue += (swap.outputToken.amount || 0) * marketCapData.priceUsd
              passesFilter = true
            }
          }
        }
        
        if (passesFilter) {
          swap.usdValue = usdValue
          filtered.push(swap)
        }
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      
      // Sort by USD value descending
      filtered.sort((a, b) => (b.usdValue || 0) - (a.usdValue || 0))
      setFilteredSwaps(filtered)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to filter swaps')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    filterSwaps()
  }, [timeFilter, marketCapFilter])

  const formatMarketCap = (marketCap?: number) => {
    if (!marketCap) return 'Unknown'
    if (marketCap >= 1000000) {
      return `$${(marketCap / 1000000).toFixed(2)}M`
    }
    return `$${(marketCap / 1000).toFixed(0)}K`
  }

  const formatTimeAgo = (timestamp?: number) => {
    if (!timestamp) return 'Unknown'
    const hours = (Date.now() - timestamp) / (1000 * 60 * 60)
    if (hours < 1) {
      return `${Math.floor(hours * 60)}m ago`
    }
    return `${Math.floor(hours)}h ago`
  }

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-4">🐋 Whale Filter - Fresh Low-Cap Gems</h1>
      
      {/* Filter Controls */}
      <div className="mb-8 bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Filter Settings</h2>
        
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">
              Pair Created Time
            </label>
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="<1H">Less than 1 hour ago</option>
              <option value="<4H">Less than 4 hours ago</option>
              <option value="<12H">Less than 12 hours ago</option>
              <option value="<1D">Less than 1 day ago</option>
              <option value="<3D">Less than 3 days ago</option>
              <option value="<1W">Less than 1 week ago</option>
              <option value=">1W">More than 1 week ago</option>
              <option value="ALL">All periods</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">
              Market Cap
            </label>
            <select
              value={marketCapFilter}
              onChange={(e) => setMarketCapFilter(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="<100k">Less than $100K</option>
              <option value="<300k">Less than $300K</option>
              <option value="<500k">Less than $500K</option>
              <option value="<1mil">Less than $1M</option>
              <option value="<3mil">Less than $3M</option>
              <option value="<5mil">Less than $5M</option>
              <option value="<10mil">Less than $10M</option>
              <option value="<20mil">Less than $20M</option>
              <option value=">20mil">More than $20M</option>
              <option value="ALL">All market caps</option>
            </select>
          </div>
        </div>
      </div>
      
      {loading && <p>🔍 Filtering whale transactions on fresh gems...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}
      
      {!loading && !error && (
        <div className="space-y-4">
          <p className="text-lg font-medium">
            Found {filteredSwaps.length} whale transactions on fresh low-cap tokens
          </p>
          
          {filteredSwaps.length > 0 ? (
            <div className="space-y-4">
              {filteredSwaps.map((swap, index) => (
                <div key={swap.id} className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">#{index + 1} Whale Transaction</h3>
                      <p className="text-sm text-gray-500">
                        {new Date(swap.timestamp).toLocaleString()} • {swap.source}
                      </p>
                    </div>
                    {swap.usdValue && (
                      <div className="text-right">
                        <div className="text-xl font-bold text-green-600">
                          ${swap.usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {swap.inputToken?.marketCap && (
                      <div className="bg-red-50 p-3 rounded border-l-2 border-red-400">
                        <div className="text-sm font-medium text-red-700">SOLD</div>
                        <div className="font-semibold">{swap.inputToken.symbol}</div>
                        <div className="text-sm">MC: {formatMarketCap(swap.inputToken.marketCap)}</div>
                        <div className="text-xs text-gray-500">
                          Pair: {formatTimeAgo(swap.inputToken.pairCreatedAt)}
                        </div>
                      </div>
                    )}
                    
                    {swap.outputToken?.marketCap && (
                      <div className="bg-green-50 p-3 rounded border-l-2 border-green-400">
                        <div className="text-sm font-medium text-green-700">BOUGHT</div>
                        <div className="font-semibold">{swap.outputToken.symbol}</div>
                        <div className="text-sm">MC: {formatMarketCap(swap.outputToken.marketCap)}</div>
                        <div className="text-xs text-gray-500">
                          Pair: {formatTimeAgo(swap.outputToken.pairCreatedAt)}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-sm text-gray-600">
                    <p>{swap.description}</p>
                    <p className="font-mono text-xs mt-2">{swap.signature.slice(0, 20)}...</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No whale transactions found for tokens with:</p>
              <p>• Pair created: {timeFilter.replace('<', 'Less than ').replace('>', 'More than ').replace('H', ' hour').replace('D', ' day').replace('W', ' week')} ago</p>
              <p>• Market cap: {marketCapFilter.replace('<', 'Less than $').replace('>', 'More than $').replace('k', 'K').replace('mil', 'M')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}