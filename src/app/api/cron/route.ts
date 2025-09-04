// This endpoint will be called by Vercel Cron Jobs every 5 minutes
export async function GET() {
  try {
    // Call our data collection endpoint
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000'
    
    const response = await fetch(`${baseUrl}/api/collect-data`)
    const result = await response.json()
    
    if (!response.ok) {
      return Response.json({ 
        error: 'Data collection failed',
        details: result 
      }, { status: 500 })
    }
    
    return Response.json({
      success: true,
      message: 'Data collection completed',
      result: result,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Cron job error:', error)
    return Response.json({ 
      error: 'Cron job failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}