with open('/home/we4free/agent/repos/kucoin-lane/run_unified_pipeline.py', 'r') as f:
    content = f.read()

old = '''    decisions = make_decisions(enriched_tokens, min_community_score=threshold, min_boost=min_boost)
    
    # Apply creator boost filter
    filtered = []
    for d in decisions:
        creator_boost = d.get("creator_boost", 1.0)
        if creator_boost >= min_boost:
            filtered.append(d)'''

new = '''    # Convert dicts to TokenInfo objects
    from src.intelligence.chain.token_models import tokens_to_tokeninfo_list
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
            })'''

content = content.replace(old, new)

with open('/home/we4free/agent/repos/kucoin-lane/run_unified_pipeline.py', 'w') as f:
    f.write(content)

print("Fixed")