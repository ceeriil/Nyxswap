"use client";

import { useState } from "react";
import { PiArrowsDownUp } from "react-icons/pi";

export const SwapDirectionToggle = ({ onClick }: { onClick: () => void }) => {
  const [flips, setFlips] = useState(0);

  const handleClick = () => {
    setFlips(prev => prev + 1);
    onClick();
  };

  return (
    <div className="relative z-10 -my-3 flex justify-center">
      <button
        type="button"
        aria-label="Reverse swap direction"
        onClick={handleClick}
        className="btn btn-circle btn-md bg-base-100 border-4 border-base-200 hover:bg-base-300 active:scale-90 transition-transform"
      >
        <span
          className="inline-flex transition-transform duration-300 ease-out"
          style={{ transform: `rotate(${flips * 180}deg)` }}
        >
          <PiArrowsDownUp size={20} />
        </span>
      </button>
    </div>
  );
};
