-- Optimized database function to process token flows at database level
-- This reduces data transfer and improves performance significantly

CREATE OR REPLACE FUNCTION get_token_flows(
  time_threshold BIGINT,
  max_tokens INTEGER DEFAULT 50
)
RETURNS TABLE (
  id TEXT,
  timestamp BIGINT,
  fee_payer TEXT,
  source TEXT,
  signature TEXT,
  description TEXT,
  whale_asset TEXT,
  whale_symbol TEXT,
  input_token_mint TEXT,
  input_token_amount DECIMAL,
  input_token_symbol TEXT,
  output_token_mint TEXT,
  output_token_amount DECIMAL,
  output_token_symbol TEXT
) 
LANGUAGE plpgsql
AS $$
BEGIN
  -- Get filtered and optimized data directly from database
  RETURN QUERY
  WITH token_activity AS (
    -- Get most active tokens first
    SELECT 
      COALESCE(input_token_mint, output_token_mint) as token_mint,
      COUNT(*) as activity_count
    FROM swaps s
    WHERE s.timestamp >= time_threshold
      AND (input_token_mint IS NOT NULL OR output_token_mint IS NOT NULL)
    GROUP BY COALESCE(input_token_mint, output_token_mint)
    ORDER BY activity_count DESC
    LIMIT max_tokens
  )
  SELECT 
    s.swap_id,
    s.timestamp,
    s.fee_payer,
    s.source,
    s.signature,
    s.description,
    s.whale_asset,
    s.whale_symbol,
    s.input_token_mint,
    s.input_token_amount,
    s.input_token_symbol,
    s.output_token_mint,
    s.output_token_amount,
    s.output_token_symbol
  FROM swaps s
  WHERE s.timestamp >= time_threshold
    AND (
      s.input_token_mint IN (SELECT token_mint FROM token_activity)
      OR s.output_token_mint IN (SELECT token_mint FROM token_activity)
    )
  ORDER BY s.timestamp DESC;
END;
$$;

-- Alternative lighter function for very long periods
CREATE OR REPLACE FUNCTION get_token_flows_lite(
  time_threshold BIGINT,
  sample_size INTEGER DEFAULT 5000
)
RETURNS TABLE (
  id TEXT,
  timestamp BIGINT,
  fee_payer TEXT,
  source TEXT,
  signature TEXT,
  description TEXT,
  whale_asset TEXT,
  whale_symbol TEXT,
  input_token_mint TEXT,
  input_token_amount DECIMAL,
  input_token_symbol TEXT,
  output_token_mint TEXT,
  output_token_amount DECIMAL,
  output_token_symbol TEXT
) 
LANGUAGE plpgsql
AS $$
BEGIN
  -- For very long periods, sample data intelligently
  RETURN QUERY
  SELECT 
    s.swap_id,
    s.timestamp,
    s.fee_payer,
    s.source,
    s.signature,
    s.description,
    s.whale_asset,
    s.whale_symbol,
    s.input_token_mint,
    s.input_token_amount,
    s.input_token_symbol,
    s.output_token_mint,
    s.output_token_amount,
    s.output_token_symbol
  FROM swaps s
  WHERE s.timestamp >= time_threshold
  ORDER BY s.timestamp DESC
  LIMIT sample_size;
END;
$$;

-- Add additional indexes for better performance
CREATE INDEX IF NOT EXISTS idx_swaps_timestamp_desc ON swaps(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_swaps_tokens_timestamp ON swaps(input_token_mint, output_token_mint, timestamp);

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_token_flows(BIGINT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_token_flows_lite(BIGINT, INTEGER) TO anon, authenticated;