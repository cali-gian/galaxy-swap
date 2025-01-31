// src/app.jsx
import { memo, useEffect, useState } from "react";
import { Principal } from "@dfinity/principal";
// import { PlugMobileProvider } from "@funded-labs/plug-mobile-sdk";
// import { IDL } from '@dfinity/agent';
import { Actor, HttpAgent } from "@dfinity/agent";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AdminPage from "./pages/Admin";

import {
  canisterId as b23CanisterId,
  idlFactory as b23AdlFactory,
} from "../../declarations/b23token";
import {
  swap_backend,
  idlFactory as swapBackendIdlFactory,
  canisterId as swapBackendCanisterId,
} from "declarations/swap_backend";
import {
  nns_ledger,
  idlFactory as nnsLedgerIdlFactory,
  canisterId as nnsLedgerCanisterId,
} from "declarations/nns-ledger";
import { Button } from "./components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./components/ui/card";
import NumberInput from "./components/ui/numberInput";
import Spinner from "./components/ui/spinner";
import ExchangeRate from "./components/ui/exchangeRate";
import DisconnectPlugWalletButton from "./components/ui/disconnectPlugWalletButton";
import CopyToClipboardButton from "./components/ui/copyToClipboard";
import DialogWithVideoConnect from "./components/DialogWithVideoConnect";
import InviteCode from "./components/InviteCode";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "./components/ui/use-toast";
import VideoPlayer from "./components/videoPlayer";

function App() {
  const NNS_LEDGER_CANISTER_ID = nnsLedgerCanisterId;
  const BACKEND_CANISTER_ID = swapBackendCanisterId;
  const TOKEN_CANISTER_ID = b23CanisterId;
  const SUBDIVISIONS_PER_ICP = 1e8;
  // const SUBDIVISIONS_PER_ICP = 1e4; // TODO: temp for testing

  const [isConnected, setIsConnected] = useState(false);
  const [spendAmount, setSpendAmount] = useState(100);
  const [loading, setLoading] = useState(false);
  const [approved, setApproved] = useState(false);
  const [onSwapScreen, setOnSwapScreen] = useState(false);
  const [swapCompleted, setSwapCompleted] = useState(false);
  // const isMobile = PlugMobileProvider.isMobileBrowser();
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 768);
  const [inviteCode, setInviteCode] = useState("GALAXY");
  const { toast } = useToast();
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    checkThatPlugIsConnected();
    const handleResize = () => {
      setIsDesktop(window.innerWidth > 768);
    };

    window.addEventListener("resize", handleResize);
  }, []);

  // const checkMobileAndConnect = async () => {
  //   if (isMobile) {
  //     if (!isPlugWalletAvailable()) {
  //       console.error("Plug Wallet is not available on this device.");
  //       return;
  //     }
  //     try {
  //       await connectPlugWallet();
  //     } catch (error) {
  //       console.error("Failed to connect Plug Wallet on mobile device:", error);
  //     }
  //   }
  // };
  if (!isDesktop) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-4">
          <h1 className="text-lg text-red-500">
            Please use a desktop browser to access this webpage.
          </h1>
        </div>
      </div>
    );
  }

  async function checkThatPlugIsConnected() {
    try {
      const isConnected = await window.ic.plug.isConnected();
      setIsConnected(isConnected);
      console.log("Plug is connected");
    } catch (e) {
      console.error("Error checking if plug is connected", e);
      setIsConnected(false);
    }
  }

  const isPlugWalletAvailable = () => {
    return window.ic && window.ic.plug;
  };

  const connectPlugWallet = async () => {
    if (isPlugWalletAvailable()) {
      try {
        const publicKey = await window.ic.plug.requestConnect({
          whitelist: [NNS_LEDGER_CANISTER_ID, BACKEND_CANISTER_ID],
        });
        toast({
          title: "Success",
          description: "Your Plug wallet has been successfully connected 🥳",
        });
        setIsConnected(true);
        console.log(`The connected user's public key is:`, publicKey);
      } catch (error) {
        console.error("Plug Wallet connection error:", error);
        setIsConnected(false);
      }
    } else {
      toast({
        className: "text-xl bg-red-500 text-gray",
        title: "Failed",
        description:
          "Plug Wallet is not available. Please install Plug Wallet extension",
      });
      console.log("Plug Wallet is not available.");
      setIsConnected(false);
    }
  };

  async function importToken() {
    try {
      await window.ic.plug.requestImportToken({
        canisterId: TOKEN_CANISTER_ID,
        symbol: "WBR23",
        standard: "ICRC-1",
        logo: "https://cryptologos.cc/logos/aptos-apt-logo.png",
      });
    } catch (error) {
      console.error("Failed to import token", error);
    }
  }

  const handleSpendAmountChange = (newAmount) => {
    setSpendAmount(newAmount);
  };

  async function approveSpend() {
    if (!isPlugWalletAvailable()) return;
    setLoading(true);
    setErrorMessage("");
    try {
      const actor = await window.ic.plug.createActor({
        canisterId: NNS_LEDGER_CANISTER_ID,
        interfaceFactory: nnsLedgerIdlFactory,
      });
      console.log("spendAmount:", spendAmount * SUBDIVISIONS_PER_ICP + 10_000);

      const result = await actor.icrc2_approve({
        fee: [],
        memo: [],
        from_subaccount: [],
        created_at_time: [],
        amount: spendAmount * SUBDIVISIONS_PER_ICP + 10_000,
        expected_allowance: [],
        expires_at: [],
        spender: {
          owner: Principal.fromText(BACKEND_CANISTER_ID),
          // owner: BACKEND_CANISTER_ID,
          subaccount: [],
        },
      });

      if (result.Err && result.Err.InsufficientFunds) {
        setErrorMessage(
          `Insufficient Funds: Your current balance is ${result.Err.InsufficientFunds.balance} ICP.`
        );
        toast({
          title: "Error",
          className: "text-xl bg-red-500 text-gray",
          description: `Insufficient Funds: Your current balance is ${result.Err.InsufficientFunds.balance} ICP.`,
        });
      } else {
        console.log("Approve:", result);
        setApproved(true);
      }
    } catch (error) {
      console.error("Error during transaction approval:", error);
      setErrorMessage(
        "An unexpected error occurred during transaction approval."
      );
    }
    setLoading(false);
  }

  const handleGoBack = () => {
    setOnSwapScreen(false);
    setApproved(false);
  };

  async function performSwap() {
    if (!isPlugWalletAvailable()) {
      console.log("Plug Wallet is not available.");
      return;
    }
    setLoading(true);
    setOnSwapScreen(true);
    try {
      const actor = await window.ic.plug.createActor({
        canisterId: BACKEND_CANISTER_ID,
        interfaceFactory: swapBackendIdlFactory,
      });
      console.log(
        "Actor created successfully, attempting to call swapIcpToToken.",
        actor
      );
      const result = await actor.swapIcpToToken(
        spendAmount * SUBDIVISIONS_PER_ICP,
        [inviteCode]
      );
      console.log("Swap token:", result);
      setSwapCompleted(true);
    } catch (error) {
      console.error("Error performing swap:", error);
    }
    setLoading(false);
  }

  const connectPlugWalletPage = (
    <>
      <CardHeader className="text-center space-y-10">
        <CardTitle className="">Galaxy Early Investors</CardTitle>
        <CardTitle className="text-lg">
          Dear friend, It's an honor for us to see you as one of the early
          investors.
        </CardTitle>
        <CardDescription className="">
          Your investment is the seed that grows tomorrow's innovations. Thank
          you for being the early champions of change with Galaxy.
          <br />
          Be sure to read terms and conditions <a href="https://caligian.notion.site/Galaxy-do-Early-Investors-3e76576a4d254783a5e57f0a39cc8572?pvs=4" className="text-blue-500 underline">here</a>.
        </CardDescription>
      </CardHeader>
      <CardFooter className="text-center">
        <Button
          onClick={connectPlugWallet}
          className=" text-lg bg-button bg-button-hover w-full py-2 rounded shadow-lg"
        >
          Connect Plug Wallet
        </Button>
      </CardFooter>
      <p className="text-xs text-gray-400 mt-4 text-center">
        Don't have plug wallet?{" "}
        <a
          href="https://plugwallet.ooo/"
          className="underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Download it here
        </a>
      </p>
    </>
  );

  const approveSpendPage = (
    <>
      <CardHeader className="text-center  space-y-10">
        <CardTitle className="text-2xl">Galaxy Early Investors</CardTitle>
        <CardDescription className=" text-lg">
          Please specify how much ICP do you want to invest. You need to
          pre-approve ICP spend in order to perform token swap.
        </CardDescription>
      </CardHeader>
      <NumberInput
        initial={spendAmount}
        min={10}
        max={250}
        onChange={handleSpendAmountChange}
      />
      <div className="text-sm  mt-3 mb-7 text-center">Max buy 250 ICP</div>
      <ExchangeRate
        swapBackendIdlFactory={swapBackendIdlFactory}
        swapBackendCanisterId={swapBackendCanisterId}
        icpAmount={spendAmount}
      />
      <CardFooter className="flex justify-center items-center">
        <Button
          onClick={approveSpend}
          className="w-[22rem] text-lg bg-button bg-button-hover py-2 rounded shadow-lg"
          disabled={spendAmount < 10 || spendAmount > 250 || loading}
        >
          {loading && <Spinner />}
          {loading && <span className="mr-2"></span>}
          <span>{loading ? "Loading..." : "Approve Spend"}</span>
        </Button>
      </CardFooter>
    </>
  );

  const swapTokenPage = (
    <>
      <CardHeader className="relative text-center pt-8">
        <div className="absolute left-0 top-0 mr-2 text-sm ">
          {!loading && <button onClick={handleGoBack}>&#8592; Go Back</button>}
        </div>
        <CardTitle className="">Galaxy Early Investors</CardTitle>
      </CardHeader>
      <div className="w-[22rem] text-center mx-auto shadow-lg bg-button font-bold text-xl mb-6 rounded py-2">
        To Invest: {spendAmount} ICP
      </div>
      <ExchangeRate
        swapBackendIdlFactory={swapBackendIdlFactory}
        swapBackendCanisterId={swapBackendCanisterId}
        icpAmount={spendAmount}
      />
      <div className="flex justify-center items-center">
        <Button
          onClick={performSwap}
          disabled={loading}
          className="w-[22rem] text-lg bg-button bg-button-hover py-2 rounded shadow-lg"
        >
          {loading && <Spinner />}
          {loading && <span className="mr-2"></span>}
          <span>{loading ? "Swap is in progress..." : "Perform Swap"}</span>
        </Button>
      </div>

      <CardFooter className="text-center"></CardFooter>
      {loading && (
        <div className="">
          <p>
            The process will take around 1-2 minutes. <br />
            Make sure to add our token to your Plug Wallet.
          </p>
          <h2 className="font-semibold text-lg mt-8">
            How to add WSTAR Token:
          </h2>
          <label className="block mt-2">Token Canister ID:</label>
          <div className="inline-flex items-center border-2 my-2 pl-2 bg-card rounded">
            <span className=" flex-grow">wexwn-tyaaa-aaaap-ag72a-cai</span>
            <CopyToClipboardButton textToCopy="wexwn-tyaaa-aaaap-ag72a-cai" />
          </div>
          <label className="block">
            Token Standard: <strong>ICRC1</strong>
          </label>
          <VideoPlayer />
        </div>
      )}
    </>
  );

  const gratitudePage = (
    <>
      <CardHeader className="relative text-center ">
        <CardTitle className="">Thank you 🫡</CardTitle>
        <CardTitle className="">Dear Investors!</CardTitle>
      </CardHeader>
      <CardDescription className=" text-lg mb-8">
        On behalf of the entire Galaxy team, we extend our deepest gratitude
        for your early support in acquiring our tokens. Your confidence and
        commitment in our product are invaluable to us. Your investment not only
        fuels our progress but also strengthens our resolve to deliver a product
        that we all can be proud of. We look forward to achieving great things
        together.
        <br />
        <br />
        Warm regards
        <br />
        <br />
        The Galaxy Team{" "}
        <img src="/favicon.png" alt="Galaxy Logo" className="w-8 inline" />
      </CardDescription>
    </>
  );

  return (
    <>
      <Router>
        <main>
          <Routes>
            <Route
              path="/admin-728382778"
              element={
                <AdminPage
                  swapBackendIdlFactory={swapBackendIdlFactory}
                  swapBackendCanisterId={swapBackendCanisterId}
                />
              }
            />
            <Route
              path="/"
              element={
                <>
                  <InviteCode setInviteCode={setInviteCode} />
                  <DialogWithVideoConnect />
                  {isConnected ? (
                    <DisconnectPlugWalletButton
                      setIsConnected={setIsConnected}
                    />
                  ) : null}
                  <div className="flex items-center justify-center min-h-screen">
                    <Card className="max-w-md w-full bg-text-background bg-opacity-85 shadow-2xl shadow-custom rounded-lg p-4 border-none my-4">
                      {isConnected ? (
                        swapCompleted ? (
                          gratitudePage
                        ) : approved ? (
                          swapTokenPage
                        ) : (
                          approveSpendPage
                        )
                      ) : (
                        <>
                          {connectPlugWalletPage}
                          <div className="mt-4 text-center">
                            {isConnected && (
                              <a
                                href="https://plugwallet.ooo/"
                                className="text-blue-500 underline"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Download or Open Plug Wallet
                              </a>
                            )}
                          </div>
                        </>
                      )}
                      {/* {inviteCode && isConnected && (
                        <p className="text-center text-sm">
                          Your invite code is: {inviteCode}
                        </p>
                      )} */}
                    </Card>
                  </div>
                </>
              }
            />
          </Routes>
        </main>
      </Router>
      <Toaster />
    </>
  );
}

export default App;

//   <Button onClick={disconnectPlug} variant="default">Disconnect Plug</Button>
//   <Button onClick={approveSpend} variant="default">Approve Spend</Button>
//   <Button onClick={performSwap} variant="default">Perform Swap 0.01 ICP</Button>
//   <Button onClick={importToken} variant="default">Import Token</Button>
