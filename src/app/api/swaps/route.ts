export async function GET() {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_WHALEOOOR_API_URL || 'https://app.pepo.fun/whaleooor'
    const response = await fetch(`${apiUrl}/api/simple-swaps`)
    
    if (!response.ok) {
      return Response.json({ error: 'Failed to fetch swaps' }, { status: response.status })
    }
    
    const data = await response.json()
    
    return Response.json(data)
  } catch (error) {
    console.error('Error fetching swaps:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}