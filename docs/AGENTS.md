# Trion Protocol - Agent Instructions

## TRION - Trade Resource Interstellar Open Network
### The trade infrastructure layer for civilization in EVE Frontier.

## Project purpose
A decentralized trade protocol for EVE Frontier built as a Smart Storage Unit extension on Sui Move, with a Fastify API backend and Astro dApp.

## Rules
- Never modify contracts/ from the API or web agents. Contracts are a separate task scope.
- API services must return structured JSON always.
- Use TypeScript strict mode throughout apps/.
- Never hardcode wallet addresses. Use env vars.
- Supabase client lives in apps/api/src/lib/db.ts only. Don't duplicate it.

## Key interfaces
- Listing: { id, owner_wallet, have_asset, have_qty, want_asset, want_qty, value_score, status }
- Match result: { listing_id, matched_listing_id, score_delta, trade_type: "direct" | "bundle" }
- Trade execution: calls contracts/trion_core::trade::execute_trade() via Sui SDK

## Do not build yet (out of MVP scope)
- Bundle/multi-asset matching
- Liquidity pool
- Dynamic pricing
- Walrus

Full identity:

TRION - Trade Resource Interstellar Open Network
The trade infrastructure layer for civilization in EVE Frontier.

An intent-based in-game marketplace for EVE Frontier with off-chain discovery and on-chain settlement.

A decentralized trade intent protocol for EVE items.
Listings are posted as intents, matched off-chain, and settled on Sui with atomic vault swaps.