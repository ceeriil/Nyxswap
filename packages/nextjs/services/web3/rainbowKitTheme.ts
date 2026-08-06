import { Theme, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";

const SHARED_OPTIONS = {
  borderRadius: "medium",
  fontStack: "system",
  overlayBlur: "small",
} as const;

/**
 * RainbowKit theme overrides so the connect/account modal matches the app's
 * daisyUI surfaces (same bg/border tokens as cards and the toast) instead of
 * RainbowKit's default blue accent.
 */
export const nyxLightTheme: Theme = (() => {
  const base = lightTheme({
    ...SHARED_OPTIONS,
    accentColor: "#212638",
    accentColorForeground: "#ffffff",
  });

  return {
    ...base,
    colors: {
      ...base.colors,
      modalBackground: "#ffffff",
      modalBorder: "#dae8ff",
      modalText: "#212638",
      modalTextDim: "rgba(33, 38, 56, 0.6)",
      modalTextSecondary: "rgba(33, 38, 56, 0.7)",
      generalBorder: "#dae8ff",
      generalBorderDim: "rgba(218, 232, 255, 0.5)",
      profileForeground: "#f4f8ff",
      closeButton: "rgba(33, 38, 56, 0.5)",
      closeButtonBackground: "#f4f8ff",
      connectButtonBackground: "#f4f8ff",
      connectButtonInnerBackground: "#ffffff",
      connectButtonText: "#212638",
      actionButtonBorder: "#dae8ff",
      actionButtonBorderMobile: "#dae8ff",
      actionButtonSecondaryBackground: "#f4f8ff",
      menuItemBackground: "#f4f8ff",
      selectedOptionBorder: "#212638",
    },
  };
})();

export const nyxDarkTheme: Theme = (() => {
  const base = darkTheme({
    ...SHARED_OPTIONS,
    accentColor: "#f5f5f5",
    accentColorForeground: "#171717",
  });

  return {
    ...base,
    colors: {
      ...base.colors,
      modalBackground: "#171717",
      modalBorder: "#2e2e2e",
      modalText: "#f5f5f5",
      modalTextDim: "rgba(245, 245, 245, 0.6)",
      modalTextSecondary: "rgba(245, 245, 245, 0.7)",
      generalBorder: "#2e2e2e",
      generalBorderDim: "rgba(46, 46, 46, 0.5)",
      profileForeground: "#0d0d0d",
      closeButton: "rgba(245, 245, 245, 0.5)",
      closeButtonBackground: "#0d0d0d",
      connectButtonBackground: "#0d0d0d",
      connectButtonInnerBackground: "#171717",
      connectButtonText: "#f5f5f5",
      actionButtonBorder: "#2e2e2e",
      actionButtonBorderMobile: "#2e2e2e",
      actionButtonSecondaryBackground: "#0d0d0d",
      menuItemBackground: "#0d0d0d",
      selectedOptionBorder: "#f5f5f5",
    },
  };
})();
