import { createDAppKit } from '@mysten/dapp-kit-core';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { DEFAULT_SUI_NETWORK, networkConfig } from './sui';

type TrionNetwork = 'devnet' | 'testnet' | 'utopia';

const TRION_NETWORKS: TrionNetwork[] = ['devnet', 'testnet', 'utopia'];
const TRION_NETWORK_CONFIG = networkConfig as Record<TrionNetwork, { url: string }>;

export const trionDAppKit = createDAppKit({
  networks: TRION_NETWORKS,
  defaultNetwork: DEFAULT_SUI_NETWORK,
  // enable autoConnect so DAppKit restores the previously selected wallet on page reload
  autoConnect: true,
  createClient: (network) => {
    const selectedNetwork = (network in TRION_NETWORK_CONFIG
      ? network
      : DEFAULT_SUI_NETWORK) as TrionNetwork;

    return new SuiJsonRpcClient({
      url: TRION_NETWORK_CONFIG[selectedNetwork].url,
      network: selectedNetwork === 'utopia' ? 'testnet' : selectedNetwork,
    });
  },
});
