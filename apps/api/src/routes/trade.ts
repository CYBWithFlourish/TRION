import { FastifyInstance } from 'fastify';
import { supabase } from '../lib/db';

export default async function (fastify: FastifyInstance) {

    /**
     * GET /api/trade/flow
     * Describes settlement responsibilities explicitly.
     * The frontend signs and executes on-chain tx, then this API records result.
     */
    fastify.get('/trade/flow', async () => {
        return {
            success: true,
            settlement_mode: 'client-signed-onchain',
            api_role: 'records_confirmed_trade',
            steps: [
                'Frontend finds match via /api/match/:listingId',
                'User signs execute_trade transaction in wallet',
                'Frontend calls /api/trade/execute with tx_digest to finalize off-chain index state',
            ],
        };
    });

    /**
     * POST /api/trade/execute
     * Record a completed on-chain trade execution.
     * This endpoint does not submit transactions to chain.
     * It is called only after the client wallet signs and confirms the Sui tx.
     * 
     * Body: {
     *   listing_id:         string  (UUID of initiator listing)
     *   matched_listing_id: string  (UUID of counterparty listing)
     *   tx_digest:          string  (Sui transaction digest)
     * }
     */
    fastify.post('/trade/execute', async (request, reply) => {
        const { listing_id, matched_listing_id, tx_digest } = request.body as any;

        if (!listing_id || !matched_listing_id || !tx_digest) {
            return reply.status(400).send({
                error: 'Missing required fields: listing_id, matched_listing_id, tx_digest'
            });
        }

        // Fetch both listings to snapshot into the trade record
        const { data: listings, error: fetchError } = await supabase
            .from('listings')
            .select('*')
            .in('id', [listing_id, matched_listing_id]);

        if (fetchError || !listings || listings.length < 2) {
            return reply.status(404).send({ error: 'One or both listings not found' });
        }

        const initiator = listings.find(l => l.id === listing_id);
        const counterparty = listings.find(l => l.id === matched_listing_id);

        if (!initiator || !counterparty) {
            return reply.status(404).send({ error: 'Could not identify initiator and counterparty' });
        }

        // Both must still be open (prevent double-execution)
        if (initiator.status !== 'open' || counterparty.status !== 'open') {
            return reply.status(409).send({
                error: 'One or both listings are no longer open',
                initiator_status: initiator.status,
                counterparty_status: counterparty.status,
            });
        }

        // Record the trade with a full snapshot
        const { error: tradeError } = await supabase
            .from('trades')
            .insert([{
                listing_id,
                matched_listing_id,
                tx_digest,
                status: 'executed',
                initiator_wallet: initiator.owner_wallet,
                counterparty_wallet: counterparty.owner_wallet,
                have_type_id: initiator.have_type_id,
                have_qty: initiator.have_qty,
                want_type_id: initiator.want_type_id,
                want_qty: initiator.want_qty,
            }]);

        if (tradeError) {
            return reply.status(500).send({ error: tradeError.message });
        }

        // Mark both listings as completed atomically
        const { error: updateError } = await supabase
            .from('listings')
            .update({ status: 'completed' })
            .in('id', [listing_id, matched_listing_id]);

        if (updateError) {
            return reply.status(500).send({ error: updateError.message });
        }

        return {
            success: true,
            message: 'Trade executed and recorded',
            tx_digest,
            settlement_mode: 'client-signed-onchain',
            api_role: 'recorder-only',
        };
    });

    /**
     * GET /api/trades
     * Fetch trade history, optionally filtered by wallet.
     */
    fastify.get('/trades', async (request, reply) => {
        const { wallet } = request.query as { wallet?: string };

        let query = supabase
            .from('trades')
            .select(`
                *,
                have_item:item_types!trades_have_type_id_fkey(name, category),
                want_item:item_types!trades_want_type_id_fkey(name, category)
            `)
            .order('executed_at', { ascending: false })
            .limit(50);

        if (wallet) {
            query = query.or(`initiator_wallet.eq.${wallet},counterparty_wallet.eq.${wallet}`);
        }

        const { data, error } = await query;

        if (error) {
            return reply.status(500).send({ error: error.message });
        }

        return { success: true, trades: data };
    });
}