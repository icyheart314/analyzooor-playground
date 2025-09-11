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
const CACHE_DURATION = 10 * 60 * 1000 // 10 minutes - longer cache to avoid rate limits

export default function TokenInflowsPage() {
  const [swaps, setSwaps] = useState<SwapData[]>([])
  const [topInflows, setTopInflows] = useState<TokenInflow[]>([])
  const [topOutflows, setTopOutflows] = useState<TokenInflow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [totalTokens, setTotalTokens] = useState(0)
  const [selectedPeriod, setSelectedPeriod] = useState('1H')
  const [isClient, setIsClient] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [inflowSortBy, setInflowSortBy] = useState<'swaps' | 'uniqueWhales' | 'netInflow' | 'netInflowUSD' | 'price' | 'marketCap' | 'priceChange24h'>('netInflowUSD')
  const [inflowSortDesc, setInflowSortDesc] = useState(true)
  const [outflowSortBy, setOutflowSortBy] = useState<'swaps' | 'uniqueWhales' | 'netInflow' | 'netInflowUSD' | 'price' | 'marketCap' | 'priceChange24h'>('netInflowUSD')
  const [outflowSortDesc, setOutflowSortDesc] = useState(true)
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Load saved period after client-side hydration
  useEffect(() => {
    setIsClient(true)
    const savedPeriod = localStorage.getItem('selectedPeriod')
    if (savedPeriod) {
      setSelectedPeriod(savedPeriod)
    }
  }, [])



  const getDexScreenerData = async (mint: string): Promise<{ price: number, marketCap: number, priceChange24h: number }> => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // Increased timeout
      
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) return { price: 0, marketCap: 0, priceChange24h: 0 }
      
      const data = await response.json()
      
      if (data.pairs && data.pairs.length > 0) {
        const pair = data.pairs[0]
        return {
          price: parseFloat(pair.priceUsd) || 0,
          marketCap: pair.fdv || pair.marketCap || 0,
          priceChange24h: parseFloat(pair.priceChange?.h24) || 0
        }
      }
      
      return { price: 0, marketCap: 0, priceChange24h: 0 }
    } catch (error) {
      return { price: 0, marketCap: 0, priceChange24h: 0 }
    }
  }

  const getCoinGeckoData = async (mint: string, symbol: string): Promise<{ price: number, marketCap: number, priceChange24h: number }> => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // Increased timeout
      
      // Try contract address first
      let response = await fetch(`https://api.coingecko.com/api/v3/coins/solana/contract/${mint}`, {
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        // Try by symbol for major tokens
        const geckoIds: { [key: string]: string } = {
          'SOL': 'solana',
          'USDC': 'usd-coin', 
          'USDT': 'tether',
          'BTC': 'bitcoin',
          'ETH': 'ethereum'
        }
        
        const geckoId = geckoIds[symbol.toUpperCase()]
        if (geckoId) {
          const controller2 = new AbortController()
          const timeoutId2 = setTimeout(() => controller2.abort(), 5000)
          
          response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${geckoId}&vs_currencies=usd&include_market_cap=true&include_24hr_change=true`, {
            signal: controller2.signal
          })
          
          clearTimeout(timeoutId2)
          
          if (response.ok) {
            const data = await response.json()
            const coinData = data[geckoId]
            if (coinData) {
              return {
                price: coinData.usd || 0,
                marketCap: coinData.usd_market_cap || 0,
                priceChange24h: coinData.usd_24h_change || 0
              }
            }
          }
        }
        return { price: 0, marketCap: 0, priceChange24h: 0 }
      }
      
      const data = await response.json()
      return {
        price: data.market_data?.current_price?.usd || 0,
        marketCap: data.market_data?.market_cap?.usd || 0,
        priceChange24h: data.market_data?.price_change_percentage_24h || 0
      }
      
    } catch (error) {
      return { price: 0, marketCap: 0, priceChange24h: 0 }
    }
  }


  const getTokenSupply = async (mint: string, symbol: string): Promise<number | null> => {
    // Use hardcoded supplies only - avoid problematic API calls
    const knownSupplies: { [key: string]: number } = {
      'SOL': 542_300_000, // 542.3M SOL circulating supply
      'USDC': 72_400_000_000, // 72.4B USDC circulating supply
      'USDT': 169_100_000_000, // 169.1B USDT circulating supply
      'GUN': 1_121_166_667,  // 1.121B circulating supply
      'CPOOL': 808_900_000,  // 808.9M circulating supply
    }
    
    // Check by symbol first
    if (knownSupplies[symbol]) {
      return knownSupplies[symbol]
    }
    
    // Check by mint address patterns
    if (mint.endsWith('pump') || mint.endsWith('bonk')) {
      return 1_000_000_000  // 1B supply for pump.fun/bonk tokens
    }
    
    return null // Unknown supply, use API
  }

  const getTokenSupplySync = (mint: string, symbol: string): number | null => {
    // Known token supplies for accurate market cap calculation
    const knownSupplies: { [key: string]: number } = {
      'SOL': 542_300_000, // 542.3M SOL circulating supply
      'USDC': 72_400_000_000, // 72.4B USDC circulating supply
      'USDT': 169_100_000_000, // 169.1B USDT circulating supply
      'GUN': 1_121_166_667,  // 1.121B circulating supply
      'CPOOL': 808_900_000,  // 808.9M circulating supply
    }
    
    // Check by symbol first
    if (knownSupplies[symbol]) {
      return knownSupplies[symbol]
    }
    
    // Check by mint address patterns
    if (mint.endsWith('pump') || mint.endsWith('bonk')) {
      return 1_000_000_000  // 1B supply for pump.fun/bonk tokens
    }
    
    return null // Unknown supply, use API
  }

  const getTokenData = async (mint: string, symbol: string): Promise<{ price: number, marketCap: number, priceChange24h: number }> => {
    // Force cache clear for problematic tokens (removed GUN since CoinGecko works)
    const problematicTokens: string[] = []  // All tokens now work with knownSupplies or APIs
    if (problematicTokens.includes(symbol)) {
      priceCache.delete(mint)
    }
    
    // Check cache first
    const cached = priceCache.get(mint)
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      return { price: cached.price, marketCap: cached.marketCap || 0, priceChange24h: cached.priceChange24h || 0 }
    }

    // Fast path for known supply tokens - calculate market cap directly
    const knownSupply = await getTokenSupply(mint, symbol)
    if (knownSupply) {
      
      // Get price from DexScreener (most reliable API)
      let price = 0
      let priceChange24h = 0
      
      const dexData = await getDexScreenerData(mint)
      if (dexData.price > 0) {
        price = dexData.price
        priceChange24h = dexData.priceChange24h
      }
      
      if (price > 0) {
        const supplyBasedResult = {
          price: price,
          marketCap: price * knownSupply, // Use known supply instead of API
          priceChange24h: priceChange24h
        }
        
        priceCache.set(mint, { ...supplyBasedResult, timestamp: Date.now() })
        return supplyBasedResult
      }
    }

    // Use only working APIs: DexScreener (most reliable) > CoinGecko (if token exists)
    const apis = [
      { name: 'DexScreener', func: () => getDexScreenerData(mint) },        // Most reliable API
      { name: 'CoinGecko', func: () => getCoinGeckoData(mint, symbol) },     // Backup for market cap
    ]
    
    let finalResult = { price: 0, marketCap: 0, priceChange24h: 0 }
    
    // Try all APIs in parallel and merge the best data
    const apiPromises = apis.map(async api => {
      try {
        const data = await api.func()
        return { api: api.name, data, success: true }
      } catch (error) {
        return { api: api.name, data: { price: 0, marketCap: 0, priceChange24h: 0 }, success: false }
      }
    })
    
    try {
      const results = await Promise.all(apiPromises)
      
      // Collect all valid data from successful API calls
      const allPrices = []
      const allMarketCaps = []
      const allPriceChanges = []
      
      
      for (const result of results) {
        if (result.success && result.data) {
          if (result.data.price > 0) allPrices.push(result.data.price)
          if (result.data.marketCap > 0) allMarketCaps.push(result.data.marketCap)
          if (result.data.priceChange24h !== 0) allPriceChanges.push(result.data.priceChange24h)
        }
      }
      
      // Use the first valid value from each array (APIs are in priority order)
      finalResult = {
        price: allPrices.length > 0 ? allPrices[0] : 0,
        marketCap: allMarketCaps.length > 0 ? allMarketCaps[0] : 0,
        priceChange24h: allPriceChanges.length > 0 ? allPriceChanges[0] : 0
      }
      
      // Cache the merged result
      priceCache.set(mint, { ...finalResult, timestamp: Date.now() })
      return finalResult
      
    } catch (error) {
      const result = { 
        price: 0, 
        marketCap: 0, 
        priceChange24h: 0 
      }
      priceCache.set(mint, { ...result, timestamp: Date.now() })
      return result
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
      default: return now - (60 * 60 * 1000)
    }
  }

  const calculateNetInflows = async (swapData: SwapData[], period: string) => {
    // Data is already filtered by the API, no need to filter again
    const recentSwaps = swapData
    
    
    const tokenFlows: { [mint: string]: { symbol: string, netInflow: number, inflow: number, outflow: number, swapCount: number, uniqueWhales: Set<string> } } = {}
    
    // Process swaps to build token flows
    recentSwaps.forEach(swap => {
      const { inputToken, outputToken } = swap
      
      if (outputToken?.mint && outputToken?.amount) {
        const mint = outputToken.mint
        const symbol = getTokenSymbol(mint, outputToken.metadata?.symbol)
        
        // Convert SOL lamports to decimal if amount > 1M (likely lamports from PUMP_FUN)
        let amount = outputToken.amount
        if (symbol === 'SOL' && amount > 1000000) {
          amount = amount / 1e9  // Convert lamports to SOL
        }
        
        if (!tokenFlows[mint]) {
          tokenFlows[mint] = { symbol, netInflow: 0, inflow: 0, outflow: 0, swapCount: 0, uniqueWhales: new Set() }
        }
        tokenFlows[mint].inflow += amount
        tokenFlows[mint].netInflow += amount
        tokenFlows[mint].swapCount += 1
        tokenFlows[mint].uniqueWhales.add(swap.feePayer)
      }
      
      if (inputToken?.mint && inputToken?.amount) {
        const mint = inputToken.mint
        const symbol = getTokenSymbol(mint, inputToken.metadata?.symbol)
        
        // Convert SOL lamports to decimal if amount > 1M (likely lamports from PUMP_FUN)
        let amount = inputToken.amount
        if (symbol === 'SOL' && amount > 1000000) {
          amount = amount / 1e9  // Convert lamports to SOL
        }
        
        if (!tokenFlows[mint]) {
          tokenFlows[mint] = { symbol, netInflow: 0, inflow: 0, outflow: 0, swapCount: 0, uniqueWhales: new Set() }
        }
        tokenFlows[mint].outflow += amount
        tokenFlows[mint].netInflow -= amount
        tokenFlows[mint].swapCount += 1
        tokenFlows[mint].uniqueWhales.add(swap.feePayer)
      }
    })
    
    // Get all unique tokens (no artificial limit)
    const tokenEntries = Object.entries(tokenFlows)
    
    console.log(`Total unique tokens processed: ${tokenEntries.length}`)
    
    // Dynamic batch size based on token count
    const BATCH_SIZE = tokenEntries.length > 100 ? 4 : tokenEntries.length > 50 ? 3 : 2
    const inflowArray = []
    
    // Sort by volume first to prioritize important tokens
    const sortedTokenEntries = tokenEntries
      .map(([mint, data]) => ([mint, data, Math.abs(data.netInflow)]))
      .sort((a, b) => b[2] - a[2])
    
    // Set total tokens for progress tracking
    setTotalTokens(sortedTokenEntries.length)
    setProgress(0)
    
    for (let i = 0; i < sortedTokenEntries.length; i += BATCH_SIZE) {
      const batch = sortedTokenEntries.slice(i, i + BATCH_SIZE)
      
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
      
      // Update progress
      setProgress(i + batch.length)
      
      // Dynamic delay based on token count - faster for large datasets
      if (i + BATCH_SIZE < sortedTokenEntries.length) {
        const delay = tokenEntries.length > 100 ? 500 : tokenEntries.length > 50 ? 750 : 1000
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    // Separate inflows and outflows - don't pre-sort here, let the UI handle sorting
    const inflows = inflowArray.filter(token => token.netInflowUSD > 0)
    const outflows = inflowArray.filter(token => token.netInflowUSD < 0)
    
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
      console.log(`Fetched ${data.length} swaps for period ${selectedPeriod}`)
      
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
    // Only fetch data after client-side hydration is complete
    if (!isClient) return
    
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
  }, [selectedPeriod, fetchSwaps, isClient])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  const timeOptions = ['10M', '30M', '1H', '2H', '4H', '12H', '1D']

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
                onChange={(e) => {
                  const newPeriod = e.target.value
                  setSelectedPeriod(newPeriod)
                  localStorage.setItem('selectedPeriod', newPeriod)
                }}
              />
              {period}
            </label>
          ))}
        </div>
      </div>
      
      {loading && (
        <div>
          <p>Loading token data...</p>
          {totalTokens > 0 && (
            <div>
              <progress value={progress} max={totalTokens}></progress>
              <p>Processing {progress} of {totalTokens} tokens ({Math.round((progress / totalTokens) * 100)}%)</p>
            </div>
          )}
        </div>
      )}
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
                      <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                        <a 
                          href={`https://dexscreener.com/solana/${token.mint}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline"
                        >
                          {token.symbol}
                        </a>
                      </td>
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
                      <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                        <a 
                          href={`https://dexscreener.com/solana/${token.mint}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline"
                        >
                          {token.symbol}
                        </a>
                      </td>
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