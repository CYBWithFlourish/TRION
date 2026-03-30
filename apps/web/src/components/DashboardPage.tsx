import React, { useEffect, useState } from 'react';
import { GlobalWrapper } from './GlobalWrapper';
import { useCurrentAccount } from '@mysten/dapp-kit-react';
import { abbreviateAddress } from '@evefrontier/dapp-kit';
import { API_BASE_URL } from '../lib/sui';

interface Listing {
    id: string;
    status: string;
    have_qty: number;
    want_qty: number;
    have_item?: { name: string };
    want_item?: { name: string };
}

interface Trade {
    id: string;
    tx_digest: string;
    executed_at: string;
    have_qty: number;
    want_qty: number;
    have_item?: { name: string };
    want_item?: { name: string };
}

export const DashboardPage = () => {
    const account = useCurrentAccount();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [listings, setListings] = useState<Listing[]>([]);
    const [trades, setTrades] = useState<Trade[]>([]);

    useEffect(() => {
        if (!account?.address) {
            setListings([]);
            setTrades([]);
            return;
        }

        const loadDashboard = async () => {
            setLoading(true);
            setError('');

            try {
                const [listingsRes, tradesRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/listings?owner=${account.address}`),
                    fetch(`${API_BASE_URL}/trades?wallet=${account.address}`),
                ]);

                const [listingsData, tradesData] = await Promise.all([
                    listingsRes.json(),
                    tradesRes.json(),
                ]);

                if (!listingsData.success) {
                    throw new Error(listingsData.error || 'Failed to load listings');
                }
                if (!tradesData.success) {
                    throw new Error(tradesData.error || 'Failed to load trades');
                }

                setListings(listingsData.listings || []);
                setTrades(tradesData.trades || []);
            } catch (err: any) {
                setError(err.message || 'Failed to load dashboard');
            } finally {
                setLoading(false);
            }
        };

        loadDashboard();
    }, [account?.address]);

    const activeListingsCount = listings.filter((listing) => listing.status === 'open').length;

    return (
        <GlobalWrapper>
            <div className="dashboard-grid">
                <div className="glass-panel dashboard-stat">
                    <span className="label">ACTIVE INTENTS</span>
                    <span className="value">{account ? activeListingsCount : '-'}</span>
                </div>
                <div className="glass-panel dashboard-stat">
                    <span className="label">COMPLETED TRADES</span>
                    <span className="value">{account ? trades.length : '-'}</span>
                </div>
                <div className="glass-panel dashboard-stat">
                    <span className="label">WALLET STATUS</span>
                    <span className="value" style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
                        {account ? `CONNECTED ${abbreviateAddress(account.address)}` : 'NOT CONNECTED'}
                    </span>
                </div>
            </div>

            <div className="placeholder-section glass-panel">
                <h3 className="glow-text-blue">Recent Activity</h3>
                {!account && <p className="text-muted">Connect your wallet to view personal listings and trades.</p>}
                {account && loading && <p className="text-muted">Loading dashboard data...</p>}
                {account && error && <p className="text-muted">{error}</p>}
                {account && !loading && !error && trades.length === 0 && <p className="text-muted">No completed trades yet.</p>}
                {account && !loading && !error && trades.length > 0 && (
                    <div className="activity-list">
                        {trades.slice(0, 5).map((trade) => (
                            <div key={trade.id} className="activity-row">
                                <span>
                                    {trade.have_qty} {trade.have_item?.name || 'Item'} for {trade.want_qty} {trade.want_item?.name || 'Item'}
                                </span>
                                <span className="wallet-tag">{trade.tx_digest.slice(0, 10)}...</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </GlobalWrapper>
    );
};
