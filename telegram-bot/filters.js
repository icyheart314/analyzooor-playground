class FilterEngine {
  constructor() {
    this.processedSwaps = new Set(); // Track processed swaps to avoid duplicates
  }

  // Main method called by bot - checks if user should be notified
  async shouldNotify(userId, swap, userFilters) {
    return await this.matchesFilters(swap, this.processFilters(userFilters));
  }

  // Convert database filters to usable format
  processFilters(dbFilters) {
    const filters = {
      tokens: [],
      blacklist: [],
      whale_blacklist: [],
      min_purchase: null,
      max_market_cap: null,
      monitor_all: true, // Default to monitoring all tokens
      notifications_enabled: false // Default to OFF - user must explicitly turn ON
    };

    // Handle case where dbFilters might not be an array
    if (!dbFilters || !Array.isArray(dbFilters)) {
      return filters;
    }

    // First pass: collect all filter data
    dbFilters.forEach(filter => {
      switch(filter.filter_type) {
        case 'token_whitelist':
          filters.tokens.push(filter.filter_value);
          break;
        case 'token_blacklist':
          filters.blacklist.push(filter.filter_value);
          break;
        case 'whale_blacklist':
          filters.whale_blacklist.push(filter.filter_value);
          break;
        case 'min_purchase':
          // Use the latest (last) min_purchase value only
          filters.min_purchase = parseFloat(filter.filter_value);
          break;
        case 'max_market_cap':
          // Use the latest (last) max_market_cap value only  
          filters.max_market_cap = parseFloat(filter.filter_value);
          break;
        case 'monitor_all':
          filters.monitor_all = filter.filter_value === 'true';
          break;
        case 'notifications_enabled':
          filters.notifications_enabled = filter.filter_value === 'true';
          break;
      }
    });

    return filters;
  }

  // Get token symbol with fallback for known tokens
  getTokenSymbol(token) {
    // First try metadata symbol
    if (token?.metadata?.symbol) {
      return token.metadata.symbol;
    }

    // Fallback mapping for known tokens without proper metadata
    // Synced with whale tracker's proven token mapping from @/lib/token-symbols
    const knownTokens = {
      // From whale tracker's proven list
      'Ey59PH7Z4BFU4HjyKnyMdWt5GGN76KazTAwQihoUXRnk': 'LAUNCHCOIN',
      'pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn': 'PUMP',
      'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC': 'ai16z',
      'HUMA1821qVDKta3u2ovmfDQeW2fSQouSKE8fkF44wvGw': 'HUMA',
      
      // Additional common tokens
      'So11111111111111111111111111111111111111112': 'SOL',
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
      'USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB': 'USD1',
      'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 'mSOL',
      'bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1': 'bSOL',
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'BONK',
      '2FPyTwcZLUg1MDrwsyoP4D6s1tM7hAkHYRjkNb5w6Pxk': 'ETH',
      '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E': 'BTC',
      '5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm': 'INF',
      'A9mUU4qviSctJVPJdBJWkb28deg915LYJKrzQ19ji3FM': 'USDCet',
      '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh': 'WBTC'
    };

    const mint = token?.mint;
    if (mint && knownTokens[mint]) {
      return knownTokens[mint];
    }

    // Last resort: try name or return Unknown
    return token?.metadata?.name || 'Unknown';
  }

  // Format notification message  
  async formatNotification(swap) {
    const isBuy = this.isBuyTransaction(swap);
    const relevantToken = isBuy ? swap.outputToken : swap.inputToken;
    const symbol = this.getTokenSymbol(relevantToken);
    const amount = relevantToken?.amount;
    const usdValue = await this.calculateSwapValueUSD(swap);
    const whale = swap.feePayer?.slice(0, 8) + '...';
    const txHash = swap.signature?.slice(0, 8) + '...';
    const tokenCA = relevantToken?.mint;

    // Get market cap data
    const tokenData = await this.getTokenData(tokenCA, symbol);
    const marketCap = tokenData.marketCap;
    let marketCapFormatted = 'Unknown';
    if (marketCap > 0) {
      if (marketCap >= 1000000000) {
        marketCapFormatted = `$${(marketCap / 1000000000).toFixed(1)}B`;
      } else if (marketCap >= 1000000) {
        marketCapFormatted = `$${(marketCap / 1000000).toFixed(1)}M`;
      } else {
        marketCapFormatted = `$${Math.round(marketCap / 1000)}K`;
      }
    }

    return `${isBuy ? '🟢 BUY' : '🔴 SELL'} Alert!

🐋 Whale: [${whale}](https://solscan.io/account/${swap.feePayer})
💰 Token: [${symbol}](https://dexscreener.com/solana/${tokenCA})
📋 CA: \`${tokenCA}\`
📊 Amount: ${amount?.toLocaleString() || 'Unknown'}
💵 Value: $${Math.round(usdValue || 0).toLocaleString()}
🏦 Market Cap: ${marketCapFormatted}
🔗 [View Transaction](https://solscan.io/tx/${swap.signature})
💹 [Trade on Pepo](https://app.pepo.fun/whaleooor)

#WhaleAlert #${symbol}`;
  }

  // Check if a swap matches user's filters
  async matchesFilters(swap, userFilters) {
    console.log(`[FILTER DEBUG] Starting filter check for swap`);
    console.log(`[FILTER DEBUG] User filters:`, JSON.stringify(userFilters, null, 2));
    
    // Check if notifications are enabled first
    if (!userFilters.notifications_enabled) {
      console.log(`[FILTER DEBUG] Notifications disabled - BLOCKING`);
      return false;
    }

    // Skip if already processed (avoid duplicate notifications)
    const swapId = swap.signature || `${swap.timestamp}-${swap.feePayer}`;
    if (this.processedSwaps.has(swapId)) {
      return false;
    }

    // Extract token info from swap
    const inputToken = swap.inputToken;
    const outputToken = swap.outputToken;
    
    // Filter out SOL<->stablecoin swaps (these are just conversions, not token trades)
    const stablecoins = ['USDC', 'USDT', 'BUSD', 'USD1', 'DAI', 'FRAX'];
    const inputSymbol = this.getTokenSymbol(inputToken);
    const outputSymbol = this.getTokenSymbol(outputToken);
    
    if ((inputSymbol === 'SOL' && stablecoins.includes(outputSymbol)) ||
        (outputSymbol === 'SOL' && stablecoins.includes(inputSymbol))) {
      return false; // Skip SOL<->stablecoin conversions
    }
    
    // Filter out spam tokens starting with "Xs" prefix
    const inputMint = inputToken?.mint;
    const outputMint = outputToken?.mint;
    
    if ((inputMint && inputMint.startsWith('Xs')) || (outputMint && outputMint.startsWith('Xs'))) {
      return false; // Skip spam tokens with "Xs" prefix
    }
    
    // Blacklist specific problematic tokens
    const hardcodedBlacklist = [
      'EJhqXKJEncSx1HJjS5ZpKdiKGGgLiRgNPvo8JZvw5Guj'
    ];
    
    console.log(`[BLACKLIST DEBUG] Checking tokens - Input: ${inputMint}, Output: ${outputMint}`);
    if (hardcodedBlacklist.includes(inputMint) || hardcodedBlacklist.includes(outputMint)) {
      console.log(`[BLACKLIST DEBUG] BLOCKED - Token found in hardcoded blacklist`);
      return false; // Skip blacklisted tokens
    }
    
    // Determine if this is a buy or sell
    const isBuy = this.isBuyTransaction(swap);
    const relevantToken = isBuy ? outputToken : inputToken;
    const swapAmountUSD = await this.calculateSwapValueUSD(swap);

    if (!relevantToken) return false;

    // Note: Server-side filtering already handles stable/SOL blacklisting via proven API
    // Trust the /api/swaps endpoint filtering and focus only on user preferences

    // Apply filters based on monitor mode
    let tokenCheck = true;
    
    if (userFilters.monitor_all) {
      // All Tokens mode: check blacklist to exclude tokens
      tokenCheck = this.checkBlacklist(relevantToken, userFilters.blacklist);
    } else {
      // Token Filter mode: check whitelist to include only specific tokens
      tokenCheck = this.checkTokenWhitelist(relevantToken, userFilters.tokens);
    }
    
    // Check whale blacklist - applies to both modes
    const whaleCheck = this.checkWhaleBlacklist(swap.feePayer, userFilters.whale_blacklist);
    
    // Perform async market cap check if needed
    let marketCapCheck = true;
    if (userFilters.max_market_cap && userFilters.max_market_cap > 0) {
      marketCapCheck = await this.checkMarketCap(relevantToken, userFilters.max_market_cap);
    }

    const checks = [
      tokenCheck,
      whaleCheck,
      this.checkMinimumPurchase(swapAmountUSD, userFilters.min_purchase),
      marketCapCheck
    ];

    // All checks must pass
    const matches = checks.every(check => check === true);
    
    if (matches) {
      this.processedSwaps.add(swapId);
      // Clean up old processed swaps (keep only last 1000)
      if (this.processedSwaps.size > 1000) {
        const oldSwaps = Array.from(this.processedSwaps).slice(0, 500);
        oldSwaps.forEach(id => this.processedSwaps.delete(id));
      }
    }

    return matches;
  }

  // Check if transaction is a buy (receiving non-stablecoin token)
  isBuyTransaction(swap) {
    const stablecoins = ['USDC', 'USDT', 'BUSD', 'USD1'];
    const outputToken = swap.outputToken;
    
    if (!outputToken) return false;
    
    // If output is a stablecoin, this is a sell
    if (stablecoins.includes(outputToken.metadata?.symbol)) return false;
    
    // If output is not SOL and not stablecoin, likely a buy
    return outputToken.metadata?.symbol !== 'SOL';
  }

  // Calculate USD value using proven token-flows logic
  async calculateSwapValueUSD(swap) {
    const inputToken = swap.inputToken;
    const outputToken = swap.outputToken;
    
    // Try input token first
    if (inputToken?.metadata?.symbol) {
      const stablecoins = ['USDC', 'USDT', 'BUSD', 'DAI', 'FRAX', 'USD1'];
      if (stablecoins.includes(inputToken.metadata.symbol)) {
        return inputToken.amount; // Stablecoins are ~$1
      }
      
      if (inputToken.metadata.symbol === 'SOL') {
        // Get real SOL price from proven method
        const solData = await this.getTokenData('So11111111111111111111111111111111111111112', 'SOL');
        return inputToken.amount * (solData.price || 140); // Fallback to 140
      }
      
      // For other tokens, try to get real price
      if (inputToken.mint) {
        const tokenData = await this.getTokenData(inputToken.mint, inputToken.metadata.symbol);
        if (tokenData.price > 0) {
          return inputToken.amount * tokenData.price;
        }
      }
    }
    
    // Try output token if input failed
    if (outputToken?.metadata?.symbol) {
      const stablecoins = ['USDC', 'USDT', 'BUSD', 'DAI', 'FRAX', 'USD1'];
      if (stablecoins.includes(outputToken.metadata.symbol)) {
        return outputToken.amount; // Stablecoins are ~$1
      }
      
      if (outputToken.metadata.symbol === 'SOL') {
        // Get real SOL price from proven method
        const solData = await this.getTokenData('So11111111111111111111111111111111111111112', 'SOL');
        return outputToken.amount * (solData.price || 140); // Fallback to 140
      }
      
      // For other tokens, try to get real price
      if (outputToken.mint) {
        const tokenData = await this.getTokenData(outputToken.mint, outputToken.metadata.symbol);
        if (tokenData.price > 0) {
          return outputToken.amount * tokenData.price;
        }
      }
    }
    
    return 0; // Can't determine USD value
  }

  // Token whitelist check - for Token Filter mode
  checkTokenWhitelist(token, allowedTokens) {
    // If no whitelist specified, block everything in Token Filter mode
    if (!allowedTokens || allowedTokens.length === 0) return false;
    
    const tokenSymbol = this.getTokenSymbol(token).toLowerCase();
    const tokenMint = token.mint?.toLowerCase();
    
    return allowedTokens.some(allowed => 
      allowed.toLowerCase() === tokenSymbol || 
      allowed.toLowerCase() === tokenMint
    );
  }

  // Blacklist check
  checkBlacklist(token, blacklistedTokens) {
    if (!blacklistedTokens || blacklistedTokens.length === 0) return true; // No blacklist = allow all
    
    const tokenSymbol = this.getTokenSymbol(token).toLowerCase();
    const tokenMint = token.mint?.toLowerCase();
    
    return !blacklistedTokens.some(blocked => 
      blocked.toLowerCase() === tokenSymbol || 
      blocked.toLowerCase() === tokenMint
    );
  }

  // Whale blacklist check
  checkWhaleBlacklist(whaleAddress, blacklistedWhales) {
    if (!blacklistedWhales || blacklistedWhales.length === 0) return true; // No blacklist = allow all
    
    return !blacklistedWhales.some(blocked => 
      blocked.toLowerCase() === whaleAddress?.toLowerCase()
    );
  }

  // Minimum purchase amount check
  checkMinimumPurchase(swapValueUSD, minPurchase) {
    if (!minPurchase || minPurchase <= 0) return true; // No minimum = allow all
    return swapValueUSD >= minPurchase;
  }

  // Market cap filter using proven token-flows logic
  async checkMarketCap(token, maxMarketCap) {
    if (!maxMarketCap || maxMarketCap <= 0) return true; // No filter = allow all (including unknown market cap)
    
    try {
      const tokenData = await this.getTokenData(token.mint, token.symbol);
      console.log(`[MARKET CAP DEBUG] Token: ${this.getTokenSymbol(token)}, Market Cap: ${tokenData.marketCap}, Max Filter: ${maxMarketCap}`);
      
      // If market cap is unknown (0) or failed to fetch, block the token ONLY when filter is active
      if (tokenData.marketCap === 0) {
        console.log(`[MARKET CAP DEBUG] Unknown market cap with active filter - BLOCKING token`);
        return false; 
      }
      
      // Only allow tokens with market cap BELOW or EQUAL to the max filter
      const allowed = tokenData.marketCap <= maxMarketCap;
      console.log(`[MARKET CAP DEBUG] Market cap check result: ${allowed ? 'ALLOW' : 'BLOCK'}`);
      return allowed;
    } catch (error) {
      console.log(`[MARKET CAP DEBUG] Error occurred with active filter - BLOCKING token: ${error.message}`);
      return false; // On error, block token (filter out) only when filter is active
    }
  }

  // Format swap for notification
  formatSwapNotification(swap) {
    const isBuy = this.isBuyTransaction(swap);
    const action = isBuy ? '🟢 BUY' : '🔴 SELL';
    const relevantToken = isBuy ? swap.outputToken : swap.inputToken;
    const swapValueUSD = this.calculateSwapValueUSD(swap);
    
    const tokenSymbol = relevantToken?.metadata?.symbol || 'Unknown';
    const tokenAmount = relevantToken?.amount?.toFixed(2) || '0';
    
    return `${action} ${tokenSymbol}

💰 Amount: ${tokenAmount} ${tokenSymbol}
💵 Value: ~$${swapValueUSD.toFixed(2)}
🐋 Whale: ${swap.feePayer?.slice(0, 8)}...${swap.feePayer?.slice(-4)}
📝 Tx: ${swap.signature?.slice(0, 8)}...${swap.signature?.slice(-4)}

🔗 [View on Solscan](https://solscan.io/tx/${swap.signature})`;
  }

  // Proven market cap calculation methods from token-flows
  async getDexScreenerData(mint) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) return { price: 0, marketCap: 0, priceChange24h: 0 };
      
      const data = await response.json();
      
      if (data.pairs && data.pairs.length > 0) {
        const pair = data.pairs[0];
        return {
          price: parseFloat(pair.priceUsd) || 0,
          marketCap: pair.fdv || pair.marketCap || 0,
          priceChange24h: parseFloat(pair.priceChange?.h24) || 0
        };
      }
      
      return { price: 0, marketCap: 0, priceChange24h: 0 };
    } catch (error) {
      return { price: 0, marketCap: 0, priceChange24h: 0 };
    }
  }

  async getTokenSupply(mint, symbol) {
    // Known token supplies for accurate market cap calculation - synced with token-flows
    const knownSupplies = {
      'SOL': 542_300_000, // 542.3M SOL circulating supply
      'USDC': 72_400_000_000, // 72.4B USDC circulating supply
      'USDT': 169_100_000_000, // 169.1B USDT circulating supply
      'GUN': 1_121_166_667,  // 1.121B circulating supply
      'CPOOL': 808_900_000,  // 808.9M circulating supply
      'PUMP': 1_000_000_000_000, // 1 quadrillion (1000 billion) circulating supply
    };
    
    console.log(`[SUPPLY DEBUG] Token: ${symbol}, Mint: ${mint}`);
    
    // Check by symbol first
    if (knownSupplies[symbol]) {
      console.log(`[SUPPLY DEBUG] Found known supply for ${symbol}: ${knownSupplies[symbol]}`);
      return knownSupplies[symbol];
    }
    
    // Check by mint address patterns - ONLY pump.fun tokens that end with "pump"
    if (mint && mint.endsWith('pump')) {
      console.log(`[SUPPLY DEBUG] Detected pump.fun token (ends with 'pump'), using 1B supply`);
      return 1_000_000_000; // 1B supply for pump.fun tokens
    }
    
    // Check for bonk tokens
    if (mint && mint.endsWith('bonk')) {
      console.log(`[SUPPLY DEBUG] Detected bonk token, using 1B supply`);
      return 1_000_000_000; // 1B supply for bonk tokens
    }
    
    console.log(`[SUPPLY DEBUG] No known supply found, using API data`);
    return null; // Unknown supply, use API
  }

  async getTokenData(mint, symbol) {
    // Fast path for known supply tokens - calculate market cap directly
    const knownSupply = await this.getTokenSupply(mint, symbol);
    if (knownSupply) {
      const dexData = await this.getDexScreenerData(mint);
      if (dexData.price > 0) {
        return {
          price: dexData.price,
          marketCap: dexData.price * knownSupply, // Use known supply
          priceChange24h: dexData.priceChange24h
        };
      }
      // If we have known supply but no price data, return 0 market cap
      return { price: 0, marketCap: 0, priceChange24h: 0 };
    }

    // Fallback to DexScreener market cap
    const dexData = await this.getDexScreenerData(mint);

    // Ensure we always return valid numbers, treat null/undefined as 0
    return {
      price: dexData.price || 0,
      marketCap: dexData.marketCap || 0,
      priceChange24h: dexData.priceChange24h || 0
    };
  }

  // Note: Arbitrage filtering is handled server-side by the proven /api/swaps endpoint
  // No need to duplicate that logic here - trust the server filtering
}

module.exports = FilterEngine;