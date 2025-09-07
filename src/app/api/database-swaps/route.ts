import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    // Get period from query params (default to 1 week for safety)
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '1W'
    
    // Calculate timestamp filter based on period
    const now = Date.now()
    let timeAgo: number
    
    switch (period) {
      case '10M': timeAgo = now - (10 * 60 * 1000); break
      case '30M': timeAgo = now - (30 * 60 * 1000); break
      case '1H': timeAgo = now - (1 * 60 * 60 * 1000); break
      case '2H': timeAgo = now - (2 * 60 * 60 * 1000); break
      case '4H': timeAgo = now - (4 * 60 * 60 * 1000); break
      case '12H': timeAgo = now - (12 * 60 * 60 * 1000); break
      case '1D': timeAgo = now - (24 * 60 * 60 * 1000); break
      case '3D': timeAgo = now - (3 * 24 * 60 * 60 * 1000); break
      case '1W': timeAgo = now - (7 * 24 * 60 * 60 * 1000); break
      default: timeAgo = now - (7 * 24 * 60 * 60 * 1000); break
    }
    
    const { data: swaps, error } = await supabase
      .from('swaps')
      .select('swap_id, timestamp, fee_payer, source, signature, description, whale_asset, whale_symbol, input_token_mint, input_token_amount, input_token_symbol, output_token_mint, output_token_amount, output_token_symbol')
      .gte('timestamp', timeAgo)
      .order('timestamp', { ascending: false })
      .limit(1000)
    
    if (error) {
      return Response.json({ 
        error: 'Failed to fetch swaps from database',
        details: error.message,
        code: error.code 
      }, { status: 500 })
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