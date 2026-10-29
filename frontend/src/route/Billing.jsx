import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import { isValidPhone } from "../utils/validation";
import { printBill } from "../utils/printer";
import Header from "../components/Hader";
import Footer from "../components/Footer";
import ThermalReceiptModal from "../components/ThermalReceiptModal";
import "../style/billing.css";

// ── POS QUICK-SEARCH MATCHING HELPERS ──────────────────────
function levenshteinDistance(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function getMatchScore(name, query) {
  if (!name || !query) return 0;
  const n = String(name).toLowerCase().trim();
  const q = String(query).toLowerCase().trim();
  const nClean = n.replace(/[^a-z0-9]/g, "");
  const qClean = q.replace(/[^a-z0-9]/g, "");

  // 1. Exact match (including cleaned without spaces)
  if (n === q || nClean === qClean) return 10000;

  // 2. Starts with query
  if (n.startsWith(q) || (qClean && nClean.startsWith(qClean))) {
    return 5000 - (n.length - q.length);
  }

  // 3. Any individual word starts with query
  const words = n.split(/\s+/);
  if (words.some(w => w.startsWith(q))) {
    return 3000 - n.length;
  }

  // 4. Substring match
  if (n.includes(q) || (qClean && nClean.includes(qClean))) {
    return 2000 - (n.indexOf(q) >= 0 ? n.indexOf(q) : nClean.indexOf(qClean));
  }

  // 5. Subsequence match (characters in order, e.g. "srt" -> "sting")
  let qIdx = 0;
  for (let i = 0; i < nClean.length && qIdx < qClean.length; i++) {
    if (nClean[i] === qClean[qIdx]) qIdx++;
  }
  if (qIdx === qClean.length && qClean.length > 0) {
    return 1000 - n.length;
  }

  // 6. Typo tolerance: prefix edit distance (e.g. "srt" vs "sti" of "sting")
  if (qClean.length >= 2) {
    const prefixLen = Math.min(nClean.length, qClean.length + 1);
    const prefix = nClean.substring(0, prefixLen);
    const dist = levenshteinDistance(qClean, prefix);
    if (dist <= 1) return 800 - dist * 100;
    if (qClean.length >= 4 && dist <= 2) return 500 - dist * 100;
  }

  return 0;
}

function Billing() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [paymentType, setPaymentType] = useState("Cash");
  const [cashPhone, setCashPhone] = useState("");
  const [quantities, setQuantities] = useState({});
  const [activeCategory, setActiveCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [billDone, setBillDone] = useState(null);
  const [cashMethod, setCashMethod] = useState("Cash");
  const [printing, setPrinting] = useState(false);
  const [showThermalReceipt, setShowThermalReceipt] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [waPhoneInput, setWaPhoneInput] = useState("");
  const [waPhoneError, setWaPhoneError] = useState("");

  // ── NEW: view mode toggle (Category Wise / All Products) ──
  const [viewMode, setViewMode] = useState("category"); // "category" | "all"

  // ── FAST POS KEYBOARD SEARCH & SPACE-TO-ADD ───────────────
  const [quickQuery, setQuickQuery] = useState("");
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [lastActionWasSpace, setLastActionWasSpace] = useState(false);
  const [lastAddedProduct, setLastAddedProduct] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [productRes, customerRes, catRes] = await Promise.all([
        api.get("/products/get_products"),
        api.get("/customer/get_all_customer"),
        api.get("/categories/get_category"),
      ]);
      setProducts(productRes.data || []);
      setCustomers(customerRes.data || []);
      setCategories(catRes.data || []);
      if (catRes.data?.length) setActiveCategory(catRes.data[0].cid);
    } catch {
      setNotice("Failed to load data");
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  // Live top matching suggestions for quick query
  const quickSuggestions = useMemo(() => {
    const q = quickQuery.trim();
    if (!q) return [];
    return products
      .map(p => ({ product: p, score: getMatchScore(p.product_name, q) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.product)
      .slice(0, 6);
  }, [products, quickQuery]);

  const changeQty = (pid, next) =>
    setQuantities(prev => ({ ...prev, [pid]: Math.max(0, next) }));

  const getProductsByCategory = (cid) =>
    products.filter(p => p.cid === cid);

  const getFiltered = (cid) => {
    const s = quickQuery.trim().toLowerCase();
    const catProds = getProductsByCategory(cid);
    if (!s) return catProds;
    return catProds
      .filter(p => getMatchScore(p.product_name, s) > 0)
      .sort((a, b) => getMatchScore(b.product_name, s) - getMatchScore(a.product_name, s));
  };

  // ── filter across ALL products regardless of category ──
  const getFilteredAll = () => {
    const s = quickQuery.trim().toLowerCase();
    if (!s) return products;
    return products
      .filter(p => getMatchScore(p.product_name, s) > 0)
      .sort((a, b) => getMatchScore(b.product_name, s) - getMatchScore(a.product_name, s));
  };

  const getCategoryName = (cid) =>
    categories.find(c => c.cid === cid)?.cname || "";

  const selectedItems = useMemo(() =>
    products
      .filter(p => (quantities[p.pid] || 0) > 0)
      .map(p => ({
        ...p,
        quantity: quantities[p.pid],
        subtotal: Number(p.price) * quantities[p.pid],
      })),
    [products, quantities]
  );

  const totalAmount = selectedItems.reduce((s, i) => s + i.subtotal, 0);




  const isPhoneValid = cashPhone === "" || isValidPhone(cashPhone);

  const canGenerate = selectedItems.length > 0 && !saving &&
    paymentType === "Cash" && isPhoneValid;

  const canAddToAccount = selectedItems.length > 0 && !saving &&
    paymentType === "Monthly Account" && !!selectedCustomer;

  // ── CASH BILL ─────────────────────────────────────────────
  const generateBill = async () => {
    if (!canGenerate) return;
    try {
      setSaving(true);
      setNotice("");

      let cid;
      const phoneInput = cashPhone.trim();

      if (phoneInput) {
        // Customer with phone entered
        const found = customers.find(c => c.cphone === phoneInput);
        if (found) {
          cid = found.cid;
        } else {
          const newCust = await api.post("/customer/create_customer", {
            cname: "Cash Customer",
            cphone: phoneInput,
            cmail: "",
            currently_due_amount: 0,
            last_paid_amount: 0
          });
          cid = newCust.data.cid;
          const custRes = await api.get("/customer/get_all_customer");
          setCustomers(custRes.data || []);
        }
      } else {
        // Bill without phone: reuse or create a generic Cash Customer
        const foundCashCust = customers.find(
          c => c.cname === "Cash Customer" && (!c.cphone || c.cphone.trim() === "" || c.cphone === "-")
        );
        if (foundCashCust) {
          cid = foundCashCust.cid;
        } else {
          const newCust = await api.post("/customer/create_customer", {
            cname: "Cash Customer",
            cphone: "",
            cmail: "",
            currently_due_amount: 0,
            last_paid_amount: 0
          });
          cid = newCust.data.cid;
          const custRes = await api.get("/customer/get_all_customer");
          setCustomers(custRes.data || []);
        }
      }

      const billRes = await api.post("/bill/create_bill", {
        cid: Number(cid),
        payment_type: cashMethod
      });
      const bid = billRes.data;

      await Promise.all(
        selectedItems.map(item =>
          api.post("/bill/create_billItems", {
            bid,
            pid: item.pid,
            quantity: item.quantity,
            unit_price: Number(item.price),
          })
        )
      );

      const billDetail = await api.get(`/bill/get_bill/${bid}`);

      setBillDone({
        ...billDetail.data,
        bid,
        items: selectedItems,
        paymentType: cashMethod,
        phone: phoneInput,
        email: "",
      });

      setQuantities({});
      setCashPhone("");

    } catch (err) {
      setNotice(err?.response?.data?.detail || "Failed to generate bill");
    } finally { setSaving(false); }
  };

  // ── MONTHLY ACCOUNT BILL ──────────────────────────────────
  const addToAccount = async () => {
    if (!canAddToAccount) return;
    try {
      setSaving(true);
      setNotice("");

      const billRes = await api.post("/bill/create_bill", {
        cid: Number(selectedCustomer),
        payment_type: "Monthly Account"
      });
      const bid = billRes.data;

      await Promise.all(
        selectedItems.map(item =>
          api.post("/bill/create_billItems", {
            bid,
            pid: item.pid,
            quantity: item.quantity,
            unit_price: Number(item.price),
          })
        )
      );

      const billDetail = await api.get(`/bill/get_bill/${bid}`);
      const custFound = customers.find(c => c.cid === parseInt(selectedCustomer));

      setBillDone({
        ...billDetail.data,
        bid,
        items: selectedItems,
        paymentType: "Monthly Account",
        phone: custFound?.cphone || "",
        email: custFound?.cmail || "",
      });

      setQuantities({});
      setSelectedCustomer("");

    } catch (err) {
      setNotice(err?.response?.data?.detail || "Failed to add to account");
    } finally { setSaving(false); }
  };

  // ── WHATSAPP ──────────────────────────────────────────────
  const formatWhatsAppMessage = (bill) => {
    if (!bill) return "";
    const date = new Date(bill.created_at).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric"
    });

    let msg = ``;
    msg += `🏪 *GANGADHAR PROVISION STORE*\n`;
    msg += `📍 1, Ravikunj Flat, Arunodaya Soc., B.M.C. Gas Supply Rd, Alkapuri, Vadodara - 390007\n`;
    msg += `📞 Mobile: 95860 52965\n`;
    msg += `🆔 GSTIN: 24ADHPP9881D1Z9\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
    msg += `📋 *BILL RECEIPT*\n`;
    msg += `🔖 Bill No : *#${bill.bid}*\n`;
    msg += `📅 Date    : *${date}*\n`;
    msg += `👤 Name    : *${bill.cname || "Cash Customer"}*\n`;
    msg += `💳 Payment : *${bill.paymentType || "Cash"}*\n\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🛒 *ITEMS PURCHASED*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;

    (bill.items || []).forEach((item, index) => {
      msg += `${index + 1}. ${item.product_name}\n`;
      msg += `   ${item.quantity} x Rs.${Number(item.price).toFixed(2)} = *Rs.${item.subtotal.toFixed(2)}*\n`;
    });

    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💰 *TOTAL AMOUNT : Rs.${parseFloat(bill.total_amount).toFixed(2)}*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    msg += `_Composition Taxable Person, Not Eligible To Collect Tax On Supplies_\n\n`;

    if (bill.paymentType === "Monthly Account") {
      msg += `📌 _Added to your Monthly Account_\n\n`;
    } else {
      msg += `✅ _Payment Received — Thank You!_\n\n`;
    }

    msg += `🙏 *Thank you for shopping with us!*\n`;
    msg += `📍 Gangadhar Provision Store\n`;
    msg += `📞 Visit us again!`;

    return msg;
  };

  const sendWhatsApp = (phone, bill) => {
    const msg = formatWhatsAppMessage(bill);
    const cleanPhone = String(phone || "").trim().replace(/\D/g, "");
    const waUrl = cleanPhone
      ? `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, "_blank");
  };

  const handleWhatsApp = async () => {
    if (!billDone) return;
    const phone = billDone.phone ? String(billDone.phone).trim() : "";

    // If client has a valid 10-digit number, send immediately
    if (phone && isValidPhone(phone)) {
      sendWhatsApp(phone, billDone);
    } else {
      // If phone number was NOT entered during bill generation, prompt user first
      setWaPhoneInput("");
      setWaPhoneError("");
      setShowWhatsAppModal(true);
    }
  };

  const handleConfirmWhatsApp = () => {
    const trimmed = waPhoneInput.trim();
    if (!isValidPhone(trimmed)) {
      setWaPhoneError("Please enter a valid 10-digit mobile number");
      return;
    }

    // Update billDone with entered phone
    const updatedBill = { ...billDone, phone: trimmed };
    setBillDone(updatedBill);
    setShowWhatsAppModal(false);
    setWaPhoneError("");

    // Open WhatsApp
    sendWhatsApp(trimmed, updatedBill);
  };
  const handleDownloadPDF = async () => {
    if (!billDone) return;
    try {
      const res = await api.post("/bill/generate_pdf", {
        bill_data: {
          bid: billDone.bid,
          cname: billDone.cname,
          phone: billDone.phone || "",
          total_amount: parseFloat(billDone.total_amount).toFixed(2),
          payment_type: billDone.paymentType,
          created_at: new Date(billDone.created_at).toLocaleDateString("en-IN"),
        },
        items: billDone.items.map(i => ({
          product_name: i.product_name,
          quantity: i.quantity,
          unit_price: Number(i.price).toFixed(2),
          subtotal: i.subtotal.toFixed(2),
        }))
      }, { responseType: "blob" });   // ← blob for binary PDF

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.setAttribute("download", `Bill_${billDone.bid}.pdf`);
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to generate PDF: " + (err?.response?.data?.detail || err.message));
    }
  };

  const handlePrint = async () => {
    if (!billDone) return;
    try {
      setPrinting(true);
      await printBill(billDone);
    } catch (err) {
      alert("Failed to print: " + err.message);
    } finally {
      setPrinting(false);
    }
  };

  const activeCat = categories.find(c => c.cid === activeCategory);

  // ── GLOBAL KEYBOARD SHORTCUTS ─────────────────────────────
  // 1. Billing Page: Type anywhere to search, Space to add product, Enter to direct generate bill
  // 2. Bill Popup: 'W' for WhatsApp, 'P' for PDF, 'R' for Print, 'S' for Receipt, 'N' / Enter for New Bill
  useEffect(() => {
    function handleKeyDown(e) {
      // ── IF WHATSAPP MODAL IS OPEN (User typing phone number) ──
      if (showWhatsAppModal) {
        // Let the WhatsApp modal's own input onKeyDown handle Enter / Escape
        return;
      }

      // ── IF THERMAL RECEIPT MODAL IS OPEN ──
      if (showThermalReceipt) {
        if (e.key === "Escape" || e.key === "s" || e.key === "S") {
          e.preventDefault();
          setShowThermalReceipt(false);
          return;
        }
        if (e.key === "r" || e.key === "R" || e.key === "PrintScreen" || (e.ctrlKey && (e.key === "p" || e.key === "P"))) {
          e.preventDefault();
          handlePrint();
          return;
        }
        if (e.key === "n" || e.key === "N" || e.key === "Enter") {
          e.preventDefault();
          setShowThermalReceipt(false);
          setBillDone(null);
          return;
        }
        return;
      }

      // ── IF BILL DONE POPUP IS OPEN ──
      if (billDone) {
        const k = e.key.toLowerCase();

        // 'w' -> Send via WhatsApp
        if (k === "w") {
          e.preventDefault();
          handleWhatsApp();
          return;
        }

        // 'p' or 'd' -> Download PDF
        if (k === "p" || k === "d") {
          e.preventDefault();
          handleDownloadPDF();
          return;
        }

        // 'r' or PrintScreen or Ctrl+P -> Print to thermal printer
        if (k === "r" || e.key === "PrintScreen" || (e.ctrlKey && k === "p")) {
          e.preventDefault();
          if (!printing) handlePrint();
          return;
        }

        // 's' -> Show Thermal Receipt
        if (k === "s") {
          e.preventDefault();
          setShowThermalReceipt(true);
          return;
        }

        // 'n' or Escape or Enter -> New Bill
        if (k === "n" || e.key === "Escape" || e.key === "Enter") {
          e.preventDefault();
          setShowThermalReceipt(false);
          setBillDone(null);
          return;
        }

        return;
      }

      // ── IF REGULAR BILLING PAGE (before bill is generated) ──
      const activeTag = document.activeElement ? document.activeElement.tagName.toUpperCase() : "";
      const isInput = activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT";

      // If user is focused inside an input (e.g. phone number input or search input)
      if (isInput) {
        const isSearchInput = document.activeElement && document.activeElement.getAttribute("data-role") === "pos-search";
        if (e.key === "Escape") {
          document.activeElement.blur();
          setQuickQuery("");
          return;
        }
        if (e.key === "Enter") {
          // If in input and user hits Enter, directly generate bill!
          if (paymentType === "Cash" && canGenerate) {
            e.preventDefault();
            document.activeElement.blur();
            setQuickQuery("");
            setLastAddedProduct(null);
            setLastActionWasSpace(false);
            generateBill();
            return;
          }
          if (paymentType === "Monthly Account" && canAddToAccount) {
            e.preventDefault();
            document.activeElement.blur();
            setQuickQuery("");
            setLastAddedProduct(null);
            setLastActionWasSpace(false);
            addToAccount();
            return;
          }
        }
        // If in POS search input and Space is pressed: add/increment the product!
        if (isSearchInput && (e.key === " " || e.code === "Space")) {
          const targetProduct = quickSuggestions[selectedSuggestionIndex] || quickSuggestions[0] || lastAddedProduct;
          if (targetProduct) {
            e.preventDefault();
            const currentQty = quantities[targetProduct.pid] || 0;
            changeQty(targetProduct.pid, currentQty + 1);
            setLastAddedProduct(targetProduct);
            setLastActionWasSpace(true);
            return;
          }
        }
        return;
      }

      // ── SPACE KEY: Add or increment product ──
      if (e.key === " " || e.code === "Space") {
        const targetProduct = quickSuggestions[selectedSuggestionIndex] || quickSuggestions[0] || lastAddedProduct;
        if (targetProduct) {
          e.preventDefault(); // Stop page scrolling!
          const currentQty = quantities[targetProduct.pid] || 0;
          changeQty(targetProduct.pid, currentQty + 1);
          setLastAddedProduct(targetProduct);
          setLastActionWasSpace(true);
        }
        return;
      }

      // ── ESCAPE: Clear quick search query ──
      if (e.key === "Escape") {
        setQuickQuery("");
        setLastActionWasSpace(false);
        setLastAddedProduct(null);
        setSelectedSuggestionIndex(0);
        return;
      }

      // ── BACKSPACE: Remove last character ──
      if (e.key === "Backspace") {
        if (quickQuery.length > 0) {
          e.preventDefault();
          setQuickQuery(prev => prev.slice(0, -1));
          setLastActionWasSpace(false);
          setSelectedSuggestionIndex(0);
        }
        return;
      }

      // ── ARROW KEYS: Navigate suggestions ──
      if (e.key === "ArrowDown") {
        if (quickSuggestions.length > 1) {
          e.preventDefault();
          setSelectedSuggestionIndex(prev => (prev + 1) % quickSuggestions.length);
        }
        return;
      }
      if (e.key === "ArrowUp") {
        if (quickSuggestions.length > 1) {
          e.preventDefault();
          setSelectedSuggestionIndex(prev => (prev - 1 + quickSuggestions.length) % quickSuggestions.length);
        }
        return;
      }

      // ── ENTER: Directly generate bill ──
      if (e.key === "Enter") {
        e.preventDefault();
        if (paymentType === "Cash") {
          if (canGenerate) {
            setQuickQuery("");
            setLastAddedProduct(null);
            setLastActionWasSpace(false);
            generateBill();
          } else if (selectedItems.length === 0) {
            setNotice("Please add at least one item before generating a bill");
          } else if (!isPhoneValid) {
            setNotice("Please enter a valid 10-digit mobile number");
          }
        } else if (paymentType === "Monthly Account") {
          if (canAddToAccount) {
            setQuickQuery("");
            setLastAddedProduct(null);
            setLastActionWasSpace(false);
            addToAccount();
          } else if (selectedItems.length === 0) {
            setNotice("Please add at least one item before adding to account");
          } else if (!selectedCustomer) {
            setNotice("Please select a monthly customer");
          }
        }
        return;
      }

      // ── ALPHANUMERIC & TYPING KEYS ──
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (lastActionWasSpace) {
          setQuickQuery(e.key.toLowerCase());
          setLastActionWasSpace(false);
          setSelectedSuggestionIndex(0);
        } else {
          setQuickQuery(prev => prev + e.key.toLowerCase());
          setSelectedSuggestionIndex(0);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    billDone,
    showThermalReceipt,
    showWhatsAppModal,
    quickSuggestions,
    selectedSuggestionIndex,
    lastAddedProduct,
    lastActionWasSpace,
    quantities,
    canGenerate,
    canAddToAccount,
    paymentType,
    selectedItems.length,
    isPhoneValid,
    selectedCustomer,
    saving,
    printing
  ]);

  // ── JSX ───────────────────────────────────────────────────
  return (
    <div className="billing-page">
      <Header />
      <main className="billing-shell">

        {/* Top Bar */}
        <section className="billing-topbar">
          <div>
            <button className="ghost-btn" onClick={() => navigate("/Dashboard")}>
              Back
            </button>
            <h1>Billing </h1>
            <p>Select products, choose payment type, then generate the bill.</p>
          </div>
          <div className="billing-summary">
            <span>{selectedItems.length} items</span>
            <strong>Rs {totalAmount.toFixed(2)}</strong>
            {paymentType === "Cash" && (
              <button
                className="generate-btn"
                disabled={!canGenerate}
                onClick={generateBill}
                title="Press Enter to generate bill"
              >
                {saving ? "Generating..." : "Generate Bill (Enter)"}
              </button>
            )}
          </div>
        </section>

        {notice && <div className="billing-notice">{notice}</div>}

        <section className="billing-grid">

          {/* LEFT PANEL */}
          <aside className="billing-panel">

            {/* Payment Type */}
            <label>Payment Type</label>
            <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
              {["Cash", "Monthly Account"].map(type => (
                <button
                  key={type}
                  onClick={() => setPaymentType(type)}
                  style={{
                    flex: 1, padding: "9px",
                    backgroundColor: paymentType === type ? "#000000" : "#f1f5f9",
                    color: paymentType === type ? "#ffffff" : "#111111",
                    border: paymentType === type ? "none" : "1px solid #d1d5db",
                    borderRadius: "8px",
                    cursor: "pointer", fontWeight: "600", fontSize: "13px"
                  }}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* Cash */}
            {paymentType === "Cash" && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <label style={{ fontSize: "13px", fontWeight: "600", color: "#111111", marginBottom: "6px" }}>
                    Customer Phone Number <span style={{ fontWeight: "400", color: "#64748b", fontSize: "12px" }}>(Optional)</span>
                  </label>
                  {cashPhone && (
                    <button
                      type="button"
                      onClick={() => setCashPhone("")}
                      style={{
                        background: "none", border: "none", color: "#64748b",
                        fontSize: "11px", cursor: "pointer", textDecoration: "underline", padding: 0
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div style={{ position: "relative", marginBottom: "6px" }}>
                  <input
                    type="text"
                    placeholder="Enter 10-digit phone (optional)"
                    value={cashPhone}
                    maxLength={10}
                    onChange={e => setCashPhone(e.target.value.replace(/\D/g, ""))}
                    style={{
                      width: "100%", padding: "9px 12px",
                      border: cashPhone && !isValidPhone(cashPhone)
                        ? "1px solid #ef4444"
                        : cashPhone && isValidPhone(cashPhone)
                          ? "1px solid #22c55e"
                          : "1px solid #cbd5e1",
                      borderRadius: "8px",
                      fontSize: "14px",
                      boxSizing: "border-box", outline: "none"
                    }}
                  />
                </div>

                {cashPhone && !isValidPhone(cashPhone) && (
                  <p style={{ fontSize: "11px", color: "#dc2626", marginTop: "-2px", marginBottom: "10px" }}>
                    ⚠️ Enter full 10-digit phone number or clear to bill without number
                  </p>
                )}

                {cashPhone && isValidPhone(cashPhone) && (
                  <p style={{ fontSize: "11px", color: "#16a34a", marginTop: "-2px", marginBottom: "10px" }}>
                    ✓ Valid number — receipt will be sent to WhatsApp
                  </p>
                )}

                {!cashPhone && (
                  <p style={{ fontSize: "11px", color: "#64748b", marginTop: "-2px", marginBottom: "10px" }}>
                    ℹ️ Phone number is optional. You can generate bill with or without phone.
                  </p>
                )}

                {/* ADD THIS — Cash or UPI selection */}
                <label style={{
                  fontSize: "13px", fontWeight: "600",
                  color: "#111111", marginBottom: "6px", display: "block"
                }}>
                  Payment Method
                </label>
                <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                  {["Cash", "UPI"].map(method => (
                    <button
                      key={method}
                      onClick={() => setCashMethod(method)}
                      style={{
                        flex: 1, padding: "8px",
                        backgroundColor: cashMethod === method ? "#000000" : "#f1f5f9",
                        color: cashMethod === method ? "#ffffff" : "#111111",
                        border: cashMethod === method ? "none" : "1px solid #d1d5db",
                        borderRadius: "8px",
                        cursor: "pointer", fontWeight: "600", fontSize: "13px"
                      }}
                    >
                      {method === "Cash" ? "💵 Cash" : "📱 UPI"}
                    </button>
                  ))}
                </div>
              </>
            )}
            {/* Monthly Account */}
            {paymentType === "Monthly Account" && (
              <>
                <label>Select Customer </label>
                <select
                  value={selectedCustomer}
                  onChange={e => setSelectedCustomer(e.target.value)}
                  style={{
                    width: "100%", padding: "9px 12px",
                    border: "1px solid #cbd5e1", borderRadius: "8px",
                    fontSize: "14px", marginBottom: "10px",
                    boxSizing: "border-box", outline: "none"
                  }}
                >
                  <option value="">-- Select Customer --</option>
                  {customers
                    .filter(c => c.cname !== "Cash Customer")
                    .map(c => (
                      <option key={c.cid} value={c.cid}>
                        {c.cname} - {c.cphone}
                      </option>
                    ))}
                </select>

                {/* ADD TO ACCOUNT BUTTON */}
                <button
                  onClick={addToAccount}
                  disabled={!canAddToAccount}
                  style={{
                    width: "100%", padding: "11px 0",
                    backgroundColor: canAddToAccount ? "#000000" : "#d1d5db",
                    color: "white", border: "none", borderRadius: "8px",
                    cursor: canAddToAccount ? "pointer" : "not-allowed",
                    fontWeight: "700", fontSize: "14px", marginBottom: "10px"
                  }}
                >
                  {saving ? "Adding..." : "➕ Add to Monthly Account"}
                </button>

                <p style={{
                  fontSize: "12px", color: "#111111",
                  backgroundColor: "#f1f5f9", padding: "8px 10px",
                  borderRadius: "6px", marginBottom: "14px"
                }}>
                  ✓ Bill will be added to customer's monthly account
                </p>
              </>
            )}

            {/* Cart */}
            <div className="receipt-preview">
              <div className="receipt-head">
                <span>Current Bill</span>
                <strong>Rs {totalAmount.toFixed(2)}</strong>
              </div>
              {selectedItems.length === 0 ? (
                <p className="muted">No products selected yet.</p>
              ) : (
                selectedItems.map(item => (
                  <div className="receipt-row" key={item.pid}>
                    <div>
                      <strong>{item.product_name}</strong>
                      <span>{item.quantity} x Rs {Number(item.price).toFixed(2)}</span>
                    </div>
                    <b>Rs {item.subtotal.toFixed(2)}</b>
                  </div>
                ))
              )}
            </div>
          </aside>

          {/* RIGHT — Products */}
          <section className="product-picker">


            {/* ── NEW: Category Wise / All Products toggle ── */}
            <div style={{
              display: "flex", gap: "10px",
              padding: "16px 16px 0"
            }}>
              <button
                onClick={() => setViewMode("category")}
                style={{
                  flex: 1, padding: "11px 0",
                  backgroundColor: viewMode === "category" ? "#000000" : "#ffffff",
                  color: viewMode === "category" ? "#ffffff" : "#111111",
                  border: "2px solid #000000",
                  borderRadius: "8px",
                  cursor: "pointer", fontWeight: "700", fontSize: "13px"
                }}
              >
                📂 Category Wise
              </button>
              <button
                onClick={() => setViewMode("all")}
                style={{
                  flex: 1, padding: "11px 0",
                  backgroundColor: viewMode === "all" ? "#000000" : "#ffffff",
                  color: viewMode === "all" ? "#ffffff" : "#111111",
                  border: "2px solid #000000",
                  borderRadius: "8px",
                  cursor: "pointer", fontWeight: "700", fontSize: "13px"
                }}
              >
                🔍 All Products
              </button>
            </div>

            {/* ── CATEGORY WISE MODE (original behaviour) ── */}
            {viewMode === "category" && (
              <>
                {/* Category Cards */}
                <div style={{
                  display: "flex", flexWrap: "nowrap",
                  gap: "10px", margin: "18px 16px",
                  overflowX: "auto", paddingBottom: "6px"
                }}>
                  {categories.map(cat => {
                    const isActive = activeCategory === cat.cid;
                    const selected = getProductsByCategory(cat.cid)
                      .reduce((s, p) => s + (quantities[p.pid] || 0), 0);
                    return (
                      <div
                        key={cat.cid}
                        onClick={() => setActiveCategory(isActive ? null : cat.cid)}
                        style={{
                          padding: "10px 16px", borderRadius: "10px",
                          border: isActive ? "2px solid #000000" : "2px solid #e2e8f0",
                          backgroundColor: isActive ? "#f1f5f9" : "white",
                          cursor: "pointer", textAlign: "center",
                          minWidth: "90px", position: "relative",
                          boxShadow: "0 1px 4px rgba(0,0,0,0.05)"
                        }}
                      >
                        <div style={{
                          width: "36px", height: "36px", borderRadius: "50%",
                          backgroundColor: "#000000", color: "white",
                          fontSize: "16px", fontWeight: "700",
                          display: "flex", alignItems: "center",
                          justifyContent: "center", margin: "0 auto 6px"
                        }}>
                          {cat.cname.charAt(0).toUpperCase()}
                        </div>
                        <div style={{
                          fontSize: "12px", fontWeight: "700",
                          color: "#111111"
                        }}>{cat.cname}</div>
                        <div style={{ fontSize: "10px", color: "#4b5563" }}>
                          {getProductsByCategory(cat.cid).length} items
                        </div>
                        {selected > 0 && (
                          <div style={{
                            position: "absolute", top: "-7px", right: "-7px",
                            backgroundColor: "#000000", color: "white",
                            fontSize: "10px", fontWeight: "700",
                            padding: "2px 7px", borderRadius: "20px"
                          }}>{selected}</div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Active Category Products */}
                {activeCategory && activeCat && (
                  <div style={{
                    backgroundColor: "white", borderRadius: "12px",
                    overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
                    maxHeight: "calc(100vh - 320px)", overflowY: "auto",
                    margin: "0 16px 16px"
                  }}>
                    <div style={{
                      display: "flex", justifyContent: "space-between",
                      alignItems: "center", padding: "12px 16px",
                      backgroundColor: "#000000"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <span style={{
                          fontSize: "14px", fontWeight: "700",
                          color: "white"
                        }}>{activeCat.cname}</span>
                        <span style={{
                          fontSize: "11px", color: "#111111",
                          backgroundColor: "rgba(255,255,255,0.85)",
                          padding: "2px 8px", borderRadius: "20px"
                        }}>
                          {getProductsByCategory(activeCategory).length} products
                        </span>
                        {quickQuery && (
                          <span style={{
                            fontSize: "11.5px", color: "#38bdf8",
                            backgroundColor: "rgba(56, 189, 248, 0.15)",
                            border: "1px solid rgba(56, 189, 248, 0.35)",
                            padding: "2px 8px", borderRadius: "12px",
                            fontWeight: "600"
                          }}>
                            Typed: <b>&quot;{quickQuery}&quot;</b>
                          </span>
                        )}
                      </div>
                      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                        <input
                          type="text"
                          data-role="pos-search"
                          placeholder={`Search ${activeCat.cname}...`}
                          value={quickQuery}
                          onChange={e => {
                            setQuickQuery(e.target.value.toLowerCase());
                            setSelectedSuggestionIndex(0);
                            setLastActionWasSpace(false);
                          }}
                          style={{
                            padding: "6px 28px 6px 10px",
                            border: quickQuery ? "1.5px solid #38bdf8" : "1px solid rgba(255,255,255,0.5)",
                            borderRadius: "6px", fontSize: "13px", width: "170px",
                            backgroundColor: quickQuery ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.15)",
                            color: "white", outline: "none",
                            fontWeight: quickQuery ? "700" : "400",
                            boxShadow: quickQuery ? "0 0 6px rgba(56, 189, 248, 0.3)" : "none"
                          }}
                        />
                        {quickQuery && (
                          <button
                            type="button"
                            onClick={() => {
                              setQuickQuery("");
                              setSelectedSuggestionIndex(0);
                              setLastActionWasSpace(false);
                              setLastAddedProduct(null);
                            }}
                            style={{
                              position: "absolute", right: "6px",
                              background: "none", border: "none",
                              color: "rgba(255,255,255,0.8)", cursor: "pointer",
                              fontSize: "12px", padding: "2px 4px", lineHeight: 1
                            }}
                            title="Clear search (Esc)"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    {loading ? (
                      <div className="empty-state">Loading...</div>
                    ) : (
                      <div className="billing-product-grid">
                        {getFiltered(activeCategory).map(product => {
                          const qty = quantities[product.pid] || 0;
                          const isTargeted = (quickSuggestions[selectedSuggestionIndex]?.pid === product.pid);
                          return (
                            <article
                              className={`billing-product-card ${qty ? "selected" : ""}`}
                              key={product.pid}
                              style={isTargeted ? {
                                border: "2px solid #0284c7",
                                boxShadow: "0 0 0 3px rgba(2, 132, 199, 0.35)",
                                transform: "scale(1.02)",
                                transition: "all 0.15s ease"
                              } : undefined}
                            >
                              <div className="billing-product-image">
                                {product.image_url ? (
                                  <img
                                    src={`${api.defaults.baseURL}${product.image_url}`}
                                    alt={product.product_name}
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                    onError={(e) => {
                                      e.target.style.display = "none";
                                      e.target.nextSibling.style.display = "flex";
                                    }}
                                  />
                                ) : null}
                                <span style={{
                                  display: product.image_url ? "none" : "flex",
                                  width: "100%", height: "100%",
                                  alignItems: "center", justifyContent: "center",
                                  fontSize: "28px", fontWeight: "800", color: "#000000"
                                }}>
                                  {product.product_name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div className="billing-product-body">
                                <h3>{product.product_name}</h3>
                                <p>{product.unit || ""}</p>
                                <strong>Rs {Number(product.price).toFixed(2)}</strong>
                              </div>
                              <div className="quantity-control">
                                <button
                                  onClick={() => changeQty(product.pid, qty - 1)}
                                  disabled={qty === 0}
                                >-</button>
                                <span>{qty}</span>
                                <button onClick={() => changeQty(product.pid, qty + 1)}>+</button>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ── ALL PRODUCTS MODE (new feature) ── */}
            {viewMode === "all" && (
              <div style={{
                backgroundColor: "white", borderRadius: "12px",
                overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
                maxHeight: "calc(100vh - 260px)", overflowY: "auto",
                margin: "18px 16px 16px"
              }}>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", padding: "12px 16px",
                  backgroundColor: "#000000"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{
                      fontSize: "14px", fontWeight: "700",
                      color: "white"
                    }}>All Products</span>
                    <span style={{
                      fontSize: "11px", color: "#111111",
                      backgroundColor: "rgba(255,255,255,0.85)",
                      padding: "2px 8px", borderRadius: "20px"
                    }}>
                      {products.length} products
                    </span>
                    {quickQuery && (
                      <span style={{
                        fontSize: "11.5px", color: "#38bdf8",
                        backgroundColor: "rgba(56, 189, 248, 0.15)",
                        border: "1px solid rgba(56, 189, 248, 0.35)",
                        padding: "2px 8px", borderRadius: "12px",
                        fontWeight: "600"
                      }}>
                        Typed: <b>&quot;{quickQuery}&quot;</b>
                      </span>
                    )}
                  </div>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <input
                      type="text"
                      data-role="pos-search"
                      placeholder="Search all products..."
                      value={quickQuery}
                      onChange={e => {
                        setQuickQuery(e.target.value.toLowerCase());
                        setSelectedSuggestionIndex(0);
                        setLastActionWasSpace(false);
                      }}
                      style={{
                        padding: "6px 28px 6px 10px",
                        border: quickQuery ? "1.5px solid #38bdf8" : "1px solid rgba(255,255,255,0.5)",
                        borderRadius: "6px", fontSize: "13px", width: "190px",
                        backgroundColor: quickQuery ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.15)",
                        color: "white", outline: "none",
                        fontWeight: quickQuery ? "700" : "400",
                        boxShadow: quickQuery ? "0 0 6px rgba(56, 189, 248, 0.3)" : "none"
                      }}
                    />
                    {quickQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setQuickQuery("");
                          setSelectedSuggestionIndex(0);
                          setLastActionWasSpace(false);
                          setLastAddedProduct(null);
                        }}
                        style={{
                          position: "absolute", right: "6px",
                          background: "none", border: "none",
                          color: "rgba(255,255,255,0.8)", cursor: "pointer",
                          fontSize: "12px", padding: "2px 4px", lineHeight: 1
                        }}
                        title="Clear search (Esc)"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {loading ? (
                  <div className="empty-state">Loading...</div>
                ) : (
                  <div className="billing-product-grid">
                    {getFilteredAll().map(product => {
                      const qty = quantities[product.pid] || 0;
                      const isTargeted = (quickSuggestions[selectedSuggestionIndex]?.pid === product.pid);
                      return (
                        <article
                          className={`billing-product-card ${qty ? "selected" : ""}`}
                          key={product.pid}
                          style={isTargeted ? {
                            border: "2px solid #0284c7",
                            boxShadow: "0 0 0 3px rgba(2, 132, 199, 0.35)",
                            transform: "scale(1.02)",
                            transition: "all 0.15s ease"
                          } : undefined}
                        >
                          <div className="billing-product-image">
                            {product.image_url ? (
                              <img
                                src={`${api.defaults.baseURL}${product.image_url}`}
                                alt={product.product_name}
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                onError={(e) => {
                                  e.target.style.display = "none";
                                  e.target.nextSibling.style.display = "flex";
                                }}
                              />
                            ) : null}
                            <span style={{
                              display: product.image_url ? "none" : "flex",
                              width: "100%", height: "100%",
                              alignItems: "center", justifyContent: "center",
                              fontSize: "28px", fontWeight: "800", color: "#000000"
                            }}>
                              {product.product_name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="billing-product-body">
                            <h3>{product.product_name}</h3>
                            <p>{product.unit || ""} {getCategoryName(product.cid) && `• ${getCategoryName(product.cid)}`}</p>
                            <strong>Rs {Number(product.price).toFixed(2)}</strong>
                          </div>
                          <div className="quantity-control">
                            <button
                              onClick={() => changeQty(product.pid, qty - 1)}
                              disabled={qty === 0}
                            >-</button>
                            <span>{qty}</span>
                            <button onClick={() => changeQty(product.pid, qty + 1)}>+</button>
                          </div>
                        </article>
                      );
                    })}
                    {getFilteredAll().length === 0 && (
                      <div className="empty-state">No products found.</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        </section>
      </main>
      <Footer />

      {/* SUCCESS POPUP */}
      {billDone && (
        <div style={{
          position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)",
          display: "flex", alignItems: "center",
          justifyContent: "center", zIndex: 1000
        }}>
          <div style={{
            backgroundColor: "white", borderRadius: "14px",
            padding: "28px", width: "100%", maxWidth: "400px",
            boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
            maxHeight: "90vh", overflowY: "auto"
          }}>
            <div style={{
              fontSize: "16px", fontWeight: "700",
              color: "#000000", textAlign: "center", marginBottom: "4px"
            }}>
              ✓ {billDone.paymentType === "Monthly Account"
                ? "Added to Monthly Account!" : "Bill Generated Successfully!"}
            </div>
            <div style={{
              fontSize: "13px", color: "#4b5563",
              textAlign: "center", marginBottom: "16px"
            }}>
              Bill #{billDone.bid}
            </div>

            {/* Info */}
            <div style={{
              backgroundColor: "#f8fafc", borderRadius: "8px",
              padding: "12px", marginBottom: "12px"
            }}>
              <div style={{
                display: "flex", justifyContent: "space-between",
                fontSize: "13px", paddingBottom: "6px",
                marginBottom: "6px", borderBottom: "1px solid #e2e8f0"
              }}>
                <span>Customer</span>
                <span style={{ fontWeight: "700" }}>{billDone.cname}</span>
              </div>
              <div style={{
                display: "flex", justifyContent: "space-between",
                fontSize: "13px", paddingBottom: "6px",
                marginBottom: "6px", borderBottom: "1px solid #e2e8f0"
              }}>
                <span>Payment</span>
                <span style={{
                  fontWeight: "700",
                  color: "#000000"
                }}>
                  {billDone.paymentType}
                </span>
              </div>
              <div style={{
                display: "flex", justifyContent: "space-between",
                fontSize: "13px"
              }}>
                <span>Phone</span>
                <span>{billDone.phone || "—"}</span>
              </div>
            </div>

            {/* Items */}
            <div style={{ marginBottom: "12px" }}>
              {billDone.items.map((item, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between",
                  fontSize: "13px", padding: "4px 0",
                  borderBottom: "1px solid #f1f5f9"
                }}>
                  <span>{item.product_name} x{item.quantity}</span>
                  <span>₹{item.subtotal.toFixed(2)}</span>
                </div>
              ))}
              <div style={{
                display: "flex", justifyContent: "space-between",
                fontSize: "14px", fontWeight: "800",
                paddingTop: "8px", marginTop: "4px",
                borderTop: "2px solid #e2e8f0"
              }}>
                <span>Total</span>
                <span style={{ color: "#000000" }}>
                  ₹{parseFloat(billDone.total_amount).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Monthly Account Note */}
            {billDone.paymentType === "Monthly Account" && (
              <div style={{
                backgroundColor: "#f1f5f9", color: "#000000",
                fontSize: "12px", fontWeight: "600",
                padding: "8px 12px", borderRadius: "6px",
                marginBottom: "14px", textAlign: "center"
              }}>
                ✓ Added to {billDone.cname}'s Monthly Account
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
              <button onClick={handleWhatsApp} title="Press 'W' to send via WhatsApp" style={{
                flex: 1, minWidth: "120px", padding: "10px 0", backgroundColor: "#16a34a",
                color: "white", border: "none", borderRadius: "8px",
                cursor: "pointer", fontSize: "13px", fontWeight: "700"
              }}>📱 WhatsApp (W)</button>

              <button onClick={handleDownloadPDF} title="Press 'P' to download PDF" style={{
                flex: 1, minWidth: "120px", padding: "10px 0", backgroundColor: "#dc2626",
                color: "white", border: "none", borderRadius: "8px",
                cursor: "pointer", fontSize: "13px", fontWeight: "700"
              }}>⬇ PDF (P)</button>
            </div>

            <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
              <button onClick={handlePrint} disabled={printing} title="Press 'R' to print" style={{
                flex: 1, minWidth: "120px", padding: "10px 0", backgroundColor: "#2563eb",
                color: "white", border: "none", borderRadius: "8px",
                cursor: printing ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: "700",
                opacity: printing ? 0.7 : 1
              }}>🖨️ {printing ? "Printing..." : "Print (R)"}</button>

              <button onClick={() => setShowThermalReceipt(true)} title="Press 'S' to show receipt" style={{
                flex: 1, minWidth: "120px", padding: "10px 0", backgroundColor: "#0f766e",
                color: "white", border: "none", borderRadius: "8px",
                cursor: "pointer", fontSize: "13px", fontWeight: "700"
              }}>🧾 Show Receipt (S)</button>
            </div>

            <button
              onClick={() => {
                setBillDone(null);
                setShowThermalReceipt(false);
              }}
              title="Press 'N' or Enter for New Bill"
              style={{
                width: "100%", padding: "11px 0",
                backgroundColor: "#000000", color: "white",
                border: "none", borderRadius: "8px",
                cursor: "pointer", fontSize: "14px", fontWeight: "700"
              }}
            >+ New Bill (N)</button>

            <div style={{
              marginTop: "12px", paddingTop: "10px", borderTop: "1px solid #f1f5f9",
              display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap",
              fontSize: "11px", color: "#64748b"
            }}>
              <span>⌨️ <b>W</b> WhatsApp</span>
              <span>&bull;</span>
              <span><b>P</b> PDF</span>
              <span>&bull;</span>
              <span><b>R</b> Print</span>
              <span>&bull;</span>
              <span><b>S</b> Receipt</span>
              <span>&bull;</span>
              <span><b>N</b> New Bill</span>
            </div>
          </div>
        </div>
      )}

      {/* Thermal Receipt Print Look Modal */}
      {showThermalReceipt && billDone && (
        <ThermalReceiptModal
          bill={billDone}
          onClose={() => setShowThermalReceipt(false)}
        />
      )}

      {/* WhatsApp Number Prompt Modal (when bill has no phone number) */}
      {showWhatsAppModal && billDone && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px"
          }}
          onClick={() => setShowWhatsAppModal(false)}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              padding: "24px",
              width: "100%",
              maxWidth: "420px",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.3)",
              border: "1px solid #e2e8f0"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "50%",
                  backgroundColor: "#dcfce7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "22px"
                }}>
                  📱
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "800", color: "#0f172a" }}>
                    Send via WhatsApp
                  </h3>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                    Bill #{billDone.bid} &bull; Total: ₹{parseFloat(billDone.total_amount).toFixed(2)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowWhatsAppModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "20px",
                  cursor: "pointer",
                  color: "#94a3b8",
                  padding: "4px 8px",
                  lineHeight: 1
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#475569", lineHeight: "1.5" }}>
              No phone number was entered during bill generation. Enter the customer's mobile number to send the bill on WhatsApp:
            </p>

            {/* Input Form */}
            <div style={{ marginBottom: "18px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                WhatsApp Mobile Number
              </label>
              <div style={{
                display: "flex",
                alignItems: "center",
                border: waPhoneError ? "2px solid #ef4444" : "1.5px solid #cbd5e1",
                borderRadius: "10px",
                overflow: "hidden",
                transition: "border-color 0.15s ease",
                backgroundColor: "#f8fafc"
              }}>
                <span style={{
                  padding: "10px 14px",
                  backgroundColor: "#e2e8f0",
                  color: "#334155",
                  fontWeight: "700",
                  fontSize: "14px",
                  borderRight: "1px solid #cbd5e1"
                }}>
                  +91
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoFocus
                  placeholder="Enter 10-digit mobile number"
                  value={waPhoneInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setWaPhoneInput(val);
                    if (waPhoneError) setWaPhoneError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleConfirmWhatsApp();
                    if (e.key === "Escape") setShowWhatsAppModal(false);
                  }}
                  style={{
                    flex: 1,
                    border: "none",
                    outline: "none",
                    padding: "10px 12px",
                    fontSize: "15px",
                    fontWeight: "600",
                    color: "#0f172a",
                    backgroundColor: "transparent"
                  }}
                />
              </div>
              {waPhoneError && (
                <div style={{ marginTop: "6px", fontSize: "12px", color: "#ef4444", fontWeight: "600" }}>
                  ⚠️ {waPhoneError}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowWhatsAppModal(false)}
                style={{
                  padding: "10px 18px",
                  backgroundColor: "#f1f5f9",
                  color: "#475569",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "700"
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmWhatsApp}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#16a34a",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: "700",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 4px 12px rgba(22, 163, 74, 0.3)"
                }}
              >
                <span>Continue & Send</span>
                <span>↗</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Billing;