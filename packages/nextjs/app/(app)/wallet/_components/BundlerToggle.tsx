"use client";

type Props = {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
};

// Carries over from the FCC withdrawal pattern (not the order book): the TEE
// signs a withdrawal authorization, and with a bundler on, anyone can
// broadcast it on the user's behalf. Deposit/Trade have no such leg, so this
// toggle is Withdraw-only — see brief.md.
export const BundlerToggle = ({ enabled, onChange, disabled }: Props) => (
  <div className="glass-panel-inset flex items-center justify-between p-4">
    <div className="flex flex-col gap-0.5">
      <span className="text-sm font-medium">Bundler</span>
      <span
        className="tooltip tooltip-right text-xs text-base-content/60"
        data-tip="TEE signs your withdrawal authorization; a bundler broadcasts it for you so you don't need gas on hand."
      >
        Let a bundler submit this for you
      </span>
    </div>
    <input
      type="checkbox"
      className="toggle"
      checked={enabled}
      disabled={disabled}
      onChange={e => onChange(e.target.checked)}
    />
  </div>
);
