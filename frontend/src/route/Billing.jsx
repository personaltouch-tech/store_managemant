import { useNavigate } from "react-router-dom";

function Billing() {
  const navigate = useNavigate();

  return (
    <div style={{ padding: "20px" }}>
      <h1>🧾 Billing Page</h1>

      <p>Create bills for customers.</p>

      <button onClick={() => navigate("/Dashboard")}>
        Back to Dashboard
      </button>
    </div>
  );
}

export default Billing;