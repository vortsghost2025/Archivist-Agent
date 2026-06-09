import re

with open('S:/kucoin-lane/run_unified_pipeline.py', 'r') as f:
    content = f.read()

# Find and replace the make_trade_decisions wrapper function
old_func = '''def make_trade_decisions(
    dex_signals: List[Dict[str, Any]],
    pumpfun_tokens: List[Dict[str, Any]],
    creator_data: Dict[str, Any],
    config: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """Generate buy decisions from enriched signals."""
    from src.intelligence.trading_decision import make_trade_decisions as make_decisions
    
    logger.info("[4/5] Making trade decisions...")
    
    threshold = config.get("trading", {}).get("min_signal_score", 0.35)
    min_boost = config.get("trading", {}).get("min_creator_boost", 1.0)
    
    # Convert pumpfun_tokens to format expected by make_trade_decisions
    enriched_tokens = []
    for token in pumpfun_tokens:
        enriched_tokens.append({
            "mint": token.get("mint", ""),
            "symbol": token.get("ticker", "UNKNOWN"),
            "name": token.get("name", ""),
            "community_score": token.get("community_score", 0.0),
            "pre_launch_tier": "HIGH_CONFIDENCE" if token.get("community_score", 0) > 0.7 else "SPECULATIVE",
            "creator_wallet": token.get("creator", "unknown"),
            "creator_boost": 1.0,  # Will be enhanced by creator data
        })
    
    # Also add DEX signals that have mint addresses
    for signal in dex_signals:
        if signal.get("mint"):
            enriched_tokens.append({
                "mint": signal["mint"],
                "symbol": signal.get("symbol", "UNKNOWN"),
                "community_score": signal.get("composite_score", 0.0),
                "pre_launch_tier": "SPECULATIVE",
                "creator_wallet": signal.get("deployer", "unknown"),
                "creator_boost": 1.0,
            })
    
    decisions = make_decisions(enriched_tokens, min_community_score=threshold, min_boost=min_boost)
    
    # Apply creator boost filter
    filtered = []
    for d in decisions:
        creator_boost = d.get("creator_boost", 1.0)
        if creator_boost >= min_boost:
            filtered.append(d)
    
    logger.info(f"  Decisions: {len(decisions)} raw -> {len(filtered)} after creator boost filter (min={min_boost})")
    
    return filtered'''

new_func = '''def make_trade_decisions(
    dex_signals: List[Dict[str, Any]],
    pumpfun_tokens: List[Dict[str, Any]],
    creator_data: Dict[str, Any],
    config: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """Generate buy decisions from enriched signals."""
    from src.intelligence.trading_decision import make_trade_decisions as make_decisions
    from src.intelligence.chain.token_models import tokens_to_tokeninfo_list
    
    logger.info("[4/5] Making trade decisions...")
    
    threshold = config.get("trading", {}).get("min_signal_score", 0.35)
    min_boost = config.get("trading", {}).get("min_creator_boost", 1.0)
    
    # Convert pumpfun_tokens to TokenInfo format expected by make_trade_decisions
    enriched_tokens = []
    for token in pumpfun_tokens:
        enriched_tokens.append({
            "mint": token.get("mint", ""),
            "ticker": token.get("ticker", "UNKNOWN"),
            "creator": token.get("creator", "unknown"),
            "community_score": token.get("community_score", 0.0),
            "pre_launch_tier": "HIGH_CONFIDENCE" if token.get("community_score", 0) > 0.7 else "SPECULATIVE",
            "name": token.get("name", ""),
            "market_cap_usd": token.get("market_cap_usd", 0.0),
            "created_at": token.get("created_at", 0),
            "social_links": token.get("social_links", {}),
            "n_social_platforms": token.get("n_social_platforms", 0),
            "launch_platforms": token.get("launch_platforms", []),
            "creator_reputation": token.get("creator_reputation", 0.0),
            "description": token.get("description", ""),
            "price_usd": token.get("price_usd", 0.0),
            "liquidity_usd": token.get("liquidity_usd", 0.0),
            "volume_24h_usd": token.get("volume_24h_usd", 0.0),
            "source": "prelaunch",
        })
    
    # Also add DEX signals that have mint addresses
    for signal in dex_signals:
        if signal.get("mint"):
            enriched_tokens.append({
                "mint": signal["mint"],
                "ticker": signal.get("symbol", "UNKNOWN"),
                "creator": signal.get("deployer", "unknown"),
                "community_score": signal.get("composite_score", 0.0),
                "pre_launch_tier": "SPECULATIVE",
                "source": "dex",
            })
    
    # Convert dicts to TokenInfo objects
    token_infos = tokens_to_tokeninfo_list(enriched_tokens)
    
    decisions = make_decisions(token_infos, min_community_score=threshold, min_boost=min_boost)
    
    # Convert TradeDecision objects back to dicts for compatibility
    filtered = []
    for d in decisions:
        creator_boost = d.boost
        if creator_boost >= min_boost:
            filtered.append({
                "mint": d.token.mint,
                "symbol": d.token.ticker,
                "action": d.action,
                "confidence": d.confidence,
                "boost": d.boost,
                "reason": d.reason,
                "suggested_size_pct": d.suggested_size_pct,
                "creator_boost": d.boost,
            })
    
    logger.info(f"  Decisions: {len(decisions)} raw -> {len(filtered)} after creator boost filter (min={min_boost})")
    
    return filtered'''

content = content.replace(old_func, new_func)

with open('S:/kucoin-lane/run_unified_pipeline.py', 'w') as f:
    f.write(content)

print("Wrapper function updated")