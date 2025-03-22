export const CONTRACT_ADDRESS = "0x714de84AC40941a8e035809708C60684cbA33C33";
export const USDC_ADDRESS = "0x5425890298aed601595a70AB815c96711a31Bc65";
export const FUJI_CHAIN_ID = 43113;
export const FUJI_RPC_URL = "https://api.avax-test.network/ext/bc/C/rpc";
export const FUJI_EXPLORER_URL = "https://testnet.snowtrace.io";

export const FUJI_NETWORK_PARAMS = {
  chainId: `0x${FUJI_CHAIN_ID.toString(16)}`,
  chainName: "Avalanche Fuji Testnet",
  nativeCurrency: {
    name: "AVAX",
    symbol: "AVAX",
    decimals: 18
  },
  rpcUrls: [FUJI_RPC_URL],
  blockExplorerUrls: [FUJI_EXPLORER_URL]
}; 