import { useState } from "react";
import api from "../api/api";
import { Link, useNavigate } from "react-router-dom";
import "./auth.css";

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false); // NEW
  const navigate = useNavigate();

  const loginAdmin = async (e) => {
    e.preventDefault();

    try {
      const response = await api.post("/admin/login", {
  username: username,
  password: password,
});
     sessionStorage.setItem("token", response.data.token);
    sessionStorage.setItem("admin", JSON.stringify(response.data.admin));

      navigate("/Dashboard");

    } catch (err) {
      alert(err?.response?.data?.detail || "Login Failed");
    }
  };

  return (
    <div className="auth-page">
      <section className="auth-shell" aria-label="Admin login">
        <div className="auth-panel">
          <div className="auth-brand">
            <span className="auth-brand-mark">SS</span>
            <span>Smart Shop</span>
          </div>

          <div className="auth-panel-copy">
            <p className="auth-kicker">Store command center</p>
            <h1>Run billing, stock, and accounts from one clean desk.</h1>
            <p>
              Secure admin access for daily store operations, inventory checks,
              and customer billing.
            </p>
          </div>

          <div className="auth-stats" aria-label="Store management highlights">
            <div>
              <strong>Live</strong>
              <span>Inventory</span>
            </div>
            <div>
              <strong>Fast</strong>
              <span>Billing</span>
            </div>
            <div>
              <strong>Secure</strong>
              <span>Admin</span>
            </div>
          </div>
        </div>

        <div className="auth-card">
          <div className="auth-header">
            <p className="auth-kicker">Welcome back</p>
            <h2>Login to your account</h2>
            <p>Enter your admin credentials to continue.</p>
          </div>

          <form className="auth-form" onSubmit={loginAdmin}>
            <label>
              <span>UserName</span>
              <input
                type="text"
                placeholder="UserName"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </label>

            <label>
              <span>Password</span>
              {/* NEW: wrapper to position the eye icon inside the input */}
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ width: "100%", paddingRight: "40px", boxSizing: "border-box" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#6b7280",
                    fontSize: "16px",
                    lineHeight: 1
                  }}
                >
                  {showPassword ? (
                    // Eye-off icon
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    // Eye icon
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </label>

            <button type="submit" className="auth-submit">
              Login
            </button>
          </form>

          <p className="auth-switch">
            New to Smart Shop? <Link to="/signup">Create an account</Link>
          </p>
        </div>
      </section>
    </div>
  );
}

export default Login;