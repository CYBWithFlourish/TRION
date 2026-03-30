import React, { useEffect, useState } from 'react';
import { useCurrentAccount, useDAppKit } from '@mysten/dapp-kit-react';
import { API_BASE_URL, TRADE_COIN_TYPE_A, TRADE_COIN_TYPE_B } from '../lib/sui';
import { executeTradeTx } from '../lib/vault';

interface Listing {
  id: string;
  owner_wallet: string;
  have_type_id: number;
  have_qty: number;
  want_type_id: number;
  want_qty: number;
  value_score: number;
  status: string;
  have_item: { name: string; category: string };
  want_item: { name: string; category: string };
}

interface MatchResult {
  listing_id: string;
  matched_listing_id: string;
  listing_ssu_object_id: string;
  matched_ssu_object_id: string;
  score_delta: number;
  trade_type: 'direct' | 'bundle';
}

const extractDigest = (result: any): string | null => {
  return result?.digest || result?.effects?.transactionDigest || result?.Transaction?.digest || result?.FailedTransaction?.digest || null;
};

export const Orderbook = () => {
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [statusByListingId, setStatusByListingId] = useState<Record<string, string>>({});

  const setStatus = (listingId: string, message: string) => {
    setStatusByListingId(prev => ({ ...prev, [listingId]: message }));
  };

  const loadListings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/listings`);
      const data = await response.json();
      if (data.success) {
        setListings(data.listings);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadListings();
  }, []);

  const executeSettlement = async (listing: Listing) => {
    if (!account) {
      setStatus(listing.id, 'Connect wallet to execute settlement.');
      return;
    }

    if (listing.owner_wallet === account.address) {
      setStatus(listing.id, 'You cannot settle your own listing.');
      return;
    }

    setExecutingId(listing.id);
    setStatus(listing.id, 'Finding best counterparty...');

    try {
      const matchResponse = await fetch(`${API_BASE_URL}/match/${listing.id}`);
      const matchData = await matchResponse.json();

      if (!matchData.success || !matchData.match) {
        setStatus(listing.id, 'No compatible match is available yet.');
        return;
      }

      const match = matchData.match as MatchResult;
      if (!match.listing_ssu_object_id || !match.matched_ssu_object_id) {
        setStatus(listing.id, 'Settlement requires both listings to include escrow object IDs.');
        return;
      }

      setStatus(listing.id, 'Submitting on-chain trade transaction...');
      const tx = executeTradeTx(
        match.listing_ssu_object_id,
        match.matched_ssu_object_id,
        TRADE_COIN_TYPE_A,
        TRADE_COIN_TYPE_B,
      );

      const txResult = await dAppKit.signAndExecuteTransaction({ transaction: tx as any });
      const txDigest = extractDigest(txResult);
      if (!txDigest) {
        throw new Error('Transaction digest was not returned by wallet client.');
      }

      setStatus(listing.id, 'Recording settlement in protocol indexer...');
      const recordResponse = await fetch(`${API_BASE_URL}/trade/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id: match.listing_id,
          matched_listing_id: match.matched_listing_id,
          tx_digest: txDigest,
        }),
      });

      const recordData = await recordResponse.json();
      if (!recordData.success) {
        throw new Error(recordData.error || 'Trade record update failed.');
      }

      setStatus(listing.id, `Settlement complete: ${txDigest}`);
      await loadListings();
    } catch (err: any) {
      setStatus(listing.id, `Settlement failed: ${err.message}`);
    } finally {
      setExecutingId(null);
    }
  };

  if (loading) {
    return <div className="loading-state">Syncing Global Ledger...</div>;
  }

  return (
    <div className="orderbook-container">
      <div className="orderbook-header">
        <h2 className="glow-text-blue">Live Orderbook</h2>
        <p className="text-muted">Real-time trade intents across the Frontier</p>
      </div>

      <div className="listings-grid">
        {listings.length === 0 ? (
          <div className="empty-state glass-panel">
            <p>No active trade intents found.</p>
          </div>
        ) : (
          listings.map(l => (
            <div key={l.id} className="listing-card glass-panel">
              <div className="card-top">
                <span className="wallet-tag">{l.owner_wallet.slice(0, 6)}...{l.owner_wallet.slice(-4)}</span>
                <span className={`status-tag ${l.status}`}>{l.status}</span>
              </div>
              
              <div className="swap-details">
                <div className="asset-side">
                  <span className="label">OFFERING</span>
                  <span className="qty">{l.have_qty}</span>
                  <span className="name">{l.have_item?.name || `ID ${l.have_type_id}`}</span>
                </div>
                
                <div className="swap-arrow">→</div>
                
                <div className="asset-side text-right">
                  <span className="label">SEEKING</span>
                  <span className="qty text-green">{l.want_qty}</span>
                  <span className="name">{l.want_item?.name || `ID ${l.want_type_id}`}</span>
                </div>
              </div>

              <div className="card-footer">
                <span className="score">Value Score: {l.value_score}</span>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => executeSettlement(l)}
                  disabled={executingId === l.id || !account || l.owner_wallet === account?.address}
                >
                  {executingId === l.id ? 'Settling...' : 'Settle Trade'}
                </button>
              </div>
              <div className="listing-status-msg">{statusByListingId[l.id] || ''}</div>
            </div>
          ))
        )}
      </div>


    </div>
  );
};
