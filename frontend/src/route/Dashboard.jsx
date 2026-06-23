import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import "../style/dashboard.css";
import Header from "../components/Hader";
import Footer from "../components/Footer";

function Dashboard() {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState("bills");
  const [bills, setBills] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedBill, setSelectedBill] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      setLoading(true);
      setError("");
      const [billRes, customerRes] = await Promise.all([
        api.get("/bill/get_all_bills"),
        api.get("/customer/get_all_customer"),
      ]);
      setBills(billRes.data || []);
      setCustomers(customerRes.data || []);
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }

  const totalDue = useMemo(
    () =>
      customers.reduce(
        (sum, customer) => sum + Number(customer.currently_due_amount || 0),
        0
      ),
    [customers]
  );

  const totalBillValue = useMemo(
    () => bills.reduce((sum, bill) => sum + Number(bill.total_amount || 0), 0),
    [bills]
  );

  const viewBill = async (billId) => {
    try {
      setDetailLoading(true);
      setSelectedCustomer(null);
      const res = await api.get(`/bill/get_bill/${billId}`);
      setSelectedBill(res.data);
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to load bill");
    } finally {
      setDetailLoading(false);
    }
  };

  const viewCustomer = async (customerId) => {
    try {
      setDetailLoading(true);
      setSelectedBill(null);
      const res = await api.get(`/customer/get_customer/${customerId}`);
      setSelectedCustomer(res.data);
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to load customer");
    } finally {
      setDetailLoading(false);
    }
  };

  const formatDate = (value) => {
    if (!value) return "-";
    return new Date(value).toLocaleString();
  };

  const customerBillItems = selectedCustomer?.Bills?.flatMap((group) => group) || [];

  return (
    <div className="dashboard">
      <Header />

      <main className="dashboard-shell">
        <section className="dashboard-hero">
          <div>
            <p className="eyebrow">Smart Shop</p>
            <h1>Dashboard</h1>
            <p>Fast billing, clean customer tracking, and live shop totals.</p>
          </div>
          <button className="refresh-btn" onClick={loadDashboardData}>
            Refresh
          </button>
        </section>

        <section className="dashboard-buttons">
          <button className="dashboard-btn bill" onClick={() => navigate("/billing")}>
            <span>Bill</span>
            <b>Create invoice</b>
          </button>

          <button className="dashboard-btn account" onClick={() => navigate("/accounts")}>
            <span>Account</span>
            <b>Owner tools</b>
          </button>

          <button className="dashboard-btn product" onClick={() => navigate("/products")}>
            <span>Add Product</span>
            <b>Manage stock</b>
          </button>

          <button className="dashboard-btn category" onClick={() => navigate("/categories")}>
            <span>Categories</span>
            <b>Organize items</b>
          </button>
        </section>

        <section className="dashboard-stats">
          <div className="stat-card">
            <h3>Total Bills</h3>
            <p>{bills.length}</p>
          </div>
          <div className="stat-card">
            <h3>Bill Value</h3>
            <p>Rs {totalBillValue.toFixed(2)}</p>
          </div>
          <div className="stat-card">
            <h3>Customers</h3>
            <p>{customers.length}</p>
          </div>
          <div className="stat-card">
            <h3>Pending Amount</h3>
            <p>Rs {totalDue.toFixed(2)}</p>
          </div>
        </section>

        <section className="records-section">
          <div className="record-tabs">
            <button
              className={activeView === "bills" ? "active" : ""}
              onClick={() => setActiveView("bills")}
            >
              Bills
            </button>
            <button
              className={activeView === "customers" ? "active" : ""}
              onClick={() => setActiveView("customers")}
            >
              Customer
            </button>
          </div>

          {error && <div className="dashboard-error">{error}</div>}

          <div className="records-layout">
            <div className="records-table-wrap">
              {loading ? (
                <div className="empty-record">Loading records...</div>
              ) : activeView === "bills" ? (
                <table className="records-table">
                  <thead>
                    <tr>
                      <th>Bill ID</th>
                      <th>Customer ID</th>
                      <th>Total</th>
                      <th>Created</th>
                      <th>View</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills.map((bill) => (
                      <tr key={bill.bid}>
                        <td>#{bill.bid}</td>
                        <td>{bill.cid}</td>
                        <td>Rs {Number(bill.total_amount || 0).toFixed(2)}</td>
                        <td>{formatDate(bill.created_at)}</td>
                        <td>
                          <button className="eye-btn" onClick={() => viewBill(bill.bid)}>
                            Eye
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="records-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Email</th>
                      <th>Due</th>
                      <th>View</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((customer) => (
                      <tr key={customer.cid}>
                        <td>{customer.cname}</td>
                        <td>{customer.cphone}</td>
                        <td>{customer.cmail}</td>
                        <td>
                          Rs {Number(customer.currently_due_amount || 0).toFixed(2)}
                        </td>
                        <td>
                          <button
                            className="eye-btn"
                            onClick={() => navigate(`/accounts?cid=${customer.cid}`)}
                          >
                            Eye
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <aside className="detail-panel">
              {detailLoading ? (
                <div className="empty-record">Opening details...</div>
              ) : selectedBill ? (
                <>
                  <span className="panel-label">Bill Detail</span>
                  <h2>Bill #{selectedBill.bid}</h2>
                  <dl>
                    <div>
                      <dt>Customer</dt>
                      <dd>{selectedBill.cname}</dd>
                    </div>
                    <div>
                      <dt>Customer ID</dt>
                      <dd>{selectedBill.cid}</dd>
                    </div>
                    <div>
                      <dt>Total</dt>
                      <dd>Rs {Number(selectedBill.total_amount || 0).toFixed(2)}</dd>
                    </div>
                    <div>
                      <dt>Created</dt>
                      <dd>{formatDate(selectedBill.created_at)}</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <div className="empty-record">
                  Click an Eye button to open the selected record.
                </div>
              )}
            </aside>
          </div>
        </section>
      </main>

      {selectedCustomer && (
        <section className="customer-detail-page">
          <div className="customer-detail-shell">
            <div className="customer-detail-top">
              <div>
                <span className="panel-label">Customer Detail</span>
                <h2>{selectedCustomer.Customer?.cname}</h2>
                <p>
                  {selectedCustomer.Customer?.cphone} -{" "}
                  {selectedCustomer.Customer?.cmail}
                </p>
              </div>
              <button
                className="close-detail-btn"
                onClick={() => setSelectedCustomer(null)}
              >
                Close
              </button>
            </div>

            <div className="customer-metric-grid">
              <div className="customer-metric due">
                <span>Total Due Amount</span>
                <strong>
                  Rs{" "}
                  {Number(
                    selectedCustomer.Customer?.currently_due_amount || 0
                  ).toFixed(2)}
                </strong>
              </div>
              <div className="customer-metric">
                <span>Last Paid Amount</span>
                <strong>
                  Rs{" "}
                  {Number(
                    selectedCustomer.Customer?.last_paid_amount || 0
                  ).toFixed(2)}
                </strong>
              </div>
              <div className="customer-metric">
                <span>Bill Item Rows</span>
                <strong>{customerBillItems.length}</strong>
              </div>
            </div>

            <div className="bill-items-section">
              <div className="bill-items-head">
                <h3>Bill Items</h3>
                <span>All rows from /customer/get_customer</span>
              </div>

              {customerBillItems.length === 0 ? (
                <div className="empty-record">No bill items found.</div>
              ) : (
                <div className="bill-items-table-wrap">
                  <table className="bill-items-table">
                    <thead>
                      <tr>
                        <th>Bill Item ID</th>
                        <th>Bill ID</th>
                        <th>Product ID</th>
                        <th>Quantity</th>
                        <th>Unit Price</th>
                        <th>Subtotal</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerBillItems.map((item) => (
                        <tr key={item.biid}>
                          <td>#{item.biid}</td>
                          <td>#{item.bid}</td>
                          <td>{item.pid}</td>
                          <td>{item.quantity}</td>
                          <td>Rs {Number(item.unit_price || 0).toFixed(2)}</td>
                          <td>Rs {Number(item.subtotal || 0).toFixed(2)}</td>
                          <td>{formatDate(item.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}

export default Dashboard;
