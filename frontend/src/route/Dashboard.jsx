import { useNavigate } from "react-router-dom";
import "../style/dashboard.css";
import Header from "../components/Hader";
import Footer from "../components/Footer";

function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="dashboard">
      <div>
        <Header />
      </div>

      <h1 className="dashboard-title">Smart Shop Dashboard</h1>

      <div className="dashboard-buttons">
        <button
          className="dashboard-btn"
          onClick={() => navigate("/billing")}
        >
          BILL
        </button>

        <button
          className="dashboard-btn"
          onClick={() => navigate("/accounts")}
        >
          ACCOUNT
        </button>

        <button
          className="dashboard-btn"
          onClick={() => navigate("/products")}
        >
          ADD PRODUCT
        </button>

        <button
          className="dashboard-btn"
          onClick={() => navigate("/categories")}
        >
          CATEGORIES
        </button>
      </div>

      <div className="dashboard-stats">
       
        <div className="stat-card">
          <h3>Today's Bills</h3>
          <p>0</p>
        </div>

        <div className="stat-card">
          <h3>Pending Amount</h3>
          <p>Rs 0</p>
        </div>
      </div>

      <div>
        <Footer />
      </div>
    </div>
  );
}

export default Dashboard;
