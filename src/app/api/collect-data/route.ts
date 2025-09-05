import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Fetch latest swaps from the whaleooor API
    const apiUrl = process.env.NEXT_PUBLIC_WHALEOOOR_API_URL || 'https://app.pepo.fun/whaleooor'
    const response = await fetch(`${apiUrl}/api/simple-swaps`)
    
    if (!response.ok) {
      return Response.json({ error: 'Failed to fetch swaps' }, { status: response.status })
    }
    
    const swaps = await response.json()
    let insertedCount = 0
    let skippedCount = 0
    
    // Insert each swap into database (skip duplicates)
    for (const swap of swaps) {
      try {
        const { data, error } = await supabase
          .from('swaps')
          .insert({
            swap_id: swap.id,
            timestamp: swap.timestamp,
            fee_payer: swap.feePayer,
            source: swap.source,
            signature: swap.signature,
            description: swap.description,
            whale_asset: swap.whaleAsset,
            whale_symbol: swap.whaleSymbol,
            input_token_mint: swap.inputToken?.mint,
            input_token_amount: swap.inputToken?.amount,
            input_token_symbol: swap.inputToken?.metadata?.symbol,
            output_token_mint: swap.outputToken?.mint,
            output_token_amount: swap.outputToken?.amount,
            output_token_symbol: swap.outputToken?.metadata?.symbol,
          })
          .select()
        
        if (error) {
          // Skip if duplicate (unique constraint violation)
          if (error.code === '23505') {
            skippedCount++
            continue
          }
          console.error('Database insert error:', error)
          continue
        }
        
        if (data) {
          insertedCount++
        }
        
      } catch (insertError) {
        console.error('Error inserting swap:', insertError)
        continue
      }
    }
    
    // Cleanup: Delete data older than 1 month (run every 100th collection to avoid overload)
    const shouldCleanup = Math.random() < 0.01 // 1% chance = ~once per 100 collections
    let deletedCount = 0
    
    if (shouldCleanup) {
      try {
        const oneMonthAgo = new Date()
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
        
        const { count } = await supabase
          .from('swaps')
          .delete()
          .lt('created_at', oneMonthAgo.toISOString())
        
        deletedCount = count || 0
        console.log(`Cleanup: Deleted ${deletedCount} old swap records`)
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError)
      }
    }
    
    return Response.json({ 
      success: true,
      totalSwaps: swaps.length,
      inserted: insertedCount,
      skipped: skippedCount,
      deleted: deletedCount,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Data collection error:', error)
    return Response.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}