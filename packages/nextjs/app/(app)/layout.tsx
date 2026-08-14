import { Footer } from "~~/components/Footer";
import { Header } from "~~/components/Header";
import { TrayProvider } from "~~/components/ui/ActionTray";
import { FaucetModalProvider } from "~~/components/Wallet/FaucetModalProvider";

/** Chrome for the connected-wallet app pages (debug, block explorer, trading UI). */
const AppLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <TrayProvider>
      <FaucetModalProvider>
        <div className="flex flex-col min-h-screen">
          <Header />
          <main className="relative flex flex-col flex-1">{children}</main>
          <Footer />
        </div>
      </FaucetModalProvider>
    </TrayProvider>
  );
};

export default AppLayout;
