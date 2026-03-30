import { supabase } from '../lib/db';

export interface Listing {
    id: string;
    owner_wallet: string;
    have_type_id: number;       // EVE Frontier on-chain item type_id (u64)
    have_qty: number;
    want_type_id: number;       // EVE Frontier on-chain item type_id (u64)
    want_qty: number;
    value_score: number;
    ssu_object_id: string | null;  // SSU StorageUnit object ID on Sui
    intent_tx_digest: string | null;
    status: string;
}

export interface MatchResult {
    listing_id: string;
    matched_listing_id: string;
    listing_ssu_object_id: string;
    matched_ssu_object_id: string;
    have_type_id: number;
    want_type_id: number;
    have_qty: number;
    want_qty: number;
    score_delta: number;
    trade_type: 'direct' | 'bundle';
}

/**
 * Core matching engine.
 * 
 * Finds a counterparty listing where:
 *   - their have_type_id == our want_type_id
 *   - their want_type_id == our have_type_id
 *   - status is open
 *   - not our own listing
 * 
 * Prefers exact value score match, falls back to closest available.
 */
export async function findMatch(listing: Listing): Promise<MatchResult | null> {
    const { data: potentialMatches, error } = await supabase
        .from('listings')
        .select('*')
        .eq('status', 'open')
        .eq('have_type_id', listing.want_type_id)   // they have what we want
        .eq('want_type_id', listing.have_type_id)   // they want what we have
        .neq('id', listing.id)
        .neq('owner_wallet', listing.owner_wallet); // can't trade with yourself

    if (error || !potentialMatches || potentialMatches.length === 0) {
        return null;
    }

    // Prefer exact value score match (score_delta = 0)
    // Fall back to closest score within 20% tolerance
    const TOLERANCE = listing.value_score * 0.2;

    const exactMatch = potentialMatches.find(
        m => Math.abs(m.value_score - listing.value_score) === 0
    );

    const closeMatch = potentialMatches
        .filter(m => Math.abs(m.value_score - listing.value_score) <= TOLERANCE)
        .sort((a, b) =>
            Math.abs(a.value_score - listing.value_score) -
            Math.abs(b.value_score - listing.value_score)
        )[0];

    const targetMatch = exactMatch ?? closeMatch ?? potentialMatches[0];

    return {
        listing_id: listing.id,
        matched_listing_id: targetMatch.id,
        listing_ssu_object_id: listing.ssu_object_id ?? '',
        matched_ssu_object_id: targetMatch.ssu_object_id ?? '',
        have_type_id: listing.have_type_id,
        want_type_id: listing.want_type_id,
        have_qty: listing.have_qty,
        want_qty: listing.want_qty,
        score_delta: Math.abs(targetMatch.value_score - listing.value_score),
        trade_type: 'direct',
    };
}