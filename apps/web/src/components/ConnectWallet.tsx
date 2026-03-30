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
                onClosed={() => setShowWalletModal(false)}
            />
        </>
    );
};
