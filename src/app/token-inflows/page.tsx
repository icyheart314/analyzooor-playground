'use client'

import { useEffect, useState } from 'react'

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
  const [error, setError] = useState<string | null>(null)

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

  const calculateNetInflows = async (swapData: SwapData[]) => {
    const oneHourAgo = Date.now() - (60 * 60 * 1000)
    const recentSwaps = swapData.filter(swap => swap.timestamp > oneHourAgo)
    
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
      
    const outflows = await Promise.all(
      Object.entries(tokenFlows)
        .filter(([_, data]) => data.outflow > 0)
        .sort((a, b) => b[1].outflow - a[1].outflow)
        .slice(0, 10)
        .map(async ([mint, data]) => {
          const price = await getTokenPrice(mint, data.symbol)
          const outflowUSD = data.outflow * price
          return { 
            mint, 
            symbol: data.symbol,
            netInflow: -data.outflow, // Show as negative for display
            netInflowUSD: -outflowUSD, // Show as negative for display
            price, 
            swapCount: data.swapCount
          }
        })
    )
    
    return { inflows, outflows }
  }

  useEffect(() => {
    const fetchSwaps = async () => {
      try {
        // First, trigger data collection to get latest data
        await fetch('/api/collect-data')
        
        // Then fetch from database
        const response = await fetch('/api/database-swaps')
        if (!response.ok) {
          throw new Error('Failed to fetch swaps from database')
        }
        const data = await response.json()
        setSwaps(data)
        
        // Calculate net inflows and outflows
        const { inflows, outflows } = await calculateNetInflows(data)
        setTopInflows(inflows)
        setTopOutflows(outflows)
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data')
      } finally {
        setLoading(false)
      }
    }

    fetchSwaps()
  }, [])

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-8">Token Flow Rankings (Past 1 Hour)</h1>
      
      {loading && <p>Loading...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}
      
      {!loading && !error && (
        <div className="space-y-8">
          {/* Top 10 Inflows */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-green-600">🟢 Top 10 Token Inflows (Most Bought)</h2>
            {topInflows.length > 0 ? (
              <div className="space-y-3">
                {topInflows.map((token, index) => (
                  <div key={token.mint} className="flex justify-between items-center p-3 bg-green-50 rounded border-l-4 border-green-500">
                    <div>
                      <span className="font-medium">#{index + 1} {token.symbol}</span>
                      <div className="text-sm text-gray-500 font-mono">{token.mint.slice(0, 8)}...</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg text-green-600">
                        +${token.netInflowUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-sm text-gray-500">
                        +{token.netInflow.toFixed(4)} {token.symbol}
                      </div>
                      <div className="text-xs text-gray-400">
                        ${token.price.toFixed(4)}/token • {token.swapCount} swaps
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No token inflows in the past hour</p>
            )}
          </div>

          {/* Top 10 Outflows */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-red-600">🔴 Top 10 Token Outflows (Most Sold)</h2>
            {topOutflows.length > 0 ? (
              <div className="space-y-3">
                {topOutflows.map((token, index) => (
                  <div key={token.mint} className="flex justify-between items-center p-3 bg-red-50 rounded border-l-4 border-red-500">
                    <div>
                      <span className="font-medium">#{index + 1} {token.symbol}</span>
                      <div className="text-sm text-gray-500 font-mono">{token.mint.slice(0, 8)}...</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg text-red-600">
                        ${Math.abs(token.netInflowUSD).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-sm text-gray-500">
                        {Math.abs(token.netInflow).toFixed(4)} {token.symbol}
                      </div>
                      <div className="text-xs text-gray-400">
                        ${token.price.toFixed(4)}/token • {token.swapCount} swaps
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No token outflows in the past hour</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}