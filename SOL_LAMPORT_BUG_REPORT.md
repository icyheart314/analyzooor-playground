# Data Integrity Issues Report

## Issue #1: SOL Lamport Conversion (RESOLVED)

## Issue #2: False Transaction Data  

**Evidence:**
| Field | Value | Issue |
|-------|--------|--------|
| `description` | "swapped 3626.37 SPX for 15.765631682 SOL" | Wrong tokens entirely |
| `input_token_mint` | SOL | Description says SPX input |
| `output_token_mint` | CARDS | Description says SOL output |
| `input_token_amount` | 19.177638457 SOL | Description says 15.76 SOL |

**Raw Database Row:**
| id | source | description | input_token | input_amount | output_token | output_amount |
|----|--------|-------------|-------------|--------------|--------------|---------------|
| 649632 | RAYDIUM | swapped 3626.37 SPX for 15.765631682 SOL | SOL | 19.177638457 | CARDS | 45332.334605 |

**Problems:**
- Transaction description completely mismatched with actual token data
- Wrong token symbols in description vs database fields  
- Wrong amounts in description vs database fields
- Data collection storing incorrect transaction information

## Raw Data Evidence
| ID | Date | Whale Address | Source | SOL Amount (Raw) | Actual SOL | Token Traded | Signature |
|----|------|---------------|---------|------------------|------------|---------------|-----------|
| 668833 | Sep 10 22:20 | 2sJBiTy8T2...SwfV | PUMP_FUN | 991,500,000 | 0.9915 | FWOG→dsu | 4V8NZ65fE2NVkq41JDALsne4WcWMKaTEhNmBdhVqtxqdi8UDHEVbXZ2or5eMC6C2h2NwUP89fQnid8jaGeLYtB1P |
| 667574 | Sep 10 21:55 | 8VwmbW9V...txN7 | PUMP_FUN | 99,150,000 | 0.09915 | FARTCOIN→KIRKWIFHAT | 58egkcwTujyaHazSvgD25qEuRxongGPiTugt8mkthYXu4TUhtgMsESGkRgDSjjMdUNwjq5MMHtvRYhmCkuRdBgrd |
| 667326 | Sep 10 21:51 | FgaZ82gE...GLD2 | PUMP_FUN | 44,368,215 | 0.0444 | BERT→Never | 9yqTDLf2vLxfdQTsq5DEPJgvwy3C5hEXaZ4GASS52Gx18bLLfLm1FzEwdaSodFqab3AjWnQUmUovoJ15mVTqA5x |
| 599748 | Sep 9 23:12 | 2sJBiTy8T2...SwfV | PUMP_FUN | 1,983,000,000 | 1.983 | FWOG→SAPARi | 55dn2z9iXGPen6TLVPorBdFv8k5MoKJoExuA9rr1mHJ9ksYjArqUcCCAM4t7UDQmnhXX2HF8dL97VzK8iQz9TesD |
| 593291 | Sep 9 20:41 | 2sJBiTy8T2...SwfV | PUMP_FUN | 991,500,000 | 0.9915 | FWOG→burd | 2sZjBX5BVBuqMYYpNmyyRqEd2oTCTmT8uBHxv2gTcuT1Suj2ikoJ7sWQgpKW6niBfYkCDy1KnGwbZzM7MBnh1QMX |
| 593155 | Sep 9 20:37 | 2sJBiTy8T2...SwfV | PUMP_FUN | 1,983,000,000 | 1.983 | FWOG→burd | 3LEgTJDFAki9LmVAQkzrAPoF194DLDAtSU59bseR91Kxjdf3mcQLg7oT7mkEDDA9FHVdHmqt1P8HvfFJLro6X3ht |
| 388534 | Sep 7 22:17 | 2sJBiTy8T2...SwfV | PUMP_FUN | 1,586,400,000 | 1.586 | FWOG→dude | 526bfpAJobKgn8wmXvqjpiXr2jNCs5cu88GGC82YqwJ2UxHtV45qoLDaqpVD7mf6xrUKhXnTtgURox7jMmjwhxiV |
| 375189 | Sep 7 20:00 | 2sJBiTy8T2...SwfV | PUMP_FUN | 1,338,525,000 | 1.339 | FWOG→👜 | 2F7A1KZ2UR2pYQk2rPBfYHPSRVEzBA8b3GG99fBoRWetag4kYcGuJo6Zni6Ewjzy9uzwsLyeEtor5dV4teZLup2h |
| 345186 | Sep 7 15:06 | 2sJBiTy8T2...SwfV | PUMP_FUN | 2,577,900,000 | 2.578 | FWOG→dex | 33pDsZQ14pfJhjYbQHnGZkT6rizmt4xgsiTxvCQmtTQkRsNbxa3xSixT5sZJn8mWPDra8ieyatEmUUUVuyHwuSv8 |
| 338489 | Sep 7 14:00 | 2sJBiTy8T2...SwfV | PUMP_FUN | 2,974,500,000 | 2.975 | FWOG→Hornaeé | 5Z8aKWhHY8YuckFpUS111aESgEb53Y14mx5nxY7d4dgL5wgHqC2odfKX4irU9q5FevgPeF4rBcpKsLS7xAxmAE53 |
| 331301 | Sep 7 12:49 | 2sJBiTy8T2...SwfV | PUMP_FUN | 198,300,000 | 0.1983 | FWOG→freggor | 62VJRPeiVqRtoJsx3nWtBz51hJ2545vD6cEUDVSCTZM135azhFT9XGPeThUhzfeire3ooXVVCgdjADw57hAe7RbJ |
| 323178 | Sep 7 11:28 | 2sJBiTy8T2...SwfV | PUMP_FUN | 2,974,500,000 | 2.975 | FWOG→freggor | 3QQoZDiaTgYZ6JM75ptjywzZefWBDGK64F376KNNTq8ftxGTAy1vfZ4qMzt1L1xWwgS4QbrNE1hRK7miDboUHfFL |
| 268581 | Sep 7 02:31 | 2sJBiTy8T2...SwfV | PUMP_FUN | 2,875,350,000 | 2.875 | FWOG→freggor | vBTLyJ4PZpH5RQapSCeNdfzNbAarT9ZKFmPcAr1oQdXaGYGP47db9ZAdQ3QUsuKnBdYkdp2M7RNPwQo2a1TYZna |
| 194884 | Sep 6 14:24 | 2sJBiTy8T2...SwfV | PUMP_FUN | 1,983,000,000 | 1.983 | FWOG→STREAMER | 2KEkSjpvRXNusmaRVTSZd2vYMzQTS9A4j1Tdo3UPnZFycextGuEPoSvfRZwrZPAHBRr6az61DmUmRUCfsZD3NsTq |
| 190080 | Sep 6 13:36 | 2sJBiTy8T2...SwfV | PUMP_FUN | 4,957,500,000 | 4.958 | FWOG→STREAMER | 5ashxLNRYsYid3RjVBDVj6KXQybYTUZjCbTvcpCKoQjXBC1ezLCCKj7MzkkctETtuKnunsVH1JV7dGsS5mk3hU5E |
| 187679 | Sep 6 13:13 | FgaZ82gE...GLD2 | PUMP_FUN | 245,180,246 | 0.245 | BERT→std | 4hc53RX1S6RUL5cUMR2QoUqdVbQDdPERz6TE1mr6sPRLUQXpZVCCkZ2aYwHYsL7sqcExnrfurtMtjf4CJSNnKf1m |
| 102278 | Sep 5 23:08 | Dv32u9mv...ysZY | PUMP_FUN | 2,974,500,000 | 2.975 | FWOG→stream | 4LjknFZr1LcnpSbp974MKNmYQcjZbsAvFxeyZqjH4PpKzhSBAcWYkY4isM5a5hzXFvN9EmZ7c42qcuELTrXhj9u9 |
| 1501 | Sep 5 05:34 | 7ZqsUWZ4...jxa | PUMP_FUN | 356,940,000 | 0.357 | BERT→mememon | 5HVE1xPWGT4hG7yphMYTapjY9nUaCrrjoBCqe2yjkfA1LuRSEEMpStwvVuE6MuwxbbrapAWkE7xyTbCiLx4zG7Yi |
| 1556 | Sep 5 05:34 | 7ZqsUWZ4...jxa | PUMP_FUN | 14,872,500 | 0.0149 | BERT→mememon | 2XjnzwcNvmn1MTvFZqxzhvc86iLthivHdvyqtoVf4jKKduzoEcm7LAH6hCkRjM5YcGHofMZHb1xsarZttecQ3yDL |

**Transaction Links for Verification:**
- [solscan.io/tx/4V8NZ65fE...](https://solscan.io/tx/4V8NZ65fE2NVkq41JDALsne4WcWMKaTEhNmBdhVqtxqdi8UDHEVbXZ2or5eMC6C2h2NwUP89fQnid8jaGeLYtB1P)
- [solscan.io/tx/58egkcwT...](https://solscan.io/tx/58egkcwTujyaHazSvgD25qEuRxongGPiTugt8mkthYXu4TUhtgMsESGkRgDSjjMdUNwjq5MMHtvRYhmCkuRdBgrd)
- [solscan.io/tx/9yqTDLf2...](https://solscan.io/tx/9yqTDLf2vLxfdQTsq5DEPJgvwy3C5hEXaZ4GASS52Gx18bLLfLm1FzEwdaSodFqab3AjWnQUmUovoJ15mVTqA5x)

## Raw Data Inconsistency Pattern
**PUMP_FUN source**: Sends lamports (991500000 = 0.9915 SOL)
**Other sources**: Send decimal SOL (0.9915 = 0.9915 SOL)

System now automatically detects and converts based on amount size threshold (>1M = lamports).