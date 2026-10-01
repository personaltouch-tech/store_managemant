import React, { useEffect } from "react";
import "../style/thermalReceipt.css";

export default function ThermalReceiptModal({ bill, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!bill) return null;

  const bid = bill.bid || "0";
  const cname = bill.cname || "Cash Customer";
  const phone = bill.phone || bill.cphone || "-";
  const paymentType = bill.paymentType || bill.payment_type || "Cash";
  const totalAmount = Number(bill.total_amount || 0);
  const createdAt = bill.created_at ? new Date(bill.created_at) : new Date();
  const dateFormatted = createdAt.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const items = bill.items || [];

  return (
    <div className="thermal-modal-backdrop" onClick={onClose}>
      <div
        className="thermal-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating Close Button */}
        <button
          className="thermal-close-btn"
          onClick={onClose}
          title="Close Receipt"
        >
          ×
        </button>

        {/* Thermal Paper Slip */}
        <div className="thermal-paper-wrapper">
          <div className="thermal-paper" id="thermal-receipt-slip">
            {/* Store Header */}
            <div className="receipt-header">
              <div className="receipt-store-name">
                GANGADHAR PROVISION STORE
              </div>
              <div className="receipt-address">
                1, Ravikunj Flat, Arunodaya Soc.<br />
                B.M.C. Gas Supply Rd, Alkapuri<br />
                Vadodara - 390007<br />
                Mobile: 95860 52965<br />
                GSTIN: 24ADHPP8981D1Z9
              </div>
            </div>

            <div className="receipt-divider">--------------------------------</div>

            {/* Receipt Metadata */}
            <div className="receipt-meta">
              <div className="receipt-meta-row">
                <span>Bill No : #{bid}</span>
              </div>
              <div className="receipt-meta-row">
                <span>Date    : {dateFormatted}</span>
              </div>
              <div className="receipt-meta-row">
                <span>Customer: {cname}</span>
              </div>
              <div className="receipt-meta-row">
                <span>Phone   : {phone}</span>
              </div>
              <div className="receipt-meta-row">
                <span>Payment : {paymentType}</span>
              </div>
            </div>

            <div className="receipt-divider">--------------------------------</div>

            {/* Item Columns Header */}
            <div className="receipt-table-header">
              <span className="receipt-col-name">Item</span>
              <span className="receipt-col-qty">Qty</span>
              <span className="receipt-col-amount">Amount</span>
            </div>

            <div className="receipt-divider">--------------------------------</div>

            {/* Items List */}
            <div className="receipt-items-list">
              {items.length === 0 ? (
                <div className="receipt-item-row" style={{ fontStyle: "italic", opacity: 0.7 }}>
                  <span>(Standard Sale)</span>
                  <span>1</span>
                  <span>Rs.{totalAmount.toFixed(2)}</span>
                </div>
              ) : (
                items.map((item, idx) => {
                  const name = (item.product_name || "Item").substring(0, 14);
                  const qty = String(item.quantity || 1).padStart(3);
                  const amt = `Rs.${Number(item.subtotal || 0).toFixed(2)}`;
                  return (
                    <div key={idx} className="receipt-item-row">
                      <span className="receipt-col-name">{name}</span>
                      <span className="receipt-col-qty">{qty}</span>
                      <span className="receipt-col-amount">{amt}</span>
                    </div>
                  );
                })
              )}
            </div>

            <div className="receipt-divider">--------------------------------</div>

            {/* Total */}
            <div className="receipt-total-row">
              <span>TOTAL:</span>
              <span>Rs.{totalAmount.toFixed(2)}</span>
            </div>

            <div className="receipt-divider">--------------------------------</div>

            {/* Tax Notice */}
            <div className="receipt-tax-notice">
              Composition Taxable Person,<br />
              Not Eligible To Collect Tax On Supplies
            </div>

            {/* Footer */}
            <div className="receipt-footer">
              <div className="receipt-thankyou">Thank You! Visit Again</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
