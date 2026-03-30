import { getJsonRpcFullnodeUrl, SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { createNetworkConfig } from '@mysten/dapp-kit';

const { networkConfig, useNetworkVariable, useNetworkVariables } = createNetworkConfig({
	devnet: {
		url: getJsonRpcFullnodeUrl('devnet'),
		network: 'devnet',
	},
	testnet: {
		url: getJsonRpcFullnodeUrl('testnet'),
		network: 'testnet',
	},
	utopia: {
		url: 'https://fullnode.testnet.sui.io:443',
		network: 'testnet', // Mapping utopia to testnet for now
	}
});

type TrionNetwork = 'devnet' | 'testnet' | 'utopia';

const configuredNetwork = (import.meta.env.PUBLIC_SUI_NETWORK ?? 'testnet').toLowerCase();
const isSupportedNetwork = (value: string): value is TrionNetwork =>
	value === 'devnet' || value === 'testnet' || value === 'utopia';

export const DEFAULT_SUI_NETWORK: TrionNetwork = isSupportedNetwork(configuredNetwork)
	? configuredNetwork
	: 'testnet';

export { networkConfig, useNetworkVariable, useNetworkVariables };

export const suiClient = new SuiJsonRpcClient({
	url: import.meta.env.PUBLIC_SUI_FULLNODE_URL || networkConfig[DEFAULT_SUI_NETWORK].url,
	network: DEFAULT_SUI_NETWORK === 'utopia' ? 'testnet' : DEFAULT_SUI_NETWORK
});

export const TRION_CORE_PACKAGE_ID = import.meta.env.PUBLIC_PACKAGE_ID || '0x522224eeed8482616840bce1f4b7872c9d6c61394ef158f5d7b1cd0140c1e03a';

const configuredApiBaseUrl = (import.meta.env.PUBLIC_API_BASE_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
export const API_BASE_URL = configuredApiBaseUrl.endsWith('/api')
	? configuredApiBaseUrl
	: `${configuredApiBaseUrl}/api`;

export const TRADE_COIN_TYPE_A = import.meta.env.PUBLIC_TRADE_COIN_TYPE_A || '0x2::sui::SUI';
export const TRADE_COIN_TYPE_B = import.meta.env.PUBLIC_TRADE_COIN_TYPE_B || '0x2::sui::SUI';
