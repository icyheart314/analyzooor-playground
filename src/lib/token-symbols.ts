// Token symbol mapping for tokens that don't have metadata or return "Unknown"
// Add new entries as: 'mint_address': 'SYMBOL'

export const TOKEN_SYMBOL_MAP: { [mint: string]: string } = {
  // Known token mappings
  'Ey59PH7Z4BFU4HjyKnyMdWt5GGN76KazTAwQihoUXRnk': 'LAUNCHCOIN',
  'pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn': 'PUMP',
  'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC': 'ai16z',
  
  // Add more tokens here as needed
  // 'mint_address_here': 'TOKEN_SYMBOL',
}

// Helper function to get token symbol
export const getTokenSymbol = (mint: string, fallbackSymbol?: string): string => {
  return TOKEN_SYMBOL_MAP[mint] || fallbackSymbol || 'Unknown'
}