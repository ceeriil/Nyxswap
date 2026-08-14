export interface TestToken {
  key: string;
  address: `0x${string}`;
  symbol: string;
  name: string;
  logoURI: string;
}

interface TestTokenMeta {
  key: string;
  symbol: string;
  name: string;
  logoURI: string;
}

// Mirrors packages/foundry/script/mocks/tokens.json - the curated list
// DeployTestTokens.s.sol clones via SeedTokenFactory and registers on
// Faucet. Addresses aren't stored here; they come from whichever deploy
// actually ran, resolved against ~~/contracts/deployedContracts by
// useDepositableTokens. Keep this list in sync with tokens.json by hand.
export const TEST_TOKEN_META: TestTokenMeta[] = [
  {
    key: "WflrTestToken",
    symbol: "WFLR",
    name: "Wrapped Flare",
    logoURI: "https://coin-images.coingecko.com/coins/images/28705/large/flare.png?1696527687",
  },
  {
    key: "SflrTestToken",
    symbol: "sFLR",
    name: "Sceptre Staked FLR",
    logoURI: "https://coin-images.coingecko.com/coins/images/38940/large/sFLR.png?1719569593",
  },
  {
    key: "StflrTestToken",
    symbol: "stFLR",
    name: "SparkDEX Staked FLR",
    logoURI: "https://coin-images.coingecko.com/coins/images/102171873/large/stflr.png?1770183957",
  },
  {
    key: "SprkTestToken",
    symbol: "SPRK",
    name: "SparkDEX",
    logoURI: "https://coin-images.coingecko.com/coins/images/66902/large/Group_1410077194.png?1750963230",
  },
  {
    key: "FlrethTestToken",
    symbol: "flrETH",
    name: "Flare Staked Ether",
    logoURI: "https://coin-images.coingecko.com/coins/images/54761/large/flrETH-token_icon.png?1741413946",
  },
  {
    key: "StxrpTestToken",
    symbol: "stXRP",
    name: "Firelight Staked XRP",
    logoURI: "https://coin-images.coingecko.com/coins/images/71019/large/stxrp.png?1765268748",
  },
  {
    key: "FxrpTestToken",
    symbol: "FXRP",
    name: "Flare Bridged XRP",
    logoURI: "https://coin-images.coingecko.com/coins/images/69731/large/fxrp.png?1759406752",
  },
  {
    key: "UsdxTestToken",
    symbol: "USDX",
    name: "Hex Trust USD",
    logoURI: "https://coin-images.coingecko.com/coins/images/38997/large/USDX.png?1719809776",
  },
  { key: "CusdxTestToken", symbol: "cUSDX", name: "USDX T-POOL", logoURI: "" },
  { key: "YusdxTestToken", symbol: "yUSDX", name: "X-Pool USDX", logoURI: "" },
  {
    key: "Usdt0TestToken",
    symbol: "USDT0",
    name: "USDT0",
    logoURI: "https://coin-images.coingecko.com/coins/images/53705/large/usdt0.jpg?1737086183",
  },
  {
    key: "UsdceTestToken",
    symbol: "USDC.e",
    name: "Bridged USDC Stargate",
    logoURI: "https://coin-images.coingecko.com/coins/images/69316/large/usdc.jpg?1758186473",
  },
  {
    key: "UsdtTestToken",
    symbol: "USDT",
    name: "Bridged USDT Stargate",
    logoURI: "https://coin-images.coingecko.com/coins/images/70631/large/usdt.jpg?1762857609",
  },
  {
    key: "WethTestToken",
    symbol: "WETH",
    name: "Bridged WETH Stargate",
    logoURI: "https://coin-images.coingecko.com/coins/images/69466/large/weth_2.jpg?1758701596",
  },
  {
    key: "CywethTestToken",
    symbol: "cyWETH",
    name: "Cyclo cyWETH",
    logoURI: "https://coin-images.coingecko.com/coins/images/69970/large/Logomark_blue_on_transparent_2x.png?1760256832",
  },
  {
    key: "CysflrTestToken",
    symbol: "cysFLR",
    name: "Cyclo cysFLR",
    logoURI: "https://coin-images.coingecko.com/coins/images/70516/large/Logomark_blue_on_transparent_2x.png?1762269120",
  },
  {
    key: "DineroTestToken",
    symbol: "DINERO",
    name: "Dinero OFT",
    logoURI: "https://coin-images.coingecko.com/coins/images/39341/large/dinero.jpg?1721807902",
  },
  {
    key: "BugoTestToken",
    symbol: "BUGO",
    name: "Bugo",
    logoURI: "https://coin-images.coingecko.com/coins/images/66274/large/pp-06.png?1749029059",
  },
  {
    key: "PicoTestToken",
    symbol: "PiCO",
    name: "PiCO Coin",
    logoURI: "https://coin-images.coingecko.com/coins/images/54439/large/PICO_COIN_ICON.png?1739763005",
  },
  {
    key: "JouleTestToken",
    symbol: "JOULE",
    name: "Joule",
    logoURI: "https://coin-images.coingecko.com/coins/images/39538/large/Joule_square.png?1722841551",
  },
];
