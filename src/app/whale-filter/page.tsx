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
  const [maxHours, setMaxHours] = useState(24) // Max hours since pair created
  const [maxMarketCap, setMaxMarketCap] = useState(10) // Max market cap in millions

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
      const maxAge = maxHours * 60 * 60 * 1000
      const maxMarketCapValue = maxMarketCap * 1000000 // Convert to actual value
      
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
            
            if (pairAge <= maxAge && marketCap <= maxMarketCapValue && marketCap > 0) {
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
            
            if (pairAge <= maxAge && marketCap <= maxMarketCapValue && marketCap > 0) {
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
  }, [maxHours, maxMarketCap])

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
              Max Hours Since Pair Created: {maxHours}h
            </label>
            <input
              type="range"
              min="1"
              max="168"
              value={maxHours}
              onChange={(e) => setMaxHours(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1h</span>
              <span>1 week</span>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">
              Max Market Cap: ${maxMarketCap}M
            </label>
            <input
              type="range"
              min="0.1"
              max="100"
              step="0.1"
              value={maxMarketCap}
              onChange={(e) => setMaxMarketCap(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>$100K</span>
              <span>$100M</span>
            </div>
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
              <p>• Created within {maxHours} hours</p>
              <p>• Market cap below ${maxMarketCap}M</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}