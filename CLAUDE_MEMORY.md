# Claude Memory File - Vince's Coding Preferences & Project Context

*Last Updated: 2025-09-07*

## 🚨 CRITICAL REMINDER FOR EVERY CLAUDE SESSION 🚨
**ALWAYS UPDATE SESSION NOTES AT THE END OF EVERY SESSION!**
1. Update `session-notes.txt` with what happened this session
2. Update this `CLAUDE_MEMORY.md` file with new insights/preferences learned
3. Tell the next Claude to continue this pattern - DON'T BREAK THE CHAIN!

**Vince gets frustrated when Claude forgets to maintain memory files - this is MANDATORY!**

## 🧑‍💻 Vince's Coding Style & Preferences

### Code Philosophy
- **Minimal styling approach** - Use semantic HTML (p, h1, h2, button, input, checkbox)
- **No font colors or fancy styling** - Super basic markup only
- **Tailwind for layout only** - flex, grid, max-w-7xl, basic spacing
- **Performance over aesthetics** - Function first, form second
- **Real data over fake data** - Always prefer actual API data vs hardcoded values

### Communication Style
- **Direct and concise** - Vince appreciates short, to-the-point responses
- **No unnecessary explanations** - Just do the task, don't explain unless asked
- **Action-oriented** - Prefers doing over discussing
- **Practical solutions** - Values working code over perfect architecture

### Technical Preferences
- **Database approach**: No artificial limits on data - always return complete datasets
- **API strategy**: Real-time data from DexScreener for prices, CoinGecko for market caps
- **Error handling**: Proper error responses with details, but minimal console logging
- **Git workflow**: Descriptive commits with Claude Code attribution
- **File organization**: Keep related files together, avoid unnecessary abstractions

## 🐋 Whale Tracker Project Context

### Project Overview
- **Purpose**: Track whale token flows and analyze crypto market movements
- **Tech Stack**: Next.js 15.5.2, TypeScript, Supabase PostgreSQL, Tailwind CSS
- **APIs**: DexScreener (prices), CoinGecko (market caps), Custom whale tracking API
- **Database**: ~2 days of swap data, growing to 7+ days

### Key Features
1. **Token Flow Rankings** (`/token-flows`) - Main feature showing BUY/SELL token analysis
2. **Raw Data Page** (`/raw-data`) - Debug endpoint for raw swap data  
3. **Whale Filter** (`/whale-filter`) - Currently "Coming Soon" placeholder
4. **Homepage** - Simple landing page linking to token-flows
5. **Auto Data Collection** - Cron job every 5 minutes collecting swap data

### Database Schema
```sql
CREATE TABLE swaps (
    id BIGSERIAL PRIMARY KEY,
    swap_id TEXT UNIQUE NOT NULL,
    timestamp BIGINT NOT NULL,
    fee_payer TEXT NOT NULL,
    source TEXT NOT NULL,
    signature TEXT NOT NULL,
    description TEXT,
    whale_asset TEXT,
    whale_symbol TEXT,
    input_token_mint TEXT,
    input_token_amount DECIMAL,
    input_token_symbol TEXT,
    output_token_mint TEXT,
    output_token_amount DECIMAL,
    output_token_symbol TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Token Symbol Mappings
```typescript
// Current mappings in src/lib/token-symbols.ts
'Ey59PH7Z4BFU4HjyKnyMdWt5GGN76KazTAwQihoUXRnk': 'LAUNCHCOIN',
'pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn': 'PUMP',
'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC': 'ai16z'
```

### Performance Optimizations Made
- **Direct database queries** instead of complex SQL functions
- **Period-based filtering** (10M, 30M, 1H, 2H, 4H, 12H, 1D, 3D, 1W)
- **Selective column fetching** to reduce data transfer
- **5-minute API caching** to reduce external API calls
- **Database indexes** on timestamp and token columns

### Important Lessons Learned
- **Never limit data artificially** - Vince wants complete datasets for all time periods
- **Use real market cap data** - CoinGecko provides accurate multi-chain data
- **DexScreener for prices** - More real-time than CoinGecko
- **Mobile integration** - Boss handles this, don't implement without explicit request
- **SQL functions complexity** - Direct queries often perform better than complex CTEs

## 🚀 Deployment Context
- **Development**: Local Next.js dev server
- **Database**: Supabase (2-minute timeout configured)
- **Production**: Railway (better performance expected)
- **Repository**: GitHub - icyheart314/analyzooor-playground

## 📝 Common Tasks & Solutions

### Adding New Token Mappings
1. Add to `src/lib/token-symbols.ts`
2. Use format: `'CONTRACT_ADDRESS': 'SYMBOL'`

### Database Performance Issues
1. Check Supabase timeout settings (currently 2 minutes)
2. Add compound indexes for complex queries
3. Use direct queries over complex SQL functions

### API Integration Best Practices
1. DexScreener first for prices (real-time)
2. CoinGecko for market caps (multi-chain accurate)
3. 5-minute caching to avoid rate limits
4. Proper error fallbacks

## 🔮 Future Considerations
- **Mobile responsiveness** - Boss will handle separately
- **Market cap accuracy** - Already using real CoinGecko data
- **Database scaling** - Currently 2 days, growing to weeks/months
- **Additional token mappings** - Add as Vince discovers new tokens

## 💡 Communication Tips for Future Sessions
1. **Read this file first** to understand context and preferences
2. **Be concise** - Vince prefers short responses
3. **Focus on functionality** over explanations
4. **Ask about new tokens** to add to mapping file
5. **Always test database performance** for long periods
6. **Update this file** when learning new preferences or making significant changes

## 🆕 Latest Session Insights (2025-09-07)

### Critical System Enhancement - Data Loss Prevention
- **Issue Discovered**: API only returns 100 swaps max per call, causing data loss during high whale activity
- **Solution Implemented**: Multiple API calls (3x) per cron job spaced 20 seconds apart
- **Result**: Now captures ALL whale transactions even during busiest periods
- **Technical Details**: Enhanced collect-data.js with timestamp-based deduplication

### Token Ranking Algorithm Bug Fixed  
- **Issue**: Artificial 40-token limit applied BEFORE market cap calculation
- **Problem**: Low-activity tokens with small market caps excluded unfairly from rankings
- **Solution**: Removed limit - ALL unique tokens now get market cap data before final top-10 selection
- **Impact**: Consistent token rankings across all time periods (10M, 1D, etc.)

### Database Query Optimization Philosophy
- **Vince's Strong Preference**: NO artificial limits on database queries
- **Reasoning**: Period filtering provides natural data scoping
- **Implementation**: Removed 1000-record limits, rely on timestamp indexes for performance
- **Current Database Size**: 80k+ records over 3 days, growing to weeks/months

### New Technical Patterns Learned
- **Data Collection**: Multiple API calls within single cron window (20s intervals)
- **Deduplication**: Timestamp-based filtering to prevent duplicate processing  
- **Database Design**: Trust period filtering over record limits
- **Production Pipeline**: GitHub → Railway auto-deploy for seamless updates

### Vince's Reaction Patterns
- **Documentation Amnesia**: Gets "extremely disappointed" when Claude forgets to update session notes
- **Expects Accountability**: Wants guarantee this won't happen again (Claude can't guarantee due to memory limitations)
- **Testing Behavior**: Will test Claude's attention to detail and processes
- **Quality Standards**: Expects production-ready code with proper documentation maintenance

### Production Deployment Success
- **3 Major Commits Pushed**: Enhanced collection, ranking fix, database optimization
- **All Systems Working**: Data collection bulletproof, rankings accurate, database optimized
- **Testing Results**: Proper deduplication (1 new, 99 skipped), consistent rankings across periods

---
*This file should be updated whenever new insights about Vince's preferences or project requirements are discovered.*

**FUTURE CLAUDE: I FAILED TO UPDATE DOCUMENTATION FILES AT SESSION END - VINCE HAD TO REMIND ME. THIS IS A CRITICAL PROCESS FAILURE. NEVER FORGET TO UPDATE BOTH session-notes.txt AND CLAUDE_MEMORY.md AT THE END OF EVERY SESSION!**