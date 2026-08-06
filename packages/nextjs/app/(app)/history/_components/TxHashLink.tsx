"use client";

import { CheckCircleIcon, DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import { useCopyToClipboard } from "~~/hooks/scaffold-eth/useCopyToClipboard";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { getBlockExplorerTxLink } from "~~/utils/scaffold-eth";

// Links out to the real chain explorer (getBlockExplorerTxLink) rather than
// this repo's own /blockexplorer route — that route only reads from a local
// hardhat node and can't resolve a tx hash on any real target network.
export const TxHashLink = ({ hash }: { hash: string }) => {
  const { targetNetwork } = useTargetNetwork();
  const { copyToClipboard, isCopiedToClipboard } = useCopyToClipboard();
  const explorerUrl = getBlockExplorerTxLink(targetNetwork.id, hash);
  const truncated = `${hash.substring(0, 6)}…${hash.substring(hash.length - 4)}`;

  return (
    <span className="flex items-center gap-1.5 tabular-nums">
      {explorerUrl ? (
        <a href={explorerUrl} target="_blank" rel="noreferrer" className="link link-hover font-medium">
          {truncated}
        </a>
      ) : (
        <span className="font-medium">{truncated}</span>
      )}
      {isCopiedToClipboard ? (
        <CheckCircleIcon className="h-3.5 w-3.5 text-base-content/60" />
      ) : (
        <DocumentDuplicateIcon
          className="h-3.5 w-3.5 cursor-pointer text-base-content/40 hover:text-base-content/70"
          onClick={() => copyToClipboard(hash)}
        />
      )}
    </span>
  );
};
