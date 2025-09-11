import { supabase } from '@/lib/supabase'
import { getTokenSymbol } from '@/lib/token-symbols'

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

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
const priceCache = new Map<string, { price: number, marketCap: number, timestamp: number }>()

// Supply fetching functions for accurate market cap calculation
const getSupplyFromBirdeye = async (mint: string): Promise<number | null> => {
  try {
    const response = await fetch(`https://public-api.birdeye.so/public/token_overview?address=${mint}`, {
      headers: {
        'X-API-KEY': '6897f1ce501943679d9ddf76343790f7'
      }
    })
    if (response.ok) {
      const data = await response.json()
      return data?.data?.supply || null
    }
  } catch (error) {
  }
  return null
}

const getSupplyFromCoinGecko = async (mint: string): Promise<number | null> => {
  try {
    const response = await fetch(`https://api.coingecko.com/api/v3/coins/solana/contract/${mint}`)
    if (response.ok) {
      const data = await response.json()
      return data?.market_data?.circulating_supply || data?.market_data?.total_supply || null
    }
  } catch (error) {
  }
  return null
}

const getTokenSupply = async (mint: string, symbol: string): Promise<number | null> => {
  // Try API-based supply first (Birdeye, then CoinGecko)
  let supply = await getSupplyFromBirdeye(mint)
  if (supply) {
    return supply
  }

  supply = await getSupplyFromCoinGecko(mint)
  if (supply) {
    return supply
  }

  // Fallback to hardcoded supplies
  const knownSupplies: { [key: string]: number } = {
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

// Multi-API approach for maximum reliability - Jupiter, Birdeye, DexScreener, CoinGecko
const getTokenData = async (mint: string, fallbackSymbol: string): Promise<{ price: number, marketCap: number, symbol: string }> => {
  // Check cache first
  const cached = priceCache.get(mint)
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    const symbol = getTokenSymbol(mint, fallbackSymbol)
    return { price: cached.price, marketCap: cached.marketCap, symbol }
  }

  const symbol = getTokenSymbol(mint, fallbackSymbol)
  
  // Try supply-based calculation first for known tokens
  const knownSupply = await getTokenSupply(mint, symbol)
  if (knownSupply) {
    
    // Get price from Jupiter (fastest API) as primary source
    try {
      const response = await fetch(`https://price.jup.ag/v4/price?ids=${mint}`)
      if (response.ok) {
        const data = await response.json()
        const price = data?.data?.[mint]?.price || 0
        if (price > 0) {
          const supplyBasedResult = {
            price: price,
            marketCap: price * knownSupply,
            symbol: symbol
          }
          
          priceCache.set(mint, { price: supplyBasedResult.price, marketCap: supplyBasedResult.marketCap, timestamp: Date.now() })
          
          return supplyBasedResult
        }
      }
    } catch (error) {
    }
  }

  let finalPrice = 0
  let finalMarketCap = 0

  // Try all APIs in parallel for maximum reliability
  const apiCalls = await Promise.allSettled([
    // Jupiter for price
    Promise.race([
      fetch(`https://price.jup.ag/v4/price?ids=${mint}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => ({ source: 'Jupiter', price: data?.data?.[mint]?.price || 0, marketCap: 0 })),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
    ]),
    
    // Birdeye for market cap
    Promise.race([
      fetch(`https://public-api.birdeye.so/public/token_overview?address=${mint}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => ({ source: 'Birdeye', price: 0, marketCap: data?.data?.mc || 0 })),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
    ]),
    
    // DexScreener for both
    Promise.race([
      fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.pairs?.[0]) {
            const pair = data.pairs[0]
            return {
              source: 'DexScreener',
              price: parseFloat(pair.priceUsd) || 0,
              marketCap: pair.fdv || pair.marketCap || 0
            }
          }
          return { source: 'DexScreener', price: 0, marketCap: 0 }
        }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
    ]),
    
    // CoinGecko as final fallback
    Promise.race([
      fetch(`https://api.coingecko.com/api/v3/coins/solana/contract/${mint}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => ({
          source: 'CoinGecko',
          price: data?.market_data?.current_price?.usd || 0,
          marketCap: data?.market_data?.market_cap?.usd || 0
        })),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
    ])
  ])

  // Use the first valid price and market cap found
  for (const result of apiCalls) {
    if (result.status === 'fulfilled' && result.value) {
      if (!finalPrice && result.value.price > 0) {
        finalPrice = result.value.price
      }
      if (!finalMarketCap && result.value.marketCap > 0) {
        finalMarketCap = result.value.marketCap
      }
    }
  }

  // Cache the result (even if zeros - user prefers real data over fake)
  priceCache.set(mint, { price: finalPrice, marketCap: finalMarketCap, timestamp: Date.now() })
  
  return { price: finalPrice, marketCap: finalMarketCap, symbol }
}

// Get SOL pair address for a token using DexScreener
const getSolPairAddress = async (tokenMint: string): Promise<string | null> => {
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenMint}`)
    if (response.ok) {
      const data = await response.json()
      if (data?.pairs?.length > 0) {
        // Find SOL pair (look for SOL as base or quote token)
        const solMint = 'So11111111111111111111111111111111111111112'
        const solPair = data.pairs.find((pair: any) => 
          pair.baseToken?.address === solMint || pair.quoteToken?.address === solMint
        )
        if (solPair) {
          return solPair.pairAddress
        }
      }
    }
  } catch (error) {
  }
  return null
}


export async function GET() {
  try {
    // Blacklist SOL and common stablecoins as outputs
    const blacklistedTokens = [
      'So11111111111111111111111111111111111111112', // SOL
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
      'A9mUU4qviSctJVPJdBJWkb28deg915LYJKrzQ19ji3FM', // USDCet 
      'Bn113WT6rbdgwrm12UJtnmNqGqZjY4it2WoUQuQopFVn'  // wLUNA
    ]

    const stablecoins = [
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
      'A9mUU4qviSctJVPJdBJWkb28deg915LYJKrzQ19ji3FM'  // USDCet
    ]
    const solMint = 'So11111111111111111111111111111111111111112'

    // Get recent buying transactions from last 24 hours (limit to prevent timeout)
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000)
    
    const { data: swaps, error } = await supabase
      .from('swaps')
      .select('timestamp, input_token_mint, input_token_amount, output_token_mint, output_token_amount, output_token_symbol, signature')
      .gte('timestamp', oneDayAgo)
      .not('output_token_mint', 'is', null)
      .not('input_token_mint', 'is', null)
      .gt('input_token_amount', 0)
      .gt('output_token_amount', 0)
      .order('timestamp', { ascending: false })
    
    if (error) {
      return Response.json({ 
        error: 'Failed to fetch swaps from database',
        details: error.message 
      }, { status: 500 })
    }

    if (!swaps || swaps.length === 0) {
      return Response.json([])
    }

    // Filter for BUYING transactions: Any swap that results in receiving a token
    const tokenPurchases = swaps.filter(swap => {
      // BUYING = receiving any token that's not blacklisted (not SOL/USDC/USDT)
      const outputIsBlacklisted = blacklistedTokens.includes(swap.output_token_mint)
      const isBuyingTransaction = !outputIsBlacklisted
      
      
      return isBuyingTransaction
    })

    // Get unique tokens and their most recent purchase
    const uniqueTokens = new Map()
    for (const swap of tokenPurchases) {
      const tokenMint = swap.output_token_mint
      if (!uniqueTokens.has(tokenMint)) {
        uniqueTokens.set(tokenMint, swap)
      }
    }


    // Get current SOL price for historical buy price calculation  
    const solData = await getTokenData(solMint, 'SOL')
    const currentSolPrice = solData.price || 140 // Fallback if DexScreener fails

    // Calculate profits for each unique token
    const profitPromises = Array.from(uniqueTokens.values()).map(async (swap) => {
      try {
        // Get current price, market cap, and correct symbol from DexScreener
        const tokenData = await getTokenData(swap.output_token_mint, swap.output_token_symbol || 'Unknown')
        const currentPrice = tokenData.price
        
        if (!currentPrice || currentPrice <= 0) return null

        
        // Calculate REAL buy price from swap transaction data
        let buyPrice = 0
        const currentPriceForProfit = currentPrice // Use current price for profit calculation
        
        const inputIsSol = swap.input_token_mint === solMint
        const inputIsStable = stablecoins.includes(swap.input_token_mint)
        
        if (inputIsSol) {
          // SOL -> Token: (SOL amount * SOL price) / token amount = buy price per token
          const solAmount = swap.input_token_amount // Already in decimal format (e.g., 1.5 SOL)
          const usdValue = solAmount * currentSolPrice
          const tokenAmount = swap.output_token_amount
          buyPrice = usdValue / tokenAmount
          
        } else if (inputIsStable) {
          // Stablecoin -> Token: stablecoin amount / token amount = buy price per token  
          const stableAmount = swap.input_token_amount // Already in decimal format (e.g., 100 USDC)
          const tokenAmount = swap.output_token_amount
          buyPrice = stableAmount / tokenAmount
        } else {
          // Blacklist other token swaps - only show real SOL/stablecoin data
          return null
        }
        
        
        // Skip if we don't have real buy price
        if (!buyPrice || buyPrice <= 0) {
          return null
        }

        // Calculate profit percentage using CURRENT price vs buy price
        const profitPercent = ((currentPriceForProfit - buyPrice) / buyPrice) * 100

        // Filter out significant losses (show only profits and small losses)
        if (profitPercent <= -5) return null

        return {
          tokenSymbol: tokenData.symbol,
          tokenAddress: swap.output_token_mint,
          transactionTime: swap.timestamp,
          buyPrice,
          peakPrice: currentPriceForProfit, // Now represents current price
          profitPercent,
          marketCap: tokenData.marketCap,
          signature: swap.signature
        } as WhaleProfitData
      } catch (error) {
        return null
      }
    })

    const results = await Promise.all(profitPromises)
    const validProfits = results.filter(profit => profit !== null) as WhaleProfitData[]


    // Sort by profit percentage and get top 10
    const top10Profits = validProfits
      .sort((a, b) => b.profitPercent - a.profitPercent)
      .slice(0, 10)
    
    return Response.json(top10Profits)
    
  } catch (error) {
    console.error('Top whale profits API error:', error)
    return Response.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}