const WHALEOOOR_API_URL = process.env.NEXT_PUBLIC_WHALEOOOR_API_URL || 'https://app.pepo.fun/whaleooor'

export interface WhaleTransaction {
  id: string
  timestamp: number
  feePayer: string
  source: string
  signature: string
  description: string
  whaleAsset: string
  whaleSymbol: string
  inputToken: {
    mint: string
    amount: number
    metadata: {
      name: string
      symbol: string
      decimals: number
    }
  }
  outputToken: {
    mint: string
    amount: number
    metadata: {
      name: string
      symbol: string
      decimals: number
    }
  }
  // Computed fields for our analytics
  type: 'buy' | 'sell'
  tokenAddress: string
  tokenSymbol: string
  tokenName: string
  amount: number
  valueUSD: number
}

export interface TokenStats {
  tokenAddress: string
  tokenSymbol: string
  tokenName: string
  buyVolume: number
  sellVolume: number
  buyCount: number
  sellCount: number
  netVolume: number
}

export interface TimeIntervalData {
  topBuys: TokenStats[]
  topSells: TokenStats[]
  transactionCounts: { timestamp: number; count: number }[]
  buySellCounts: { timestamp: number; buys: number; sells: number }[]
  volumes: { timestamp: number; buyVolume: number; sellVolume: number }[]
}

export class WhaleooorClient {
  private baseUrl: string

  constructor(baseUrl: string = WHALEOOOR_API_URL) {
    this.baseUrl = baseUrl
  }

  async getTransactions(timeframe: '5min' | '1hour' | '24hour'): Promise<WhaleTransaction[]> {
    // TODO: Replace with actual API endpoint when available
    const response = await fetch(`${this.baseUrl}/api/transactions?timeframe=${timeframe}`)
    if (!response.ok) {
      throw new Error('Failed to fetch transactions')
    }
    return response.json()
  }

  async getTokenStats(timeframe: '5min' | '1hour' | '24hour'): Promise<TokenStats[]> {
    // TODO: Replace with actual API endpoint when available
    const response = await fetch(`${this.baseUrl}/api/tokens/stats?timeframe=${timeframe}`)
    if (!response.ok) {
      throw new Error('Failed to fetch token stats')
    }
    return response.json()
  }

  async getAnalyticsData(timeframe: '5min' | '1hour' | '24hour'): Promise<TimeIntervalData> {
    // TODO: Replace with actual API endpoint when available
    // For now, return mock data structure
    return {
      topBuys: [],
      topSells: [],
      transactionCounts: [],
      buySellCounts: [],
      volumes: []
    }
  }

  // Helper method to aggregate transactions into time buckets
  aggregateTransactions(transactions: WhaleTransaction[], bucketSize: number): {
    transactionCounts: { timestamp: number; count: number }[]
    buySellCounts: { timestamp: number; buys: number; sells: number }[]
    volumes: { timestamp: number; buyVolume: number; sellVolume: number }[]
  } {
    const buckets = new Map<number, {
      count: number
      buys: number
      sells: number
      buyVolume: number
      sellVolume: number
    }>()

    transactions.forEach(tx => {
      const bucketTime = Math.floor(tx.timestamp / bucketSize) * bucketSize
      
      if (!buckets.has(bucketTime)) {
        buckets.set(bucketTime, {
          count: 0,
          buys: 0,
          sells: 0,
          buyVolume: 0,
          sellVolume: 0
        })
      }

      const bucket = buckets.get(bucketTime)!
      bucket.count++
      
      if (tx.type === 'buy') {
        bucket.buys++
        bucket.buyVolume += tx.valueUSD
      } else {
        bucket.sells++
        bucket.sellVolume += tx.valueUSD
      }
    })

    const sortedBuckets = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0])

    return {
      transactionCounts: sortedBuckets.map(([timestamp, data]) => ({
        timestamp,
        count: data.count
      })),
      buySellCounts: sortedBuckets.map(([timestamp, data]) => ({
        timestamp,
        buys: data.buys,
        sells: data.sells
      })),
      volumes: sortedBuckets.map(([timestamp, data]) => ({
        timestamp,
        buyVolume: data.buyVolume,
        sellVolume: data.sellVolume
      }))
    }
  }

  // Calculate top tokens by volume
  getTopTokens(transactions: WhaleTransaction[]): {
    topBuys: TokenStats[]
    topSells: TokenStats[]
  } {
    const tokenMap = new Map<string, TokenStats>()

    transactions.forEach(tx => {
      if (!tokenMap.has(tx.tokenAddress)) {
        tokenMap.set(tx.tokenAddress, {
          tokenAddress: tx.tokenAddress,
          tokenSymbol: tx.tokenSymbol,
          tokenName: tx.tokenName,
          buyVolume: 0,
          sellVolume: 0,
          buyCount: 0,
          sellCount: 0,
          netVolume: 0
        })
      }

      const stats = tokenMap.get(tx.tokenAddress)!
      
      if (tx.type === 'buy') {
        stats.buyVolume += tx.valueUSD
        stats.buyCount++
      } else {
        stats.sellVolume += tx.valueUSD
        stats.sellCount++
      }
      
      stats.netVolume = stats.buyVolume - stats.sellVolume
    })

    const allTokens = Array.from(tokenMap.values())
    
    const topBuys = [...allTokens]
      .sort((a, b) => b.buyVolume - a.buyVolume)
      .slice(0, 10)
    
    const topSells = [...allTokens]
      .sort((a, b) => b.sellVolume - a.sellVolume)
      .slice(0, 10)

    return { topBuys, topSells }
  }
}

export const whaleooorClient = new WhaleooorClient()