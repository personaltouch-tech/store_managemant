import { useEffect, useState } from "react";
import "../style/header.css";
import logo from "../assets/image.png"; // your logo image
import { useNavigate } from "react-router-dom";
import {
  connectPrinter,
  disconnectPrinter,
  isPrinterConnected,
  getPrinterName,
  reconnectPrinter
} from "../utils/printer";

const PrinterIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="printer-icon"
  >
    <polyline points="6 9 6 2 18 2 18 9" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
  </svg>
);

function Header() {
  const navigate = useNavigate();
  const [connected, setConnected] = useState(false);
  const [printerName, setPrinterName] = useState(null);

  useEffect(() => {
    // Sync initial state
    setConnected(isPrinterConnected());
    setPrinterName(getPrinterName());

    // Try auto-reconnect on mount
    reconnectPrinter().then(() => {
      setConnected(isPrinterConnected());
      setPrinterName(getPrinterName());
    });

    const handleStatusChange = (e) => {
      setConnected(e.detail.connected);
      setPrinterName(e.detail.name);
    };

    window.addEventListener("printer-status-changed", handleStatusChange);
    return () => {
      window.removeEventListener("printer-status-changed", handleStatusChange);
    };
  }, []);

  const handleConnectToggle = async () => {
    if (connected) {
      disconnectPrinter();
    } else {
      try {
        await connectPrinter();
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <header className="header">
      <div onClick={() => navigate("/Dashboard")} className="header-left">
        <img src={logo} alt="Gangadhar Provision Store" className="logo" />
      </div>

      <div onClick={() => navigate("/Dashboard")} className="header-center">
        <h2>Gangadhar Provision Store</h2>
        <p>Billing & Monthly Account System</p>
      </div>

      <div className="header-right">
        <div className="header-printer-pill">
          <span className={`printer-status-dot ${connected ? "online" : "offline"}`} />
          <button
            onClick={handleConnectToggle}
            className={`printer-btn ${connected ? "connected" : "disconnected"}`}
            title={connected ? `Connected to ${printerName || "Printer"}` : "Connect Thermal Printer"}
          >
            <PrinterIcon />
            <span>{connected ? "Disconnect" : "Connect Printer"}</span>
          </button>
        </div>
        <span className="owner-text">Owner: Gangadhar</span>
      </div>
    </header>
  );
}

export default Header;