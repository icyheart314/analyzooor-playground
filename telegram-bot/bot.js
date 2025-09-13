const { Bot, InlineKeyboard } = require('grammy');
const cron = require('node-cron');
const UserDatabase = require('./database');
const FilterEngine = require('./filters');

// Load environment variables
require('dotenv').config();

class WhaleBot {
  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN;
    this.apiUrl = process.env.WHALE_API_URL || 'http://localhost:3000/api/swaps';
    this.pollingInterval = process.env.POLLING_INTERVAL || 30;
    
    if (!this.token) {
      console.error('TELEGRAM_BOT_TOKEN not found in environment variables');
      process.exit(1);
    }

    this.bot = new Bot(this.token);
    this.db = new UserDatabase();
    this.filterEngine = new FilterEngine();
    
    this.setupCommands();
    this.startMonitoring();
  }

  setupCommands() {
    // Start command
    this.bot.command('start', async (ctx) => {
      const chatId = ctx.chat.id;
      const username = ctx.from.username;
      
      await this.db.addUser(chatId, username);
      
      const welcomeMessage = `🐋 Welcome to Whale Tracker Bot!

I monitor Solana whale transactions and send personalized alerts.

**⚠️ Bot starts OFF by default**
Use /menu to:
• Turn the bot ON 🔔
• Choose: All Tokens or Token Filter mode
• Configure your filters

Get started with /menu!`;

      await ctx.reply(welcomeMessage);
    });

    // Menu command
    this.bot.command('menu', (ctx) => {
      this.showMainMenu(ctx.chat.id);
    });

    // Help command
    this.bot.command('help', async (ctx) => {
      const helpText = `🐋 Whale Tracker Bot Help

Commands:
/start - Initialize your account
/menu - Configure filters and settings
/filters - View your current filters
/help - Show this help message

Filter Types:
• Token Whitelist - Track specific tokens only
• Minimum Purchase - Set USD threshold for alerts
• Maximum Market Cap - Filter out high market cap tokens
• Token Blacklist - Ignore specific tokens

The bot monitors whale transactions every ${this.pollingInterval} seconds and sends alerts when transactions match your filters.`;

      await ctx.reply(helpText);
    });

    // Filters command
    this.bot.command('filters', async (ctx) => {
      const chatId = ctx.chat.id;
      const filters = await this.db.getUserFilters(chatId);
      
      if (filters.length === 0) {
        await ctx.reply('❌ You have no active filters. Use /menu to set up filters.');
        return;
      }

      let filtersText = '🔍 Your Active Filters:\n\n';
      
      const filterGroups = {
        token_whitelist: '✅ Token Whitelist',
        min_purchase: '💰 Minimum Purchase',
        max_market_cap: '📊 Maximum Market Cap', 
        token_blacklist: '🚫 Token Blacklist',
        whale_blacklist: '🐋 Whale Blacklist'
      };

      for (const [type, title] of Object.entries(filterGroups)) {
        const typeFilters = filters.filter(f => f.filter_type === type);
        if (typeFilters.length > 0) {
          filtersText += `${title}:\n`;
          typeFilters.forEach(filter => {
            filtersText += `  • ${filter.filter_value}\n`;
          });
          filtersText += '\n';
        }
      }

      await ctx.reply(filtersText);
    });

    // Handle callback queries (inline keyboard buttons)
    this.bot.on('callback_query', async (ctx) => {
      const data = ctx.callbackQuery.data;
      const chatId = ctx.chat.id;

      try {
        if (data === 'add_token') {
          await ctx.reply('Enter token symbol or mint address to whitelist:', {
            reply_markup: { force_reply: true }
          });
          this.awaitingInput[chatId] = 'token_whitelist';
          
        } else if (data === 'add_min_purchase') {
          await ctx.reply('Enter minimum purchase amount in USD:', {
            reply_markup: { force_reply: true }
          });
          this.awaitingInput[chatId] = 'min_purchase';
          
        } else if (data === 'add_max_market_cap') {
          await ctx.reply('Enter maximum market cap in USD:', {
            reply_markup: { force_reply: true }
          });
          this.awaitingInput[chatId] = 'max_market_cap';
          
        } else if (data === 'add_blacklist') {
          await ctx.reply('Enter token symbol or mint address to blacklist:', {
            reply_markup: { force_reply: true }
          });
          this.awaitingInput[chatId] = 'token_blacklist';
          
        } else if (data === 'add_whale_blacklist') {
          await ctx.reply('Enter whale address to blacklist:', {
            reply_markup: { force_reply: true }
          });
          this.awaitingInput[chatId] = 'whale_blacklist';
          
        } else if (data === 'view_filters') {
          await this.showFilters(chatId);
          
        } else if (data === 'toggle_monitor_mode') {
          const filters = await this.db.getUserFilters(chatId);
          const processedFilters = this.filterEngine.processFilters(filters);
          const newValue = !processedFilters.monitor_all;
          
          // Clear all monitor_all filters first
          await this.db.clearFilters(chatId, 'monitor_all');
          // Add new monitor_all filter
          await this.db.addFilter(chatId, 'monitor_all', newValue.toString());
          
          await ctx.reply(`✅ Monitor mode changed to: ${newValue ? 'All Tokens' : 'Token Filter'}`);
          
          // Small delay to ensure database update completes
          setTimeout(() => {
            this.showMainMenu(chatId);
          }, 100);
          
        } else if (data === 'toggle_notifications') {
          const filters = await this.db.getUserFilters(chatId);
          const processedFilters = this.filterEngine.processFilters(filters);
          const newValue = !processedFilters.notifications_enabled;
          
          // Clear all notifications_enabled filters first
          await this.db.clearFilters(chatId, 'notifications_enabled');
          // Add new notifications_enabled filter
          await this.db.addFilter(chatId, 'notifications_enabled', newValue.toString());
          
          await ctx.reply(`${newValue ? '🔔' : '🔕'} Pingoor notifications ${newValue ? 'enabled' : 'disabled'}!`);
          
          // Small delay to ensure database update completes
          setTimeout(() => {
            this.showMainMenu(chatId);
          }, 100);
          
        } else if (data === 'clear_all_filters') {
          await this.db.clearFilters(chatId);
          
          // Auto-disable notifications when filters are cleared
          await this.db.addFilter(chatId, 'notifications_enabled', 'false');
          
          await ctx.reply('✅ All filters cleared!\n\n⚠️ Pingooor has been automatically turned OFF. Use /menu to turn it back ON when you\'re ready.');
          
        } else if (data === 'back_to_menu') {
          this.showMainMenu(chatId);
          
        } else if (data.startsWith('del_')) {
          // Handle individual filter deletion using index
          const [, shortType, filterIndex] = data.split('_');
          const index = parseInt(filterIndex);
          
          // Map short types back to full filter types
          const typeMapping = {
            'tw': 'token_whitelist',
            'mp': 'min_purchase', 
            'mc': 'max_market_cap',
            'tb': 'token_blacklist',
            'wb': 'whale_blacklist'
          };
          
          const filterType = typeMapping[shortType];
          
          try {
            const filters = await this.db.getUserFilters(chatId);
            const typeFilters = filters.filter(f => f.filter_type === filterType);
            
            console.log(`Debug: Deleting filter - shortType: ${shortType}, fullType: ${filterType}, index: ${index}`);
            console.log(`Debug: Available filters:`, typeFilters);
            
            if (index >= 0 && index < typeFilters.length) {
              const filterToDelete = typeFilters[index];
              await this.db.removeFilter(chatId, filterType, filterToDelete.filter_value);
              
              // Auto-disable notifications when filters are modified
              await this.db.clearFilters(chatId, 'notifications_enabled');
              await this.db.addFilter(chatId, 'notifications_enabled', 'false');
              
              await ctx.reply(`✅ Filter removed: ${filterToDelete.filter_value}\n\n⚠️ Pingooor has been automatically turned OFF due to filter changes. Use /menu to turn it back ON when you're done configuring.`);
              
              // Show updated filters after deletion
              setTimeout(() => {
                this.showFilters(chatId);
              }, 100);
            } else {
              console.log(`Debug: Filter not found - requested index ${index}, available count ${typeFilters.length}`);
              await ctx.reply('❌ Filter not found. Please try again.');
            }
            
          } catch (error) {
            console.error('Delete filter error:', error);
            await ctx.reply('❌ Error removing filter. Please try again.');
          }
        }

        await ctx.answerCallbackQuery();
      } catch (error) {
        console.error('Callback query error:', error);
        await ctx.answerCallbackQuery('Error processing request');
      }
    });

    // Handle text messages (filter input)
    this.awaitingInput = {};
    
    this.bot.on('message:text', async (ctx) => {
      const chatId = ctx.chat.id;
      const text = ctx.message.text;
      
      // Skip if it's a command
      if (text.startsWith('/')) return;
      
      // Check if we're waiting for input
      if (this.awaitingInput[chatId]) {
        const filterType = this.awaitingInput[chatId];
        delete this.awaitingInput[chatId];
        
        try {
          if (filterType === 'min_purchase' || filterType === 'max_market_cap') {
            const value = parseInt(text);
            if (isNaN(value) || value <= 0 || text.includes('.')) {
              await ctx.reply('❌ Please enter a valid positive whole number (no decimals).');
              return;
            }
            // Clear existing values for single-value filters
            await this.db.clearFilters(chatId, filterType);
          }
          
          // Check limits for multi-value filters
          if (filterType === 'token_whitelist' || filterType === 'token_blacklist' || filterType === 'whale_blacklist') {
            const existingFilters = await this.db.getUserFilters(chatId);
            const existingCount = existingFilters.filter(f => f.filter_type === filterType).length;
            
            if (existingCount >= 20) {
              await ctx.reply('❌ Maximum 20 items allowed for this filter type. Clear some first.');
              return;
            }
          }
          
          await this.db.addFilter(chatId, filterType, text);
          
          // Auto-disable notifications when filters are modified
          await this.db.clearFilters(chatId, 'notifications_enabled');
          await this.db.addFilter(chatId, 'notifications_enabled', 'false');
          
          await ctx.reply(`✅ Filter added successfully!\n\n⚠️ Pingooor has been automatically turned OFF due to filter changes. Use /menu to turn it back ON when you're done configuring.`);
          
        } catch (error) {
          console.error('Add filter error:', error);
          await ctx.reply('❌ Error adding filter. Please try again.');
        }
      }
    });

    // Error handling
    this.bot.catch((err) => {
      console.error('Bot error:', err);
    });
  }

  async showMainMenu(chatId) {
    // Get current settings
    const filters = await this.db.getUserFilters(chatId);
    const processedFilters = this.filterEngine.processFilters(filters);
    
    const keyboard = new InlineKeyboard()
      .text(processedFilters.monitor_all ? '⚪ Token Filter' : '🔵 Monitor All Tokens', 'toggle_monitor_mode').row()
      .text(processedFilters.notifications_enabled ? '🔕 Turn OFF' : '🔔 Turn ON', 'toggle_notifications').row()
      .text('➕ Add Token Whitelist', 'add_token').row()
      .text('💰 Set Min Purchase', 'add_min_purchase').row()
      .text('📊 Set Max Market Cap', 'add_max_market_cap').row()
      .text('🚫 Add Token Blacklist', 'add_blacklist').row()
      .text('🐋 Add Whale Blacklist', 'add_whale_blacklist').row()
      .text('🔍 View Filters', 'view_filters')
      .text('🗑️ Clear All', 'clear_all_filters');

    const menuText = `🐋 Whaleooor Pingooor Settings

**Current Status:**
• Monitor Mode: ${processedFilters.monitor_all ? 'All Tokens' : 'Token Filter'}
• Pingoor: ${processedFilters.notifications_enabled ? 'ON 🔔' : 'OFF 🔕'}

**How it works:**
• **All Tokens + ON**: Get alerts for all whale transactions (use blacklist to exclude)
• **Token Filter + ON**: Only get alerts for whitelisted tokens
• **OFF**: No notifications (bot is paused)

**Configure your settings:**
• **Monitor Mode**: All Tokens vs Token Filter
• **Pingoor Toggle**: Turn bot ON/OFF
• **Token Whitelist**: Add tokens to monitor (Token Filter mode)
• **Token Blacklist**: Exclude tokens (All Tokens mode)
• **Whale Blacklist**: Block specific whale addresses
• **Min Purchase/Max Market Cap**: Additional filters

Choose an option below:`;

    try {
      await this.bot.api.sendMessage(chatId, menuText, {
        reply_markup: keyboard,
        parse_mode: 'Markdown'
      });
    } catch (error) {
      console.error('Menu display error:', error);
    }
  }

  async showFilters(chatId) {
    const filters = await this.db.getUserFilters(chatId);
    
    if (filters.length === 0) {
      await this.bot.api.sendMessage(chatId, '❌ You have no active filters.');
      return;
    }

    let filtersText = '🔍 Your Active Filters:\n\n';
    const keyboard = new InlineKeyboard();
    
    const filterGroups = {
      token_whitelist: '✅ Token Whitelist',
      min_purchase: '💰 Minimum Purchase',
      max_market_cap: '📊 Maximum Market Cap',
      token_blacklist: '🚫 Token Blacklist',
      whale_blacklist: '🐋 Whale Blacklist'
    };

    // Short filter type mapping for callback data
    const shortTypes = {
      token_whitelist: 'tw',
      min_purchase: 'mp',
      max_market_cap: 'mc', 
      token_blacklist: 'tb',
      whale_blacklist: 'wb'
    };

    for (const [type, title] of Object.entries(filterGroups)) {
      const typeFilters = filters.filter(f => f.filter_type === type);
      if (typeFilters.length > 0) {
        filtersText += `${title}:\n`;
        typeFilters.forEach((filter, index) => {
          filtersText += `  • ${filter.filter_value}\n`;
          // Add delete button for each filter using short type and index
          const shortValue = filter.filter_value.length > 8 ? 
            filter.filter_value.slice(0, 8) + '...' : filter.filter_value;
          keyboard.text(`❌ ${shortValue}`, `del_${shortTypes[type]}_${index}`).row();
        });
        filtersText += '\n';
      }
    }

    keyboard.text('🔙 Back to Menu', 'back_to_menu');

    await this.bot.api.sendMessage(chatId, filtersText + '\n💡 Tap ❌ to delete individual filters', {
      reply_markup: keyboard
    });
  }

  startMonitoring() {
    console.log(`🐋 Starting whale monitoring every ${this.pollingInterval} seconds...`);
    
    // Run every X seconds based on POLLING_INTERVAL
    cron.schedule(`*/${this.pollingInterval} * * * * *`, async () => {
      try {
        await this.checkForNewSwaps();
      } catch (error) {
        console.error('Monitoring error:', error);
      }
    });
  }

  async checkForNewSwaps() {
    try {
      console.log('🔍 Checking for new swaps...');
      // Fetch latest swaps from the API
      const response = await fetch(this.apiUrl);
      if (!response.ok) {
        console.error(`API request failed: ${response.status}`);
        return;
      }

      const swaps = await response.json();
      console.log(`📊 Found ${swaps?.length || 0} swaps from API`);
      if (!Array.isArray(swaps) || swaps.length === 0) {
        return;
      }

      // Get all users
      const users = await this.db.getAllUsers();
      console.log(`👥 Found ${users?.length || 0} users in database`);
      
      // Process each swap against each user's filters
      for (const user of users) {
        try {
          const filters = await this.db.getUserFilters(user.telegram_id);
          
          let matchingSwaps = 0;
          for (const swap of swaps) {
            const shouldNotify = await this.filterEngine.shouldNotify(user.telegram_id, swap, filters);
            if (shouldNotify) {
              matchingSwaps++;
              const notification = await this.filterEngine.formatNotification(swap);
              await this.bot.api.sendMessage(user.telegram_id, notification, {
                parse_mode: 'Markdown',
                disable_web_page_preview: true
              });
            }
          }
          if (matchingSwaps > 0) {
            console.log(`📤 Sent ${matchingSwaps} notifications to user ${user.telegram_id}`);
          }
        } catch (userError) {
          console.error(`Error processing user ${user.telegram_id}:`, userError);
        }
      }
      
    } catch (error) {
      console.error('Error checking swaps:', error);
    }
  }

  start() {
    console.log('🚀 Whale Tracker Bot starting...');
    this.bot.start();
    console.log('✅ Bot is running!');
  }

  stop() {
    console.log('🛑 Stopping bot...');
    this.bot.stop();
  }
}

// Create and start the bot
const whaleBot = new WhaleBot();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  whaleBot.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  whaleBot.stop();
  process.exit(0);
});

// Start the bot
whaleBot.start();