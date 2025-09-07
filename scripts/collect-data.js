const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const apiUrl = process.env.NEXT_PUBLIC_WHALEOOOR_API_URL || 'https://app.pepo.fun/whaleooor';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function collectData() {
  try {
    // Get the most recent timestamp from database for deduplication
    const { data: lastRecord } = await supabase
      .from('swaps')
      .select('timestamp')
      .order('timestamp', { ascending: false })
      .limit(1);
      
    const lastTimestamp = lastRecord?.[0]?.timestamp || 0;
    
    let allNewSwaps = [];
    const numberOfCalls = 3;
    const delayBetweenCalls = 20000; // 20 seconds
    
    // Make multiple API calls to capture more data
    for (let callIndex = 1; callIndex <= numberOfCalls; callIndex++) {
      try {
        const response = await fetch(`${apiUrl}/api/simple-swaps`);
        
        if (!response.ok) {
          throw new Error(`API request failed: ${response.status}`);
        }
        
        const swaps = await response.json();
        
        // Filter for new swaps not seen before
        const newSwaps = swaps.filter(swap => 
          swap.timestamp > lastTimestamp && 
          !allNewSwaps.some(existing => existing.id === swap.id)
        );
        
        allNewSwaps.push(...newSwaps);
        
        // Wait before next call (except for the last call)
        if (callIndex < numberOfCalls) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenCalls));
        }
        
      } catch (callError) {
        console.error(`API call ${callIndex} failed:`, callError);
        continue; // Continue with next call even if one fails
      }
    }
    
    let insertedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // Insert each new swap into database
    for (const swap of allNewSwaps) {
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
          .select();
        
        if (error) {
          // Skip duplicates (unique constraint violation)
          if (error.code === '23505') {
            skippedCount++;
            continue;
          }
          console.error('Database insert error:', error);
          errorCount++;
          continue;
        }
        
        if (data) {
          insertedCount++;
        }
        
      } catch (insertError) {
        console.error('Error inserting swap:', insertError);
        errorCount++;
        continue;
      }
    }
    
    console.log('📊 Data collection completed:');
    console.log(`   ✅ Inserted: ${insertedCount} new swaps`);
    console.log(`   ⏭️  Skipped: ${skippedCount} duplicates`);
    console.log(`   ❌ Errors: ${errorCount} failed inserts`);
    console.log(`   🕐 Time: ${new Date().toISOString()}`);
    
    // Clean up old data (keep only last 7 days)
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const { error: deleteError } = await supabase
      .from('swaps')
      .delete()
      .lt('timestamp', sevenDaysAgo);
    
    if (deleteError) {
      console.warn('Failed to clean old data:', deleteError);
    } else {
      console.log('🧹 Cleaned up data older than 7 days');
    }
    
  } catch (error) {
    console.error('❌ Data collection failed:', error);
    process.exit(1);
  }
}

// Run the collection
collectData();