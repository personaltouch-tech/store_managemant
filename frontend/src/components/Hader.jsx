import "../style/header.css";
import logo from "../assets/image.png"; // your logo image

function Header() {
  return (
    <header className="header">
      <div className="header-left">
        <img src={logo} alt="Gangadhar Provision Store" className="logo" />
      </div>

      <div className="header-center">
        <h2>Gangadhar Provision Store</h2>
        <p>Billing & Monthly Account System</p>
      </div>

      <div className="header-right">
        <span>Owner: Gangadhar</span>
      </div>
    </header>
  );
}

export default Header;