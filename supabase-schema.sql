-- Whale Tracker Supabase Database Schema
-- Table: swaps

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

-- Create indexes for better performance
CREATE INDEX idx_swaps_timestamp ON swaps(timestamp);
CREATE INDEX idx_swaps_input_token ON swaps(input_token_mint);
CREATE INDEX idx_swaps_output_token ON swaps(output_token_mint);
CREATE INDEX idx_swaps_created_at ON swaps(created_at);