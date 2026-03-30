import React, { useState } from 'react';
import { abbreviateAddress } from '@evefrontier/dapp-kit';
import { ConnectModal, useCurrentAccount, useDAppKit } from '@mysten/dapp-kit-react';

export const NavWallet = () => {
    const dAppKit = useDAppKit();
    const account = useCurrentAccount();
    const [showWalletModal, setShowWalletModal] = useState(false);

    const handleDisconnect = () => {
        dAppKit.disconnectWallet();
        if (typeof window !== 'undefined') {
            window.localStorage.removeItem('eve-dapp-connected');
        }
    };

    return (
        <>
            {account ? (
                <button
                    className="btn btn-primary"
                    onClick={handleDisconnect}
                    title="Disconnect wallet"
                >
                    {abbreviateAddress(account.address)}
                </button>
            ) : (
                <button
                    className="btn btn-primary"
                    onClick={() => setShowWalletModal(true)}
                    title="Select from installed Sui wallets"
                >
                    Connect Wallet
                </button>
            )}

            <ConnectModal
                open={showWalletModal}
                close={async () => { setShowWalletModal(false); }}
            />
        </>
    );
};

// Persist a small helper flag so we can optionally track connection state across reloads
// (DAppKit's internal storage will also remember the selected wallet when autoConnect is enabled)
export const _ConnectWalletPersistence = () => {
    const account = useCurrentAccount();

    React.useEffect(() => {
        if (typeof window === 'undefined') return;
        if (account) {
            try { window.localStorage.setItem('eve-dapp-connected', 'true'); } catch {}
        } else {
            try { window.localStorage.removeItem('eve-dapp-connected'); } catch {}
        }
    }, [account]);

    return null;
};

// Auto-reconnect fallback: if we have the helper flag stored but no current account,
// attempt to connect to an available wallet (prefer EVE/Vault if present).
export const _AutoReconnect = () => {
    const dAppKit = useDAppKit();
    const account = useCurrentAccount();

    React.useEffect(() => {
        if (typeof window === 'undefined') return;
        if (account) return; // already connected

        try {
            const connectedFlag = window.localStorage.getItem('eve-dapp-connected');
            if (!connectedFlag) return;

            // attempt to pick a preferred wallet (EVE Vault or similar)
            const walletsStore = (dAppKit as any)?.stores?.$wallets;
            const wallets = walletsStore?.get ? walletsStore.get() : [];
            if (!wallets || wallets.length === 0) return;

            const preferred = wallets.find((w: any) => /EVE|VAULT|EVE_FRONTIER/i.test(w.name)) || wallets[0];
            if (!preferred) return;

            // attempt connect; ignore failures silently
            (async () => {
                try { await dAppKit.connectWallet({ wallet: preferred }); } catch (e) { /* ignore */ }
            })();
        } catch (e) {
            // no-op
        }
    }, [dAppKit, account]);

    return null;
};
