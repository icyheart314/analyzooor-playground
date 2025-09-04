import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Get swaps from the last 2 hours to ensure we have enough data
    const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000)
    
    const { data: swaps, error } = await supabase
      .from('swaps')
      .select('*')
      .gte('timestamp', twoHoursAgo)
      .order('timestamp', { ascending: false })
    
    if (error) {
      console.error('Database query error:', error)
      return Response.json({ error: 'Failed to fetch swaps from database' }, { status: 500 })
    }
    
    // Transform data back to the original format
    const formattedSwaps = swaps.map(swap => ({
      id: swap.swap_id,
      timestamp: swap.timestamp,
      feePayer: swap.fee_payer,
      source: swap.source,
      signature: swap.signature,
      description: swap.description,
      whaleAsset: swap.whale_asset,
      whaleSymbol: swap.whale_symbol,
      inputToken: swap.input_token_mint ? {
        mint: swap.input_token_mint,
        amount: parseFloat(swap.input_token_amount) || 0,
        metadata: {
          symbol: swap.input_token_symbol
        }
      } : null,
      outputToken: swap.output_token_mint ? {
        mint: swap.output_token_mint,
        amount: parseFloat(swap.output_token_amount) || 0,
        metadata: {
          symbol: swap.output_token_symbol
        }
      } : null
    }))
    
    return Response.json(formattedSwaps)
    
  } catch (error) {
    console.error('Database swaps API error:', error)
    return Response.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}