'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { getTokenSymbol } from '@/lib/token-symbols'

interface TokenInflow {
  symbol: string
  mint: string
  netInflow: number
  netInflowUSD: number
  swapCount: number
  price: number
  uniqueWhales: number
  marketCap: number
  priceChange24h: number
}

interface SwapData {
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
    metadata: {
      symbol: string
    }
  }
  outputToken?: {
    mint: string
    amount: number
    metadata: {
      symbol: string
    }
  }
}

// Token data cache with 5-minute expiry
const priceCache = new Map<string, { price: number, marketCap: number, priceChange24h: number, timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export default function TokenInflowsPage() {
  const [swaps, setSwaps] = useState<SwapData[]>([])
  const [topInflows, setTopInflows] = useState<TokenInflow[]>([])
  const [topOutflows, setTopOutflows] = useState<TokenInflow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState('1H')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [inflowSortBy, setInflowSortBy] = useState<'swaps' | 'uniqueWhales' | 'netInflow' | 'netInflowUSD' | 'price' | 'marketCap' | 'priceChange24h'>('netInflowUSD')
  const [inflowSortDesc, setInflowSortDesc] = useState(true)
  const [outflowSortBy, setOutflowSortBy] = useState<'swaps' | 'uniqueWhales' | 'netInflow' | 'netInflowUSD' | 'price' | 'marketCap' | 'priceChange24h'>('netInflowUSD')
  const [outflowSortDesc, setOutflowSortDesc] = useState(true)
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const getCoinGeckoData = async (symbol: string): Promise<{ price: number, marketCap: number, priceChange24h: number } | null> => {
    // CoinGecko IDs for major tokens
    const geckoIds: { [key: string]: string } = {
      'SOL': 'solana',
      'USDC': 'usd-coin', 
      'USDT': 'tether',
      'BTC': 'bitcoin',
      'ETH': 'ethereum'
    }
    
    const geckoId = geckoIds[symbol.toUpperCase()]
    if (!geckoId) return null
    
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000)
      
      const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${geckoId}&vs_currencies=usd&include_market_cap=true&include_24hr_change=true`, {
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) return null
      
      const data = await response.json()
      const coinData = data[geckoId]
      
      if (coinData) {
        let price = coinData.usd || 0
        let marketCap = coinData.usd_market_cap || 0
        let priceChange24h = coinData.usd_24h_change || 0
        
        // For SOL, calculate market cap using your provided circulating supply if needed
        if (symbol.toUpperCase() === 'SOL' && price > 0 && !marketCap) {
          marketCap = price * 541.2 * 1000000 // 541.2M circulating supply
        }
        
        return {
          price,
          marketCap,
          priceChange24h
        }
      }
      
      return null
    } catch (error) {
      return null
    }
  }

  const getTokenData = async (mint: string, symbol: string): Promise<{ price: number, marketCap: number, priceChange24h: number }> => {
    // Check cache first
    const cached = priceCache.get(mint)
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      return { price: cached.price, marketCap: cached.marketCap || 0, priceChange24h: cached.priceChange24h || 0 }
    }

    // Static fallback data (will be calculated dynamically for SOL)
    const fallbackMap: { [key: string]: { price: number, marketCap: number, priceChange24h: number } } = {
      'USDC': { price: 1, marketCap: 50000000000, priceChange24h: 0 },
      'USDT': { price: 1, marketCap: 100000000000, priceChange24h: 0 },
      'EURC': { price: 1.1, marketCap: 1000000000, priceChange24h: 0 },
      'SOL': { price: 0, marketCap: 0, priceChange24h: 0 }, // Will be calculated dynamically
    }

    const fallbackData = fallbackMap[symbol.toUpperCase()] || { price: 0, marketCap: 0, priceChange24h: 0 }
    
    try {
      // Use AbortController for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000) // 3 second timeout
      
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        priceCache.set(mint, { ...fallbackData, timestamp: Date.now() })
        return fallbackData
      }
      
      const data = await response.json()
      
      if (data.pairs && data.pairs.length > 0) {
        const pair = data.pairs[0]
        let price = parseFloat(pair.priceUsd) || fallbackData.price
        let marketCap = pair.fdv || pair.marketCap || 0
        let priceChange24h = parseFloat(pair.priceChange?.h24) || 0
        
        // If DexScreener doesn't have market cap, try CoinGecko for major tokens
        if (!marketCap && ['SOL', 'USDC', 'USDT', 'BTC', 'ETH'].includes(symbol.toUpperCase())) {
          const geckoData = await getCoinGeckoData(symbol)
          if (geckoData) {
            price = geckoData.price || price
            marketCap = geckoData.marketCap || (symbol.toUpperCase() === 'SOL' && price > 0 ? price * 541.2 * 1000000 : fallbackData.marketCap)
            priceChange24h = geckoData.priceChange24h || priceChange24h
          } else if (symbol.toUpperCase() === 'SOL' && price > 0) {
            // Calculate SOL market cap using your provided circulating supply
            marketCap = price * 541.2 * 1000000 // 541.2M circulating supply
          } else {
            marketCap = fallbackData.marketCap
          }
        }
        
        const result = { price, marketCap, priceChange24h }
        priceCache.set(mint, { ...result, timestamp: Date.now() })
        return result
      }
      
      priceCache.set(mint, { ...fallbackData, timestamp: Date.now() })
      return fallbackData
      
    } catch (error) {
      priceCache.set(mint, { ...fallbackData, timestamp: Date.now() })
      return fallbackData
    }
  }

  const getTimeAgo = (period: string) => {
    const now = Date.now()
    switch (period) {
      case '10M': return now - (10 * 60 * 1000)
      case '30M': return now - (30 * 60 * 1000)
      case '1H': return now - (1 * 60 * 60 * 1000)
      case '2H': return now - (2 * 60 * 60 * 1000)
      case '4H': return now - (4 * 60 * 60 * 1000)
      case '12H': return now - (12 * 60 * 60 * 1000)
      case '1D': return now - (24 * 60 * 60 * 1000)
      case '3D': return now - (3 * 24 * 60 * 60 * 1000)
      case '1W': return now - (7 * 24 * 60 * 60 * 1000)
      default: return now - (60 * 60 * 1000)
    }
  }

  const calculateNetInflows = async (swapData: SwapData[], period: string) => {
    // Data is already filtered by the API, no need to filter again
    const recentSwaps = swapData
    
    console.log(`📊 Processing ${period}: ${recentSwaps.length} swaps received from API`)
    
    
    const tokenFlows: { [mint: string]: { symbol: string, netInflow: number, inflow: number, outflow: number, swapCount: number, uniqueWhales: Set<string> } } = {}
    
    // Process swaps to build token flows
    recentSwaps.forEach(swap => {
      const { inputToken, outputToken } = swap
      
      if (outputToken?.mint && outputToken?.amount) {
        const mint = outputToken.mint
        const symbol = getTokenSymbol(mint, outputToken.metadata?.symbol)
        
        if (!tokenFlows[mint]) {
          tokenFlows[mint] = { symbol, netInflow: 0, inflow: 0, outflow: 0, swapCount: 0, uniqueWhales: new Set() }
        }
        tokenFlows[mint].inflow += outputToken.amount
        tokenFlows[mint].netInflow += outputToken.amount
        tokenFlows[mint].swapCount += 1
        tokenFlows[mint].uniqueWhales.add(swap.feePayer)
      }
      
      if (inputToken?.mint && inputToken?.amount) {
        const mint = inputToken.mint
        const symbol = getTokenSymbol(mint, inputToken.metadata?.symbol)
        
        if (!tokenFlows[mint]) {
          tokenFlows[mint] = { symbol, netInflow: 0, inflow: 0, outflow: 0, swapCount: 0, uniqueWhales: new Set() }
        }
        tokenFlows[mint].outflow += inputToken.amount
        tokenFlows[mint].netInflow -= inputToken.amount
        tokenFlows[mint].swapCount += 1
        tokenFlows[mint].uniqueWhales.add(swap.feePayer)
      }
    })
    
    // Get unique tokens only (limit to top 40 by activity to ensure we get enough inflows and outflows)
    const tokenEntries = Object.entries(tokenFlows)
      .sort(([,a], [,b]) => b.swapCount - a.swapCount)
      .slice(0, 40)
    
    console.log(`🔍 Found ${Object.keys(tokenFlows).length} unique tokens, processing top ${tokenEntries.length}`)
    
    // Process prices in parallel with limited concurrency
    const BATCH_SIZE = 3
    const inflowArray = []
    
    for (let i = 0; i < tokenEntries.length; i += BATCH_SIZE) {
      const batch = tokenEntries.slice(i, i + BATCH_SIZE)
      
      const batchResults = await Promise.all(
        batch.map(async ([mint, data]) => {
          const tokenData = await getTokenData(mint, data.symbol)
          const netInflowUSD = data.netInflow * tokenData.price
          
          return { 
            mint, 
            symbol: data.symbol,
            netInflow: data.netInflow,
            swapCount: data.swapCount,
            uniqueWhales: data.uniqueWhales.size,
            price: tokenData.price, 
            marketCap: tokenData.marketCap,
            priceChange24h: tokenData.priceChange24h,
            netInflowUSD 
          }
        })
      )
      
      inflowArray.push(...batchResults)
      
      // Delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < tokenEntries.length) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }
    
    // Separate inflows and outflows - don't pre-sort here, let the UI handle sorting
    const inflows = inflowArray.filter(token => token.netInflowUSD > 0)
    const outflows = inflowArray.filter(token => token.netInflowUSD < 0)
    
    console.log(`💰 Results: ${inflows.length} inflow tokens, ${outflows.length} outflow tokens`)
    
    return { inflows, outflows }
  }

  const fetchSwaps = useCallback(async (isAutoRefresh = false) => {
    try {
      if (isAutoRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)
      
      // Fetch from database with period filter (data is already being collected every minute by cron)
      const response = await fetch(`/api/database-swaps?period=${selectedPeriod}`)
      if (!response.ok) {
        throw new Error('Failed to fetch swaps from database')
      }
      const data = await response.json()
      setSwaps(data)
      
      // Calculate net inflows and outflows
      const { inflows, outflows } = await calculateNetInflows(data, selectedPeriod)
      setTopInflows(inflows)
      setTopOutflows(outflows)
      setLastUpdate(new Date())
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedPeriod])

  // Memoize sorted data and take top 10 based on current sort
  const sortedInflows = useMemo(() => {
    return [...topInflows].sort((a, b) => {
      const multiplier = inflowSortDesc ? -1 : 1
      if (inflowSortBy === 'swaps') return multiplier * (b.swapCount - a.swapCount)
      if (inflowSortBy === 'uniqueWhales') return multiplier * (b.uniqueWhales - a.uniqueWhales)
      if (inflowSortBy === 'netInflow') return multiplier * (b.netInflow - a.netInflow)
      if (inflowSortBy === 'netInflowUSD') return multiplier * (b.netInflowUSD - a.netInflowUSD)
      if (inflowSortBy === 'price') return multiplier * (b.price - a.price)
      if (inflowSortBy === 'marketCap') return multiplier * (b.marketCap - a.marketCap)
      if (inflowSortBy === 'priceChange24h') return multiplier * (b.priceChange24h - a.priceChange24h)
      return 0
    }).slice(0, 10) // Take top 10 based on current sort
  }, [topInflows, inflowSortBy, inflowSortDesc])

  const sortedOutflows = useMemo(() => {
    return [...topOutflows].sort((a, b) => {
      const multiplier = outflowSortDesc ? -1 : 1
      if (outflowSortBy === 'swaps') return multiplier * (b.swapCount - a.swapCount)
      if (outflowSortBy === 'uniqueWhales') return multiplier * (b.uniqueWhales - a.uniqueWhales)
      if (outflowSortBy === 'netInflow') return multiplier * (Math.abs(b.netInflow) - Math.abs(a.netInflow))
      if (outflowSortBy === 'netInflowUSD') return multiplier * (Math.abs(b.netInflowUSD) - Math.abs(a.netInflowUSD))
      if (outflowSortBy === 'price') return multiplier * (b.price - a.price)
      if (outflowSortBy === 'marketCap') return multiplier * (b.marketCap - a.marketCap)
      if (outflowSortBy === 'priceChange24h') return multiplier * (b.priceChange24h - a.priceChange24h)
      return 0
    }).slice(0, 10) // Take top 10 based on current sort
  }, [topOutflows, outflowSortBy, outflowSortDesc])

  useEffect(() => {
    fetchSwaps()
    
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    
    // Set up auto-refresh every 60 seconds (increased from 30s to reduce load)
    intervalRef.current = setInterval(() => {
      fetchSwaps(true)
    }, 60000)
    
    // Cleanup interval on component unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [selectedPeriod, fetchSwaps])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  const timeOptions = ['10M', '30M', '1H', '2H', '4H', '12H', '1D', '3D', '1W']

  const handleInflowSort = (column: 'swaps' | 'uniqueWhales' | 'netInflow' | 'netInflowUSD' | 'price' | 'marketCap' | 'priceChange24h') => {
    if (inflowSortBy === column) {
      setInflowSortDesc(!inflowSortDesc)
    } else {
      setInflowSortBy(column)
      setInflowSortDesc(true)
    }
  }

  const handleOutflowSort = (column: 'swaps' | 'uniqueWhales' | 'netInflow' | 'netInflowUSD' | 'price' | 'marketCap' | 'priceChange24h') => {
    if (outflowSortBy === column) {
      setOutflowSortDesc(!outflowSortDesc)
    } else {
      setOutflowSortBy(column)
      setOutflowSortDesc(true)
    }
  }

  const getSortIndicator = (column: string, currentSort: string, isDesc: boolean) => {
    if (column !== currentSort) return ''
    return isDesc ? ' ↑' : ' ↓'
  }

  const formatMarketCap = (marketCap: number) => {
    if (marketCap >= 1000000000) {
      return `$${(marketCap / 1000000000).toFixed(2)}B`
    } else if (marketCap >= 1000000) {
      return `$${(marketCap / 1000000).toFixed(2)}M`
    } else {
      return `$${(marketCap / 1000).toFixed(0)}K`
    }
  }

  const formatPriceChange = (change: number) => {
    const color = change >= 0 ? 'green' : 'red'
    const sign = change >= 0 ? '+' : ''
    return <span style={{ color }}>{sign}{change.toFixed(2)}%</span>
  }

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      alert(`${label} copied to clipboard!`)
    } catch (err) {
      console.error('Failed to copy:', err)
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
        <h1>Token Flow Rankings</h1>
        <div>
          {refreshing && <span>Updating...</span>}
          {lastUpdate && !refreshing && (
            <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
          )}
        </div>
      </div>
      
      <div>
        <h3>Time Period:</h3>
        <div>
          {timeOptions.map(period => (
            <label key={period}>
              <input
                type="radio"
                name="timeperiod"
                value={period}
                checked={selectedPeriod === period}
                onChange={(e) => setSelectedPeriod(e.target.value)}
              />
              {period}
            </label>
          ))}
        </div>
      </div>
      
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
      
      {!loading && !error && (
        <div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div>BUY tokens: {sortedInflows.length}</div>
            </div>
            <div>
              <div>SELL tokens: {sortedOutflows.length}</div>
            </div>
          </div>
          
          <div>
          <div>
            <h4>Top 10 Token Inflows (Most Bought)</h4>
            {sortedInflows.length > 0 ? (
              <table style={{ border: '1px solid #ccc', borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid #ccc', padding: '8px', width: '12%' }}>Token</th>
                    <th style={{ border: '1px solid #ccc', padding: '8px', width: '20%' }}>Token Address</th>
                    <th style={{ border: '1px solid #ccc', padding: '8px', cursor: 'pointer', width: '12%' }} onClick={() => handleInflowSort('swaps')}>
                      Swaps{getSortIndicator('swaps', inflowSortBy, inflowSortDesc)}
                    </th>
                    <th style={{ border: '1px solid #ccc', padding: '8px', cursor: 'pointer', width: '12%' }} onClick={() => handleInflowSort('uniqueWhales')}>
                      Unique Whales{getSortIndicator('uniqueWhales', inflowSortBy, inflowSortDesc)}
                    </th>
                    <th style={{ border: '1px solid #ccc', padding: '8px', cursor: 'pointer', width: '15%' }} onClick={() => handleInflowSort('marketCap')}>
                      Market Cap{getSortIndicator('marketCap', inflowSortBy, inflowSortDesc)}
                    </th>
                    <th style={{ border: '1px solid #ccc', padding: '8px', cursor: 'pointer', width: '16%' }} onClick={() => handleInflowSort('netInflowUSD')}>
                      USD Volume{getSortIndicator('netInflowUSD', inflowSortBy, inflowSortDesc)}
                    </th>
                    <th style={{ border: '1px solid #ccc', padding: '8px', cursor: 'pointer', width: '13%' }} onClick={() => handleInflowSort('price')}>
                      Price{getSortIndicator('price', inflowSortBy, inflowSortDesc)}
                    </th>
                    <th style={{ border: '1px solid #ccc', padding: '8px', cursor: 'pointer', width: '12%' }} onClick={() => handleInflowSort('priceChange24h')}>
                      24h Change{getSortIndicator('priceChange24h', inflowSortBy, inflowSortDesc)}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedInflows.map((token, index) => (
                    <tr key={token.mint}>
                      <td style={{ border: '1px solid #ccc', padding: '8px' }}>{token.symbol}</td>
                      <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                        <button onClick={() => copyToClipboard(token.mint, 'Contract Address')}>
                          {token.mint.slice(0, 8)}...{token.mint.slice(-4)}
                        </button>
                      </td>
                      <td style={{ border: '1px solid #ccc', padding: '8px' }}>{token.swapCount}</td>
                      <td style={{ border: '1px solid #ccc', padding: '8px' }}>{token.uniqueWhales}</td>
                      <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                        {formatMarketCap(token.marketCap)}
                      </td>
                      <td style={{ border: '1px solid #ccc', padding: '8px' }}>+${token.netInflowUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td style={{ border: '1px solid #ccc', padding: '8px' }}>${token.price.toFixed(4)}</td>
                      <td style={{ border: '1px solid #ccc', padding: '8px' }}>{formatPriceChange(token.priceChange24h)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No token inflows in the selected period</p>
            )}
          </div>

          <div>
            <h4>Top 10 Token Outflows (Most Sold)</h4>
            {sortedOutflows.length > 0 ? (
              <table style={{ border: '1px solid #ccc', borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid #ccc', padding: '8px', width: '12%' }}>Token</th>
                    <th style={{ border: '1px solid #ccc', padding: '8px', width: '20%' }}>Token Address</th>
                    <th style={{ border: '1px solid #ccc', padding: '8px', cursor: 'pointer', width: '12%' }} onClick={() => handleOutflowSort('swaps')}>
                      Swaps{getSortIndicator('swaps', outflowSortBy, outflowSortDesc)}
                    </th>
                    <th style={{ border: '1px solid #ccc', padding: '8px', cursor: 'pointer', width: '12%' }} onClick={() => handleOutflowSort('uniqueWhales')}>
                      Unique Whales{getSortIndicator('uniqueWhales', outflowSortBy, outflowSortDesc)}
                    </th>
                    <th style={{ border: '1px solid #ccc', padding: '8px', cursor: 'pointer', width: '15%' }} onClick={() => handleOutflowSort('marketCap')}>
                      Market Cap{getSortIndicator('marketCap', outflowSortBy, outflowSortDesc)}
                    </th>
                    <th style={{ border: '1px solid #ccc', padding: '8px', cursor: 'pointer', width: '16%' }} onClick={() => handleOutflowSort('netInflowUSD')}>
                      USD Volume{getSortIndicator('netInflowUSD', outflowSortBy, outflowSortDesc)}
                    </th>
                    <th style={{ border: '1px solid #ccc', padding: '8px', cursor: 'pointer', width: '13%' }} onClick={() => handleOutflowSort('price')}>
                      Price{getSortIndicator('price', outflowSortBy, outflowSortDesc)}
                    </th>
                    <th style={{ border: '1px solid #ccc', padding: '8px', cursor: 'pointer', width: '12%' }} onClick={() => handleOutflowSort('priceChange24h')}>
                      24h Change{getSortIndicator('priceChange24h', outflowSortBy, outflowSortDesc)}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedOutflows.map((token, index) => (
                    <tr key={token.mint}>
                      <td style={{ border: '1px solid #ccc', padding: '8px' }}>{token.symbol}</td>
                      <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                        <button onClick={() => copyToClipboard(token.mint, 'Contract Address')}>
                          {token.mint.slice(0, 8)}...{token.mint.slice(-4)}
                        </button>
                      </td>
                      <td style={{ border: '1px solid #ccc', padding: '8px' }}>{token.swapCount}</td>
                      <td style={{ border: '1px solid #ccc', padding: '8px' }}>{token.uniqueWhales}</td>
                      <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                        {formatMarketCap(token.marketCap)}
                      </td>
                      <td style={{ border: '1px solid #ccc', padding: '8px' }}>${Math.abs(token.netInflowUSD).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td style={{ border: '1px solid #ccc', padding: '8px' }}>${token.price.toFixed(4)}</td>
                      <td style={{ border: '1px solid #ccc', padding: '8px' }}>{formatPriceChange(token.priceChange24h)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No token outflows in the selected period</p>
            )}
          </div>
          </div>
        </div>
      )}
    </div>
  )
}