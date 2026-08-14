// Cosmetic-only: CoinGecko icon URLs keyed by symbol, hand-maintained (not
// synced/generated - there's no on-chain source for a logo). Unmapped
// symbols fall back to TokenIcon's generated letter badge, so a newly
// deployed test token never breaks the UI, it just starts with no icon
// until an entry is added here.
export const TOKEN_ICON_BY_SYMBOL: Record<string, string> = {
  WFLR: "https://coin-images.coingecko.com/coins/images/28705/large/flare.png?1696527687",
  sFLR: "https://coin-images.coingecko.com/coins/images/38940/large/sFLR.png?1719569593",
  stFLR: "https://coin-images.coingecko.com/coins/images/102171873/large/stflr.png?1770183957",
  SPRK: "https://coin-images.coingecko.com/coins/images/66902/large/Group_1410077194.png?1750963230",
  flrETH: "https://coin-images.coingecko.com/coins/images/54761/large/flrETH-token_icon.png?1741413946",
  stXRP: "https://coin-images.coingecko.com/coins/images/71019/large/stxrp.png?1765268748",
  FXRP: "https://coin-images.coingecko.com/coins/images/69731/large/fxrp.png?1759406752",
  USDX: "https://coin-images.coingecko.com/coins/images/38997/large/USDX.png?1719809776",
  USDT0: "https://coin-images.coingecko.com/coins/images/53705/large/usdt0.jpg?1737086183",
  "USDC.e": "https://coin-images.coingecko.com/coins/images/69316/large/usdc.jpg?1758186473",
  USDT: "https://coin-images.coingecko.com/coins/images/70631/large/usdt.jpg?1762857609",
  WETH: "https://coin-images.coingecko.com/coins/images/69466/large/weth_2.jpg?1758701596",
  DINERO: "https://coin-images.coingecko.com/coins/images/39341/large/dinero.jpg?1721807902",
  BUGO: "https://coin-images.coingecko.com/coins/images/66274/large/pp-06.png?1749029059",
  PiCO: "https://coin-images.coingecko.com/coins/images/54439/large/PICO_COIN_ICON.png?1739763005",
  JOULE: "https://coin-images.coingecko.com/coins/images/39538/large/Joule_square.png?1722841551",
};
