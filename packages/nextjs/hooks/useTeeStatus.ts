import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

/**
 * True only once NyxSwapInstructionSender.setExtensionId() has run (extension
 * registered with the TEE extension registry) AND the machine registry has at
 * least one TEE machine currently assigned to serve that extension.
 */
export function useTeeStatus() {
  const { data: extensionId, isLoading: isExtensionIdLoading } = useScaffoldReadContract({
    contractName: "NyxSwapInstructionSender",
    functionName: "extensionId",
  });

  const registered = !!extensionId && extensionId > 0n;

  const { data: teeIds, isLoading: isTeeIdsLoading } = useScaffoldReadContract({
    contractName: "FlareTeeManager",
    functionName: "getRandomTeeIds",
    args: [extensionId ?? 0n, 1n],
    query: { enabled: registered },
  });

  const online = registered && !!teeIds && teeIds.length > 0;

  return { online, isLoading: isExtensionIdLoading || (registered && isTeeIdsLoading) };
}
