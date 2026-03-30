import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DAppKitProvider } from '@mysten/dapp-kit-react';
import { VaultProvider, SmartObjectProvider, NotificationProvider } from '@evefrontier/dapp-kit';
import { trionDAppKit } from '../lib/dappkit';

const queryClient = new QueryClient();

export const WalletWrapper = ({ children }: { children: React.ReactNode }) => {
	return (
		<QueryClientProvider client={queryClient}>
			<DAppKitProvider dAppKit={trionDAppKit}>
                    <VaultProvider>
                        <SmartObjectProvider>
                            <NotificationProvider>
                                {children}
                            </NotificationProvider>
                        </SmartObjectProvider>
                    </VaultProvider>
			</DAppKitProvider>
		</QueryClientProvider>
	);
};
