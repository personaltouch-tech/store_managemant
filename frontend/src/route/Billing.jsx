import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import Header from "../components/Hader";
import Footer from "../components/Footer";
import "../style/billing.css";

const API_BASE = api.defaults.baseURL || "";

function Billing() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [quantities, setQuantities] = useState({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  async function loadBillingData() {
    try {
      setLoading(true);
      const [productRes, customerRes] = await Promise.all([
        api.get("/products/get_products"),
        api.get("/customer/get_all_customer"),
      ]);
      setProducts(productRes.data || []);
      setCustomers(customerRes.data || []);
      if (customerRes.data?.length) {
        setSelectedCustomer(String(customerRes.data[0].cid));
      }
    } catch (err) {
      setNotice(err?.response?.data?.detail || "Failed to load billing data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function loadInitialData() {
      await loadBillingData();
    }

    loadInitialData();
  }, []);

  const selectedItems = useMemo(
    () =>
      products
        .filter((product) => (quantities[product.pid] || 0) > 0)
        .map((product) => ({
          ...product,
          quantity: quantities[product.pid],
          subtotal: Number(product.price) * quantities[product.pid],
        })),
    [products, quantities]
  );

  const filteredProducts = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return products;
    return products.filter((product) =>
      product.product_name.toLowerCase().includes(value)
    );
  }, [products, search]);

  const totalAmount = selectedItems.reduce((sum, item) => sum + item.subtotal, 0);
  const canGenerate = selectedItems.length > 0 && selectedCustomer && !saving;

  const changeQuantity = (pid, nextQuantity) => {
    setQuantities((prev) => ({
      ...prev,
      [pid]: Math.max(0, nextQuantity),
    }));
  };

  const generateBill = async () => {
    if (!canGenerate) return;

    try {
      setSaving(true);
      setNotice("");
      const billRes = await api.post("/bill/create_bill", {
        cid: Number(selectedCustomer),
      });
      const billId = billRes.data;

      await Promise.all(
        selectedItems.map((item) =>
          api.post("/bill/create_billItems", {
            bid: billId,
            pid: item.pid,
            quantity: item.quantity,
            unit_price: Number(item.price),
          })
        )
      );

      setQuantities({});
      setNotice(`Bill #${billId} generated successfully`);
    } catch (err) {
      setNotice(err?.response?.data?.detail || "Failed to generate bill");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="billing-page">
      <Header />

      <main className="billing-shell">
        <section className="billing-topbar">
          <div>
            <button className="ghost-btn" onClick={() => navigate("/Dashboard")}>
              Back
            </button>
            <h1>Billing</h1>
            <p>Select products, choose a customer, then generate the bill.</p>
          </div>

          <div className="billing-summary">
            <span>{selectedItems.length} items</span>
            <strong>Rs {totalAmount.toFixed(2)}</strong>
            <button
              className="generate-btn"
              disabled={!canGenerate}
              onClick={generateBill}
            >
              {saving ? "Generating..." : "Generate Bill"}
            </button>
          </div>
        </section>

        {notice && <div className="billing-notice">{notice}</div>}

        <section className="billing-grid">
          <aside className="billing-panel">
            <label>Customer</label>
            <select
              value={selectedCustomer}
              onChange={(event) => setSelectedCustomer(event.target.value)}
            >
              <option value="">Select customer</option>
              {customers.map((customer) => (
                <option key={customer.cid} value={customer.cid}>
                  {customer.cname} - {customer.cphone}
                </option>
              ))}
            </select>

            <div className="receipt-preview">
              <div className="receipt-head">
                <span>Current Bill</span>
                <strong>Rs {totalAmount.toFixed(2)}</strong>
              </div>
              {selectedItems.length === 0 ? (
                <p className="muted">No products selected yet.</p>
              ) : (
                selectedItems.map((item) => (
                  <div className="receipt-row" key={item.pid}>
                    <div>
                      <strong>{item.product_name}</strong>
                      <span>
                        {item.quantity} x Rs {Number(item.price).toFixed(2)}
                      </span>
                    </div>
                    <b>Rs {item.subtotal.toFixed(2)}</b>
                  </div>
                ))
              )}
            </div>
          </aside>

          <section className="product-picker">
            <div className="picker-toolbar">
              <h2>Products</h2>
              <input
                type="search"
                placeholder="Search products"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            {loading ? (
              <div className="empty-state">Loading products...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="empty-state">No products found.</div>
            ) : (
              <div className="billing-product-grid">
                {filteredProducts.map((product) => {
                  const qty = quantities[product.pid] || 0;
                  const imageSrc = product.image_url
                    ? `${API_BASE}${product.image_url}`
                    : null;

                  return (
                    <article
                      className={`billing-product-card ${qty ? "selected" : ""}`}
                      key={product.pid}
                    >
                      <div className="billing-product-image">
                        {imageSrc ? (
                          <img src={imageSrc} alt={product.product_name} />
                        ) : (
                          <span>{product.product_name.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="billing-product-body">
                        <h3>{product.product_name}</h3>
                        <p>{product.unit || "Unit"}</p>
                        <strong>Rs {Number(product.price).toFixed(2)}</strong>
                      </div>
                      <div className="quantity-control">
                        <button
                          onClick={() => changeQuantity(product.pid, qty - 1)}
                          disabled={qty === 0}
                        >
                          -
                        </button>
                        <span>{qty}</span>
                        <button onClick={() => changeQuantity(product.pid, qty + 1)}>
                          +
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default Billing;
