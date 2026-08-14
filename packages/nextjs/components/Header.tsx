"use client";

import React, { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { flareTestnet } from "viem/chains";
import { Bars3Icon, LockClosedIcon, ScaleIcon, ShieldCheckIcon, WalletIcon } from "@heroicons/react/24/outline";
import { FaucetButton, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useOutsideClick, useTargetNetwork } from "~~/hooks/scaffold-eth";

type HeaderMenuLink = {
  label: string;
  href: string;
  icon?: React.ReactNode;
};

export const menuLinks: HeaderMenuLink[] = [
  {
    label: "Trade",
    href: "/app",
    icon: <ScaleIcon className="h-4 w-4" />,
  },
  {
    label: "Wallet",
    href: "/wallet",
    icon: <WalletIcon className="h-4 w-4" />,
  },
  {
    label: "History",
    href: "/history",
    icon: <LockClosedIcon className="h-4 w-4" />,
  },
  {
    label: "Verify",
    href: "/verify",
    icon: <ShieldCheckIcon className="h-4 w-4" />,
  },
];

export const HeaderMenuLinks = () => {
  const pathname = usePathname();

  return (
    <>
      {menuLinks.map(({ label, href, icon }) => {
        const isActive = pathname === href;
        return (
          <li key={href} className="h-full">
            <Link
              href={href}
              passHref
              className={`${
                isActive ? "text-base-content" : "text-base-content/70"
              } hover:text-base-content focus:outline-none transition-colors h-full px-4 text-sm gap-2 flex items-center whitespace-nowrap`}
            >
              {icon}
              <span>{label}</span>
            </Link>
          </li>
        );
      })}
    </>
  );
};

/**
 * Site header
 */
export const Header = () => {
  const { targetNetwork } = useTargetNetwork();
  const isFaucetNetwork = targetNetwork.id === flareTestnet.id;

  const burgerMenuRef = useRef<HTMLDetailsElement>(null);
  useOutsideClick(burgerMenuRef, () => {
    burgerMenuRef?.current?.removeAttribute("open");
  });

  return (
    <div className="sticky lg:static top-0 navbar  min-h-16 shrink-0 justify-between z-20  border-base-300 p-0 sm:px-2">
      <div className="navbar-start w-auto self-stretch">
        <details className="dropdown" ref={burgerMenuRef}>
          <summary className="ml-1 btn btn-ghost lg:hidden hover:bg-transparent">
            <Bars3Icon className="h-1/2" />
          </summary>
          <ul
            className="menu menu-compact dropdown-content mt-3 p-2 shadow-lg bg-base-100 w-52"
            onClick={() => {
              burgerMenuRef?.current?.removeAttribute("open");
            }}
          >
            <HeaderMenuLinks />
          </ul>
        </details>
        <Link href="/" passHref className="hidden lg:flex items-center gap-2 ml-4 mr-6 shrink-0">
          <div className="flex relative w-10 h-10">
            <Image alt="NyxSwap logo" className="cursor-pointer rounded-full" fill src="/logo-new.png" />
          </div>
          <div className="flex flex-col">
            <span className="font-[500] font-nord font-[0.8rem] leading-tight">NyxSwap</span>
            <span className="text-xs text-landing-muted">Confidential order flow</span>
          </div>
        </Link>
        <ul className="hidden lg:flex lg:flex-nowrap h-full m-0 p-0 list-none">
          <HeaderMenuLinks />
        </ul>
      </div>
      <div className="navbar-end grow mr-4">
        <RainbowKitCustomConnectButton />
        {isFaucetNetwork && <FaucetButton />}
      </div>
    </div>
  );
};
