import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Get last 24 hours of swaps
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000)
    
    const { data: swaps, error } = await supabase
      .from('swaps')
      .select('timestamp')
      .gte('timestamp', oneDayAgo)
      .order('timestamp', { ascending: true })
    
    if (error) {
      return Response.json({ 
        error: 'Failed to fetch activity data',
        details: error.message 
      }, { status: 500 })
    }

    if (!swaps || swaps.length === 0) {
      return Response.json([])
    }

    // Group swaps into 15-minute intervals
    const intervals: { [key: string]: number } = {}
    
    swaps.forEach(swap => {
      // Round timestamp to nearest 15-minute interval
      const timestamp = swap.timestamp
      const intervalStart = Math.floor(timestamp / (15 * 60 * 1000)) * (15 * 60 * 1000)
      const intervalKey = intervalStart.toString()
      
      intervals[intervalKey] = (intervals[intervalKey] || 0) + 1
    })

    // Convert to array format for charts
    const activityData = Object.entries(intervals)
      .map(([timestamp, count]) => ({
        timestamp: parseInt(timestamp),
        time: new Date(parseInt(timestamp)).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        }),
        swaps: count
      }))
      .sort((a, b) => a.timestamp - b.timestamp)

    return Response.json(activityData)
    
  } catch (error) {
    console.error('Activity data API error:', error)
    return Response.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}