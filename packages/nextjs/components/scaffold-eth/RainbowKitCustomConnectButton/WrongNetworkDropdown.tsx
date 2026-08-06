import { NetworkOptions } from "./NetworkOptions";
import { PiCaretDownBold, PiSignOutBold } from "react-icons/pi";
import { useDisconnect } from "wagmi";

export const WrongNetworkDropdown = () => {
  const { disconnect } = useDisconnect();

  return (
    <div className="dropdown dropdown-end mr-2">
      <label tabIndex={0} className="btn btn-outline btn-error btn-sm dropdown-toggle rounded-field gap-1">
        <span>Wrong network</span>
        <PiCaretDownBold size={16} />
      </label>
      <ul
        tabIndex={0}
        className="dropdown-content menu z-10 p-2 mt-2 rounded-box border border-base-300 bg-base-100 shadow-lg shadow-black/10 dark:shadow-black/40 gap-1 min-w-56"
      >
        <NetworkOptions />
        <li>
          <button className="menu-item text-error btn-sm flex gap-3 py-3" type="button" onClick={() => disconnect()}>
            <PiSignOutBold size={18} />
            <span>Disconnect</span>
          </button>
        </li>
      </ul>
    </div>
  );
};
