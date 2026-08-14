"use client";

// @refresh reset
import { AddressInfoDropdown } from "./AddressInfoDropdown";
import { AddressQRCodeModal } from "./AddressQRCodeModal";
import { RevealBurnerPKModal } from "./RevealBurnerPKModal";
import { WrongNetworkDropdown } from "./WrongNetworkDropdown";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { getBlockExplorerAddressLink, useWatchBalance } from "@scaffold-ui/hooks";
import { Address } from "viem";
import { CircleStackIcon } from "@heroicons/react/24/outline";
import { Button } from "~~/components/landing/Button";
import { useNetworkColor } from "~~/hooks/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";

/**
 * Custom Wagmi Connect Button (watch balance + custom design)
 */
export const RainbowKitCustomConnectButton = () => {
  const networkColor = useNetworkColor();
  const { targetNetwork } = useTargetNetwork();

  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, mounted }) => {
        const connected = mounted && account && chain;
        const blockExplorerAddressLink = account
          ? getBlockExplorerAddressLink(targetNetwork, account.address)
          : undefined;
        const { data: balance } = useWatchBalance({
          address: account?.address as Address | undefined,
          chain: targetNetwork,
        });

        return (
          <>
            {(() => {
              if (!connected) {
                return (
                  <Button as="button" onClick={openConnectModal} className="!text-xs px-4 py-1.5">
                    Connect Wallet
                  </Button>
                );
              }

              if (chain.unsupported || chain.id !== targetNetwork.id) {
                return <WrongNetworkDropdown />;
              }

              return (
                <>
                  <div className="mr-2 flex flex-col items-center gap-0 px-2">
                    <div className="flex items-center gap-1 text-xs text-landing-fg">
                      <CircleStackIcon className="h-3.5 w-3.5" />
                      <span>
                        {balance ? parseFloat(balance.formatted).toFixed(4) : "0.0000"} {balance?.symbol}
                      </span>
                    </div>
                    <span className="text-[10px]" style={{ color: networkColor }}>
                      {chain.name}
                    </span>
                  </div>
                  <AddressInfoDropdown
                    address={account.address as Address}
                    displayName={account.displayName}
                    ensAvatar={account.ensAvatar}
                    blockExplorerAddressLink={blockExplorerAddressLink}
                  />
                  <AddressQRCodeModal address={account.address as Address} modalId="qrcode-modal" />
                  <RevealBurnerPKModal />
                </>
              );
            })()}
          </>
        );
      }}
    </ConnectButton.Custom>
  );
};
