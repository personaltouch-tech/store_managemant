import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/api";
import Header from "../components/Hader";
import Footer from "../components/Footer";

function PaymentHistory() {
  const { cid } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadDetail(); }, []);

  async function loadDetail() {
    try {
      setLoading(true);
      const res = await api.get(`/customer/get_customer/${cid}`);
      setDetail(res.data);
    } catch {
      alert("Failed to load");
    } finally { setLoading(false); }
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f1f5f9" }}>
      <Header />
      <main style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 16px",
        textAlign: "center", color: "#64748b" }}>Loading...</main>
      <Footer />
    </div>
  );

  if (!detail) return null;

  const c = detail.Customer;

  // Group paid history — bills that were cleared
  const monthlyBills = detail.CustomerBills?.filter(
    b => b.payment_type === "Monthly Account"
  ) || [];

  const grouped = {};
  monthlyBills.forEach(bill => {
    const date = new Date(bill.created_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    if (!grouped[key]) grouped[key] = { label, bills: [], total: 0 };
    grouped[key].bills.push(bill);
    grouped[key].total += bill.total_amount;
  });

  const sortedKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f1f5f9" }}>
      <Header />
      <main style={{ maxWidth: "900px", margin: "0 auto", padding: "24px 16px" }}>

        {/* Top */}
        <div style={{ display: "flex", alignItems: "center",
          gap: "14px", marginBottom: "24px" }}>
          <button onClick={() => navigate("/Accounts")} style={{
            backgroundColor: "#f1f5f9", color: "#1e3a5f", border: "none",
            borderRadius: "8px", padding: "8px 14px",
            cursor: "pointer", fontWeight: "700", fontSize: "13px"
          }}>← Back</button>
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: "800",
              color: "#1e3a5f", margin: 0 }}>
              Payment History
            </h1>
            <p style={{ color: "#64748b", margin: "2px 0 0", fontSize: "13px" }}>
              {c.cname}  •  {c.cphone}
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)",
          gap: "14px", marginBottom: "24px" }}>
          {[
            { label: "Total Bills", value: monthlyBills.length, plain: true },
            { label: "Total Amount", value: `Rs ${monthlyBills.reduce((s,b) => s + b.total_amount, 0).toFixed(2)}` },
            { label: "Amount Paid", value: `Rs ${parseFloat(c.last_paid_amount).toFixed(2)}`, green: true },
          ].map((s, i) => (
            <div key={i} style={{ backgroundColor: "white", borderRadius: "12px",
              padding: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: "12px", color: "#64748b",
                marginBottom: "6px" }}>{s.label}</div>
              <div style={{ fontSize: s.plain ? "28px" : "18px",
                fontWeight: "800",
                color: s.green ? "#15803d" : "#1e3a5f" }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Due Status */}
        <div style={{
          backgroundColor: c.currently_due_amount > 0 ? "#fef2f2" : "#f0fdf4",
          border: `1px solid ${c.currently_due_amount > 0 ? "#fecaca" : "#bbf7d0"}`,
          borderRadius: "10px", padding: "14px 18px",
          marginBottom: "24px", display: "flex",
          justifyContent: "space-between", alignItems: "center"
        }}>
          <span style={{ fontWeight: "700", fontSize: "14px",
            color: c.currently_due_amount > 0 ? "#dc2626" : "#15803d" }}>
            {c.currently_due_amount > 0
              ? `🔴 Balance Due: Rs ${parseFloat(c.currently_due_amount).toFixed(2)}`
              : "✅ All dues cleared!"}
          </span>
          {c.last_paid_amount > 0 && (
            <span style={{ fontSize: "13px", color: "#64748b" }}>
              Last Paid: Rs {parseFloat(c.last_paid_amount).toFixed(2)}
            </span>
          )}
        </div>

        {/* Month Stacks */}
        {sortedKeys.length === 0 ? (
          <div style={{ textAlign: "center", color: "#94a3b8",
            padding: "40px" }}>No payment history found.</div>
        ) : (
          sortedKeys.map(key => {
            const { label, bills, total } = grouped[key];
            return (
              <div key={key} style={{
                border: "1px solid #e2e8f0", borderRadius: "12px",
                marginBottom: "16px", overflow: "hidden"
              }}>
                {/* Month Header */}
                <div style={{
                  backgroundColor: "#1e3a5f", padding: "12px 16px",
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontWeight: "800", color: "white", fontSize: "15px" }}>
                      📅 {label}
                    </span>
                    <span style={{
                      backgroundColor: "rgba(255,255,255,0.15)", color: "#93c5fd",
                      fontSize: "11px", fontWeight: "700",
                      padding: "2px 8px", borderRadius: "20px"
                    }}>{bills.length} bills</span>
                  </div>
                  <span style={{ fontWeight: "800", color: "#fcd34d", fontSize: "15px" }}>
                    Rs {total.toFixed(2)}
                  </span>
                </div>

                {/* Bills */}
                {bills.map((bill, billIdx) => {
                  const billItems = detail.BillItems.filter(i => i.bid === bill.bid);
                  const billDate = new Date(bill.created_at).toLocaleDateString("en-IN", {
                    day: "2-digit", month: "short"
                  });
                  return (
                    <div key={bill.bid} style={{
                      borderBottom: billIdx < bills.length - 1
                        ? "1px solid #f1f5f9" : "none"
                    }}>
                      <div style={{
                        display: "flex", justifyContent: "space-between",
                        alignItems: "center", padding: "10px 16px",
                        backgroundColor: "#f8fafc", flexWrap: "wrap", gap: "8px"
                      }}>
                        <div style={{ display: "flex", gap: "10px",
                          alignItems: "center" }}>
                          <span style={{
                            width: "22px", height: "22px", borderRadius: "50%",
                            backgroundColor: "#1e3a5f", color: "white",
                            fontSize: "10px", fontWeight: "700",
                            display: "flex", alignItems: "center",
                            justifyContent: "center"
                          }}>{billIdx + 1}</span>
                          <span style={{ fontWeight: "700", color: "#1e3a5f",
                            fontSize: "13px" }}>Bill #{bill.bid}</span>
                          <span style={{ fontSize: "12px",
                            color: "#64748b" }}>{billDate}</span>
                        </div>
                        <span style={{ fontWeight: "800", color: "#1e3a5f",
                          fontSize: "14px" }}>
                          Rs {bill.total_amount.toFixed(2)}
                        </span>
                      </div>
                      <div style={{ padding: "8px 16px 8px 48px" }}>
                        {billItems.map((item, i) => (
                          <div key={i} style={{
                            display: "flex", justifyContent: "space-between",
                            fontSize: "12px", padding: "3px 0",
                            borderBottom: "1px solid #f8fafc", color: "#64748b"
                          }}>
                            <span>{item.product_name} x{item.quantity}</span>
                            <span style={{ fontWeight: "600", color: "#475569" }}>
                              Rs {parseFloat(item.subtotal).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Month Total Footer */}
                <div style={{
                  backgroundColor: "#f0fdf4", padding: "10px 16px",
                  borderTop: "1px solid #bbf7d0",
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center"
                }}>
                  <span style={{ fontWeight: "700", color: "#15803d",
                    fontSize: "13px" }}>
                    ✅ Month Total: Rs {total.toFixed(2)}
                  </span>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                    {bills.length} entries
                  </span>
                </div>
              </div>
            );
          })
        )}
      </main>
      <Footer />
    </div>
  );
}

export default PaymentHistory;