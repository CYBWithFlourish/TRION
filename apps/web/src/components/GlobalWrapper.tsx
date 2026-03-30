import React from 'react';
import { WalletWrapper } from './WalletWrapper';
import { NavWallet } from './ConnectWallet';

export const GlobalWrapper = ({ children }: { children: React.ReactNode }) => {
    return (
        <WalletWrapper>
            {children}
        </WalletWrapper>
    );
};

export const NavWalletWrapper = () => {
    return (
        <WalletWrapper>
            <NavWallet />
        </WalletWrapper>
    );
};
