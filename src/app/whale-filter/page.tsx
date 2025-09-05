'use client'

import { useEffect, useState, useCallback } from 'react'

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
    priceUsd?: number
  }
  outputToken?: {
    mint: string
    amount: number
    symbol: string
    marketCap?: number
    pairCreatedAt?: number
    priceUsd?: number
  }
  usdValue?: number
}

export default function WhaleFilterPage() {
  const [filteredSwaps, setFilteredSwaps] = useState<FilteredSwap[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeFilter, setTimeFilter] = useState('ALL') // Time filter option
  const [marketCapFilter, setMarketCapFilter] = useState('ALL') // Market cap filter option
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

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

  const filterSwaps = useCallback(async (isAutoRefresh = false) => {
    try {
      if (isAutoRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
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
        
        // Check input token - always get market cap data
        if (swap.inputToken?.mint) {
          const marketCapData = await getMarketCapData(swap.inputToken.mint)
          if (marketCapData) {
            const pairAge = now - marketCapData.pairCreatedAt
            const marketCap = marketCapData.marketCap
            
            // Always store market cap data
            swap.inputToken.marketCap = marketCap
            swap.inputToken.pairCreatedAt = marketCapData.pairCreatedAt
            swap.inputToken.priceUsd = marketCapData.priceUsd
            usdValue += (swap.inputToken.amount || 0) * marketCapData.priceUsd
            
            // Check if this token passes filter
            const timeCondition = timeFilter === 'ALL' ? true : timeFilter === '>1W' ? pairAge > (7 * 24 * 60 * 60 * 1000) : pairAge <= (now - maxAge)
            const marketCapCondition = marketCapFilter === 'ALL' ? true : marketCapFilter === '>20mil' ? marketCap > 20000000 : marketCap <= maxMarketCapValue
            
            if (timeCondition && marketCapCondition && marketCap > 0) {
              passesFilter = true
            }
          }
        }
        
        // Check output token - always get market cap data
        if (swap.outputToken?.mint) {
          const marketCapData = await getMarketCapData(swap.outputToken.mint)
          if (marketCapData) {
            const pairAge = now - marketCapData.pairCreatedAt
            const marketCap = marketCapData.marketCap
            
            // Always store market cap data
            swap.outputToken.marketCap = marketCap
            swap.outputToken.pairCreatedAt = marketCapData.pairCreatedAt
            swap.outputToken.priceUsd = marketCapData.priceUsd
            usdValue += (swap.outputToken.amount || 0) * marketCapData.priceUsd
            
            // Check if this token passes filter
            const timeCondition = timeFilter === 'ALL' ? true : timeFilter === '>1W' ? pairAge > (7 * 24 * 60 * 60 * 1000) : pairAge <= (now - maxAge)
            const marketCapCondition = marketCapFilter === 'ALL' ? true : marketCapFilter === '>20mil' ? marketCap > 20000000 : marketCap <= maxMarketCapValue
            
            if (timeCondition && marketCapCondition && marketCap > 0) {
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
      setLastUpdate(new Date())
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to filter swaps')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [timeFilter, marketCapFilter])

  useEffect(() => {
    filterSwaps()
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(() => {
      console.log('Auto-refreshing whale filter...')
      filterSwaps(true)
    }, 30000)
    
    // Cleanup interval on component unmount or when filters change
    return () => clearInterval(interval)
  }, [timeFilter, marketCapFilter, filterSwaps])

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

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      alert(`${label} copied to clipboard!`)
    } catch (err) {
      console.error('Failed to copy:', err)
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = text
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      alert(`${label} copied to clipboard!`)
    }
  }

  return (
    <div className="max-w-7xl p-8">
      <div className="flex justify-between">
        <h1>Whale Filter - Fresh Low-Cap Gems</h1>
        <div>
          {refreshing && <span>Updating...</span>}
          {lastUpdate && !refreshing && (
            <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
          )}
        </div>
      </div>
      
      <div className="mb-8">
        <h2>Filter Settings</h2>
        
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label>
              Pair Created Time
            </label>
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
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
            <label>
              Market Cap
            </label>
            <select
              value={marketCapFilter}
              onChange={(e) => setMarketCapFilter(e.target.value)}
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
      
      {loading && <p>Filtering whale transactions on fresh gems...</p>}
      {error && <p>Error: {error}</p>}
      
      {!loading && !error && (
        <div>
          <p>
            Found {filteredSwaps.length} whale transactions on fresh low-cap tokens
          </p>
          
          {filteredSwaps.length > 0 ? (
            <div>
              {filteredSwaps.map((swap, index) => (
                <div key={swap.id}>
                  <div className="flex justify-between">
                    <div>
                      <h3>#{index + 1} Whale Transaction</h3>
                      <p>
                        {new Date(swap.timestamp).toLocaleString()} • {swap.source}
                      </p>
                    </div>
                    {swap.usdValue && (
                      <div>
                        <div>
                          ${swap.usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div>Total Volume</div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    {swap.inputToken && (
                      <div>
                        <div className="flex justify-between">
                          <div>SOLD</div>
                          <div>
                            {swap.inputToken.amount?.toLocaleString()} {swap.inputToken.symbol}
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex justify-between">
                            <span>Token:</span>
                            <span>{swap.inputToken.symbol || 'Unknown'}</span>
                          </div>
                          
                          {swap.inputToken.marketCap && (
                            <div className="flex justify-between">
                              <span>Market Cap:</span>
                              <span>{formatMarketCap(swap.inputToken.marketCap)}</span>
                            </div>
                          )}
                          
                          {swap.inputToken.pairCreatedAt && (
                            <div className="flex justify-between">
                              <span>Pair Age:</span>
                              <span>{formatTimeAgo(swap.inputToken.pairCreatedAt)}</span>
                            </div>
                          )}
                          
                          {swap.inputToken.priceUsd !== undefined && (
                            <div className="flex justify-between">
                              <span>Price:</span>
                              <span>
                                {swap.inputToken.priceUsd < 0.01 
                                  ? `$${swap.inputToken.priceUsd.toFixed(6)}` 
                                  : `$${swap.inputToken.priceUsd.toFixed(4)}`}
                              </span>
                            </div>
                          )}
                          
                          <div>
                            <button
                              onClick={() => copyToClipboard(swap.inputToken?.mint || '', 'Contract Address')}
                            >
                              CA: {swap.inputToken.mint?.slice(0, 8)}...{swap.inputToken.mint?.slice(-4)}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {swap.outputToken && (
                      <div>
                        <div className="flex justify-between">
                          <div>BOUGHT</div>
                          <div>
                            {swap.outputToken.amount?.toLocaleString()} {swap.outputToken.symbol}
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex justify-between">
                            <span>Token:</span>
                            <span>{swap.outputToken.symbol || 'Unknown'}</span>
                          </div>
                          
                          {swap.outputToken.marketCap && (
                            <div className="flex justify-between">
                              <span>Market Cap:</span>
                              <span>{formatMarketCap(swap.outputToken.marketCap)}</span>
                            </div>
                          )}
                          
                          {swap.outputToken.pairCreatedAt && (
                            <div className="flex justify-between">
                              <span>Pair Age:</span>
                              <span>{formatTimeAgo(swap.outputToken.pairCreatedAt)}</span>
                            </div>
                          )}
                          
                          {swap.outputToken.priceUsd !== undefined && (
                            <div className="flex justify-between">
                              <span>Price:</span>
                              <span>
                                {swap.outputToken.priceUsd < 0.01 
                                  ? `$${swap.outputToken.priceUsd.toFixed(6)}` 
                                  : `$${swap.outputToken.priceUsd.toFixed(4)}`}
                              </span>
                            </div>
                          )}
                          
                          <div>
                            <button
                              onClick={() => copyToClipboard(swap.outputToken?.mint || '', 'Contract Address')}
                            >
                              CA: {swap.outputToken.mint?.slice(0, 8)}...{swap.outputToken.mint?.slice(-4)}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span>Signature:</span>
                        <button
                          onClick={() => copyToClipboard(swap.signature, 'Transaction Signature')}
                        >
                          {swap.signature.slice(0, 12)}...{swap.signature.slice(-4)}
                        </button>
                      </div>
                      
                      <div>
                        <span>Whale:</span>
                        <button
                          onClick={() => copyToClipboard(swap.feePayer, 'Whale Address')}
                        >
                          {swap.feePayer.slice(0, 8)}...{swap.feePayer.slice(-4)}
                        </button>
                      </div>
                    </div>
                    
                    {swap.description && (
                      <div>
                        <strong>Description:</strong> {swap.description}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>
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