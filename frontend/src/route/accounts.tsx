import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import Header from "../components/Hader";
import Footer from "../components/Footer";
import "../style/accounts.css";

function Accounts() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    cname: "",
    cphone: "",
    cmail: "",
    currently_due_amount: "0",
    last_paid_amount: "0",
  });

  useEffect(() => {
    async function loadInitialData() {
      await loadCustomers();
    }

    loadInitialData();
  }, []);

  async function loadCustomers() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/customer/get_all_customer");
      setCustomers(res.data || []);
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }

  const filteredCustomers = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return customers;
    return customers.filter((customer) =>
      [customer.cname, customer.cphone, customer.cmail]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value))
    );
  }, [customers, search]);

  const totalDue = useMemo(
    () =>
      customers.reduce(
        (sum, customer) => sum + Number(customer.currently_due_amount || 0),
        0
      ),
    [customers]
  );

  const totalPaid = useMemo(
    () =>
      customers.reduce(
        (sum, customer) => sum + Number(customer.last_paid_amount || 0),
        0
      ),
    [customers]
  );

  const accountItems =
    selectedCustomer?.BillItems ||
    selectedCustomer?.Bills?.flatMap((group) => group) ||
    [];

  const viewCustomer = async (customerId) => {
    try {
      setDetailLoading(true);
      setError("");
      const res = await api.get(`/customer/get_customer/${customerId}`);
      setSelectedCustomer(res.data);
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to load customer account");
    } finally {
      setDetailLoading(false);
    }
  };

  const createCustomer = async () => {
    if (!form.cname.trim() || !form.cphone.trim()) {
      setError("Customer name and phone are required");
      return;
    }

    try {
      setSaving(true);
      setError("");
      await api.post("/customer/create_customer", {
        cname: form.cname.trim(),
        cphone: form.cphone.trim(),
        cmail: form.cmail.trim(),
        currently_due_amount: Number(form.currently_due_amount || 0),
        last_paid_amount: Number(form.last_paid_amount || 0),
      });
      setForm({
        cname: "",
        cphone: "",
        cmail: "",
        currently_due_amount: "0",
        last_paid_amount: "0",
      });
      setShowForm(false);
      await loadCustomers();
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to create customer");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (value) => {
    if (!value) return "-";
    return new Date(value).toLocaleString();
  };

  return (
    <div className="accounts-page">
      <Header />

      <main className="accounts-shell">
        <section className="accounts-topbar">
          <div>
            <button className="ghost-btn" onClick={() => navigate("/Dashboard")}>
              Back
            </button>
            <h1>Accounts</h1>
            <p>Customer dues, payments, and bill history in one place.</p>
          </div>
          <button className="primary-account-btn" onClick={() => setShowForm(true)}>
            Add Customer
          </button>
        </section>

        {error && <div className="accounts-error">{error}</div>}

        <section className="account-stats">
          <div>
            <span>Customers</span>
            <strong>{customers.length}</strong>
          </div>
          <div>
            <span>Total Due</span>
            <strong>Rs {totalDue.toFixed(2)}</strong>
          </div>
          <div>
            <span>Total Paid</span>
            <strong>Rs {totalPaid.toFixed(2)}</strong>
          </div>
        </section>

        <section className="accounts-card">
          <div className="accounts-toolbar">
            <h2>Customer Accounts</h2>
            <input
              type="search"
              placeholder="Search name, phone, email"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {loading ? (
            <div className="accounts-empty">Loading customers...</div>
          ) : (
            <div className="accounts-table-wrap">
              <table className="accounts-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Due</th>
                    <th>Last Paid</th>
                    <th>View</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((customer) => (
                    <tr key={customer.cid}>
                      <td>{customer.cname}</td>
                      <td>{customer.cphone}</td>
                      <td>{customer.cmail || "-"}</td>
                      <td>Rs {Number(customer.currently_due_amount || 0).toFixed(2)}</td>
                      <td>Rs {Number(customer.last_paid_amount || 0).toFixed(2)}</td>
                      <td>
                        <button
                          className="eye-btn"
                          onClick={() => viewCustomer(customer.cid)}
                        >
                          Eye
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredCustomers.length === 0 && (
                <div className="accounts-empty">No customers found.</div>
              )}
            </div>
          )}
        </section>
      </main>

      {showForm && (
        <section className="account-modal">
          <div className="account-form">
            <h2>Add Customer</h2>
            <label>Name</label>
            <input
              value={form.cname}
              onChange={(event) => setForm({ ...form, cname: event.target.value })}
            />
            <label>Phone</label>
            <input
              value={form.cphone}
              onChange={(event) => setForm({ ...form, cphone: event.target.value })}
            />
            <label>Email</label>
            <input
              value={form.cmail}
              onChange={(event) => setForm({ ...form, cmail: event.target.value })}
            />
            <label>Opening Due</label>
            <input
              type="number"
              value={form.currently_due_amount}
              onChange={(event) =>
                setForm({ ...form, currently_due_amount: event.target.value })
              }
            />
            <label>Last Paid</label>
            <input
              type="number"
              value={form.last_paid_amount}
              onChange={(event) =>
                setForm({ ...form, last_paid_amount: event.target.value })
              }
            />
            <div className="account-form-actions">
              <button onClick={() => setShowForm(false)}>Cancel</button>
              <button onClick={createCustomer} disabled={saving}>
                {saving ? "Saving..." : "Save Customer"}
              </button>
            </div>
          </div>
        </section>
      )}

      {selectedCustomer && (
        <section className="account-detail-page">
          <div className="account-detail-shell">
            <div className="account-detail-top">
              <div>
                <span>Account Detail</span>
                <h2>{selectedCustomer.Customer?.cname}</h2>
                <p>
                  {selectedCustomer.Customer?.cphone} -{" "}
                  {selectedCustomer.Customer?.cmail || "No email"}
                </p>
              </div>
              <button onClick={() => setSelectedCustomer(null)}>Close</button>
            </div>

            {detailLoading ? (
              <div className="accounts-empty">Opening account...</div>
            ) : (
              <>
                <div className="account-detail-metrics">
                  <div className="due">
                    <span>Total Due Amount</span>
                    <strong>
                      Rs{" "}
                      {Number(
                        selectedCustomer.Customer?.currently_due_amount || 0
                      ).toFixed(2)}
                    </strong>
                  </div>
                  <div>
                    <span>Last Paid Amount</span>
                    <strong>
                      Rs{" "}
                      {Number(
                        selectedCustomer.Customer?.last_paid_amount || 0
                      ).toFixed(2)}
                    </strong>
                  </div>
                  <div>
                    <span>Bill Rows</span>
                    <strong>{accountItems.length}</strong>
                  </div>
                </div>

                <div className="account-items-card">
                  <div className="account-items-head">
                    <h3>Bill Items</h3>
                    <span>Product-wise customer ledger</span>
                  </div>
                  <div className="accounts-table-wrap">
                    <table className="accounts-table account-items-table">
                      <thead>
                        <tr>
                          <th>Bill No</th>
                          <th>Product Name</th>
                          <th>Quantity</th>
                          <th>Unit Price</th>
                          <th>Subtotal</th>
                          <th>Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accountItems.map((item) => (
                          <tr key={`${item.bid}-${item.pid}-${item.created_at}`}>
                            <td>#{item.bid}</td>
                            <td>{item.product_name || `Product #${item.pid}`}</td>
                            <td>{item.quantity}</td>
                            <td>Rs {Number(item.unit_price || 0).toFixed(2)}</td>
                            <td>Rs {Number(item.subtotal || 0).toFixed(2)}</td>
                            <td>{formatDate(item.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {accountItems.length === 0 && (
                      <div className="accounts-empty">No bill items found.</div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}

export default Accounts;
