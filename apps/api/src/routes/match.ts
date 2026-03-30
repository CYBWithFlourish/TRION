import { FastifyInstance } from 'fastify';
import { findMatch } from '../services/matching';
import { supabase } from '../lib/db';

export default async function (fastify: FastifyInstance) {

    /**
     * GET /api/match/:listingId
     * Find the best match for a given listing.
     */
    fastify.get('/match/:listingId', async (request, reply) => {
        const { listingId } = request.params as { listingId: string };

        const { data: listing, error } = await supabase
            .from('listings')
            .select('*')
            .eq('id', listingId)
            .single();

        if (error || !listing) {
            return reply.status(404).send({ error: 'Listing not found' });
        }

        if (listing.status !== 'open') {
            return reply.status(409).send({
                error: `Listing is not open (status: ${listing.status})`
            });
        }

        const match = await findMatch(listing);

        return { success: true, match };
    });
}