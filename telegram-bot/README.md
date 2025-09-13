# Whale Tracker Telegram Bot

A Telegram bot that monitors whale transactions on Solana and sends personalized alerts based on user-defined filters.

## Features

- **Real-time Monitoring**: Continuously monitors whale swaps from your API
- **Custom Filters**: Users can set filters for tokens, minimum purchase amounts, market cap limits, and blacklists
- **Interactive Menu**: Easy-to-use inline keyboard for managing filters
- **Deduplication**: Prevents duplicate notifications for the same transaction

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Create Telegram Bot**
   - Message @BotFather on Telegram
   - Create a new bot with `/newbot`
   - Copy the bot token

3. **Configure Environment**
   - Copy `.env.example` to `.env`
   - Set your `TELEGRAM_BOT_TOKEN`
   - Update `WHALE_API_URL` if needed

4. **Start the Bot**
   ```bash
   npm start
   ```

## Commands

- `/start` - Initialize account and show welcome message
- `/menu` - Show interactive filter management menu
- `/filters` - View current active filters
- `/help` - Show help information

## Filter Types

- **Token Whitelist**: Only track specific tokens (symbol or mint address)
- **Minimum Purchase**: Set minimum USD value for alerts
- **Maximum Market Cap**: Filter out tokens above certain market cap
- **Token Blacklist**: Ignore specific tokens

## API Integration

The bot fetches data from `/api/swaps` endpoint and applies user filters in real-time. Each swap is checked against all users' filters before sending notifications.