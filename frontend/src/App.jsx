import { BrowserRouter, Routes, Route } from "react-router-dom";


import Billing from "./route/Billing";
import Accounts from "./route/accounts";
import Products from "./route/products";
import Categories from "./route/Categories";
import Login from "./auth/Login";
import Signup from "./auth/Signup";
import Dashboard from "./route/Dashboard";
import VerifyOtp from "./auth/VerifyOtp";
import PaymentHistory from "./route/PaymentHistory";
import AddCustomer from "./route/AddCustomer";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
      
        <Route path="Dashboard" element={<Dashboard />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/AddCustomer" element={<AddCustomer />} />
        <Route path="/products" element={<Products />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/PaymentHistory/:cid" element={<PaymentHistory />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
