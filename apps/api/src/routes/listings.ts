import { FastifyInstance } from 'fastify';
import { supabase } from '../lib/db';
import { getValueScore, isKnownTypeId, getAllItemTypes } from '../services/value';
import { findMatch } from '../services/matching';

export default async function (fastify: FastifyInstance) {

    /**
     * GET /api/item-types
     * Returns all known item types for frontend dropdowns.
     */
    fastify.get('/item-types', async (_request, _reply) => {
        const items = await getAllItemTypes();
        return {
            success: true,
            items,
            source: 'world-api-or-fallback-registry',
        };
    });

    /**
     * POST /api/listings
     * Create a new trade intent listing.
     * 
     * Body: {
     *   owner_wallet:    string  (Sui address)
     *   have_type_id:    number  (EVE item type_id)
     *   have_qty:        number
     *   want_type_id:    number  (EVE item type_id)
     *   want_qty:        number
     *   ssu_object_id:   string  (SSU StorageUnit object ID on Sui, optional)
     *   intent_tx_digest: string (tx digest from on-chain intent registration, optional)
     * }
     */
    fastify.post('/listings', async (request, reply) => {
        const {
            owner_wallet,
            have_type_id,
            have_qty,
            want_type_id,
            want_qty,
            ssu_object_id,
            intent_tx_digest,
        } = request.body as any;

        // Validate required fields
        if (!owner_wallet || !have_type_id || !have_qty || !want_type_id || !want_qty) {
            return reply.status(400).send({
                error: 'Missing required fields: owner_wallet, have_type_id, have_qty, want_type_id, want_qty'
            });
        }

        // Validate type_ids are known
        if (!(await isKnownTypeId(Number(have_type_id)))) {
            return reply.status(400).send({ error: `Unknown have_type_id: ${have_type_id}` });
        }
        if (!(await isKnownTypeId(Number(want_type_id)))) {
            return reply.status(400).send({ error: `Unknown want_type_id: ${want_type_id}` });
        }

        // Can't list an item trading with itself
        if (Number(have_type_id) === Number(want_type_id)) {
            return reply.status(400).send({ error: 'have_type_id and want_type_id must be different' });
        }

        const value_score = await getValueScore(Number(have_type_id), Number(have_qty));

        const { data, error } = await supabase
            .from('listings')
            .insert([{
                owner_wallet,
                have_type_id: Number(have_type_id),
                have_qty: Number(have_qty),
                want_type_id: Number(want_type_id),
                want_qty: Number(want_qty),
                value_score,
                ssu_object_id: ssu_object_id ?? null,
                intent_tx_digest: intent_tx_digest ?? null,
                status: 'open',
            }])
            .select('*')
            .single();

        if (error) {
            return reply.status(500).send({ error: error.message });
        }

        // Run matching engine immediately after posting
        const match = await findMatch(data);

        return { success: true, listing: data, match_found: !!match, match };
    });

    /**
     * GET /api/listings
     * Fetch all open listings, or a specific owner's listings.
     * 
     * Query params:
     *   owner?: string  - filter by wallet address (for dashboard)
     *   have_type_id?: number  - filter by offered item
     *   want_type_id?: number  - filter by requested item
     */
    fastify.get('/listings', async (request, reply) => {
        const { owner, have_type_id, want_type_id } = request.query as {
            owner?: string;
            have_type_id?: string;
            want_type_id?: string;
        };

        let query = supabase
            .from('listings')
            .select(`
                *,
                have_item:item_types!listings_have_type_id_fkey(type_id, name, category, base_value),
                want_item:item_types!listings_want_type_id_fkey(type_id, name, category, base_value)
            `);

        if (owner) {
            query = query.eq('owner_wallet', owner).order('created_at', { ascending: false });
        } else {
            query = query.eq('status', 'open').order('created_at', { ascending: false });
        }

        if (have_type_id) {
            query = query.eq('have_type_id', Number(have_type_id));
        }
        if (want_type_id) {
            query = query.eq('want_type_id', Number(want_type_id));
        }

        const { data, error } = await query;

        if (error) {
            return reply.status(500).send({ error: error.message });
        }

        // Enrich with match status for dashboard view
        if (owner && data) {
            const enriched = await Promise.all(data.map(async (l) => {
                if (l.status === 'open') {
                    const match = await findMatch(l);
                    return { ...l, match_found: !!match, match };
                }
                return { ...l, match_found: false, match: null };
            }));
            return { success: true, listings: enriched };
        }

        return { success: true, listings: data };
    });

    /**
     * DELETE /api/listings/:id
     * Cancel an open listing (owner only check is done client-side via wallet).
     */
    fastify.delete('/listings/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const { owner_wallet } = request.body as { owner_wallet: string };

        const { error } = await supabase
            .from('listings')
            .update({ status: 'cancelled' })
            .eq('id', id)
            .eq('owner_wallet', owner_wallet)
            .eq('status', 'open');

        if (error) {
            return reply.status(500).send({ error: error.message });
        }

        return { success: true, message: 'Listing cancelled' };
    });
}