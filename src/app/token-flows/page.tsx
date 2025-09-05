'use client'

import { useEffect, useState, useCallback } from 'react'

interface TokenInflow {
  symbol: string
  mint: string
  netInflow: number
  netInflowUSD: number
  swapCount: number
  price: number
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

export default function TokenInflowsPage() {
  const [swaps, setSwaps] = useState<SwapData[]>([])
  const [topInflows, setTopInflows] = useState<TokenInflow[]>([])
  const [topOutflows, setTopOutflows] = useState<TokenInflow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState('1H')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const getTokenPrice = async (mint: string, symbol: string): Promise<number> => {
    try {
      // Use DexScreener API for real-time prices
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`)
      
      if (!response.ok) {
        throw new Error(`DexScreener API error: ${response.status}`)
      }
      
      const data = await response.json()
      
      // DexScreener returns pairs, get the first one with USD price
      if (data.pairs && data.pairs.length > 0) {
        const pair = data.pairs[0] // Usually the most liquid pair
        return parseFloat(pair.priceUsd) || 0
      }
      
      // Fallback to estimated prices if API fails
      const priceMap: { [key: string]: number } = {
        'USDC': 1,
        'USDT': 1,
        'EURC': 1.1,
        'SOL': 150,
      }
      
      return priceMap[symbol.toUpperCase()] || 0
      
    } catch (error) {
      console.log(`Could not fetch price for ${symbol} (${mint}):`, error)
      
      // Fallback prices
      const priceMap: { [key: string]: number } = {
        'USDC': 1,
        'USDT': 1,
        'EURC': 1.1,
        'SOL': 150,
      }
      
      return priceMap[symbol.toUpperCase()] || 0
    }
  }

  const getTimeAgo = (period: string) => {
    const now = Date.now()
    switch (period) {
      case '1H': return now - (1 * 60 * 60 * 1000)
      case '2H': return now - (2 * 60 * 60 * 1000)
      case '4H': return now - (4 * 60 * 60 * 1000)
      case '12H': return now - (12 * 60 * 60 * 1000)
      case '1D': return now - (24 * 60 * 60 * 1000)
      case '3D': return now - (3 * 24 * 60 * 60 * 1000)
      case '1W': return now - (7 * 24 * 60 * 60 * 1000)
      case '1M': return now - (30 * 24 * 60 * 60 * 1000)
      default: return now - (60 * 60 * 1000)
    }
  }

  const calculateNetInflows = async (swapData: SwapData[], period: string) => {
    const timeAgo = getTimeAgo(period)
    const recentSwaps = swapData.filter(swap => swap.timestamp > timeAgo)
    
    console.log(`Period: ${period}, TimeAgo: ${new Date(timeAgo).toLocaleString()}, Total swaps: ${swapData.length}, Filtered swaps: ${recentSwaps.length}`)
    
    // Debug first few swap timestamps
    if (swapData.length > 0) {
      console.log('Sample swap timestamps:', swapData.slice(0, 3).map(s => ({ 
        timestamp: s.timestamp, 
        date: new Date(s.timestamp).toLocaleString(),
        olderThanCutoff: s.timestamp <= timeAgo
      })))
    }
    
    const tokenFlows: { [mint: string]: { symbol: string, netInflow: number, inflow: number, outflow: number, swapCount: number } } = {}
    
    recentSwaps.forEach(swap => {
      const { inputToken, outputToken } = swap
      
      // Track inflow (tokens being bought/received)
      if (outputToken?.mint && outputToken?.amount) {
        const mint = outputToken.mint
        const symbol = outputToken.metadata?.symbol || 'Unknown'
        
        if (!tokenFlows[mint]) {
          tokenFlows[mint] = { symbol, netInflow: 0, inflow: 0, outflow: 0, swapCount: 0 }
        }
        tokenFlows[mint].inflow += outputToken.amount
        tokenFlows[mint].netInflow += outputToken.amount
        tokenFlows[mint].swapCount += 1
      }
      
      // Track outflow (tokens being sold/given)
      if (inputToken?.mint && inputToken?.amount) {
        const mint = inputToken.mint
        const symbol = inputToken.metadata?.symbol || 'Unknown'
        
        if (!tokenFlows[mint]) {
          tokenFlows[mint] = { symbol, netInflow: 0, inflow: 0, outflow: 0, swapCount: 0 }
        }
        tokenFlows[mint].outflow += inputToken.amount
        tokenFlows[mint].netInflow -= inputToken.amount
        tokenFlows[mint].swapCount += 1
      }
    })
    
    // Get prices and calculate USD values
    const inflowArray = await Promise.all(
      Object.entries(tokenFlows).map(async ([mint, data]) => {
        const price = await getTokenPrice(mint, data.symbol)
        const netInflowUSD = data.netInflow * price
        return { 
          mint, 
          ...data, 
          price, 
          netInflowUSD 
        }
      })
    )
    
    // Separate inflows and outflows
    const inflows = inflowArray
      .filter(token => token.netInflowUSD > 0)
      .sort((a, b) => b.netInflowUSD - a.netInflowUSD)
      .slice(0, 10)
      
    // Get tokens with negative net flow (more selling than buying)
    const outflows = inflowArray
      .filter(token => token.netInflowUSD < 0)
      .sort((a, b) => a.netInflowUSD - b.netInflowUSD) // Sort by most negative (biggest net outflows)
      .slice(0, 10)
    
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
      
      // Fetch from database (data is already being collected every minute by cron)
      const response = await fetch('/api/database-swaps')
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

  useEffect(() => {
    fetchSwaps()
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(() => {
      console.log('Auto-refreshing token flows...')
      fetchSwaps(true)
    }, 30000)
    
    // Cleanup interval on component unmount or when selectedPeriod changes
    return () => clearInterval(interval)
  }, [selectedPeriod, fetchSwaps])

  const timeOptions = ['1H', '2H', '4H', '12H', '1D', '3D', '1W', '1M']

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
          <div className="grid grid-cols-4 gap-4">
            <div>
              <div>BUY tokens</div>
              <div>{topInflows.length}</div>
            </div>
            <div>
              <div>SELL tokens</div>
              <div>{topOutflows.length}</div>
            </div>
            <div>
              <div>Total net inflow</div>
              <div>${topInflows.reduce((sum, token) => sum + token.netInflowUSD, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div>
              <div>Total net outflow</div>
              <div>${Math.abs(topOutflows.reduce((sum, token) => sum + token.netInflowUSD, 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          </div>
          
          <div>
          <div>
            <h4>Top 10 Token Inflows (Most Bought)</h4>
            {topInflows.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>Token</th>
                    <th>Token Address</th>
                    <th>Swaps</th>
                    <th>Net Inflow</th>
                    <th>USD Volume</th>
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {topInflows.map((token, index) => (
                    <tr key={token.mint}>
                      <td>{token.symbol}</td>
                      <td>{token.mint.slice(0, 8)}...{token.mint.slice(-4)}</td>
                      <td>{token.swapCount}</td>
                      <td>+{token.netInflow.toFixed(4)}</td>
                      <td>+${token.netInflowUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td>${token.price.toFixed(4)}</td>
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
            {topOutflows.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>Token</th>
                    <th>Token Address</th>
                    <th>Swaps</th>
                    <th>Net Outflow</th>
                    <th>USD Volume</th>
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {topOutflows.map((token, index) => (
                    <tr key={token.mint}>
                      <td>{token.symbol}</td>
                      <td>{token.mint.slice(0, 8)}...{token.mint.slice(-4)}</td>
                      <td>{token.swapCount}</td>
                      <td>-{Math.abs(token.netInflow).toFixed(4)}</td>
                      <td>${Math.abs(token.netInflowUSD).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td>${token.price.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No token outflows in the selected period</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}