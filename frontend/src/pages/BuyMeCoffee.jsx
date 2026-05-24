import { useNavigate } from "react-router-dom";

const COFFEES = [
  { label: "1 ly cà phê", amount: 1, price: "~25.000đ" },
  { label: "2 ly cà phê", amount: 2, price: "~50.000đ" },
  { label: "3 ly cà phê", amount: 3, price: "~75.000đ" },
];

export default function BuyMeCoffee() {
  const navigate = useNavigate();

  const handleSupport = (amount) => {
    alert(`Cảm ơn bạn đã ủng hộ ${amount} ly cà phê! ☕`);
  };

  return (
    <div className="bmc-wrapper">
      <button className="bmc-back" onClick={() => navigate("/")}>
        ← Quay lại
      </button>

      <div className="bmc-layout">
        {/* Left panel: QR code */}
        <div className="bmc-panel-left">
          <h2 className="bmc-panel-title">Quét QR để ủng hộ</h2>
          <img src="/qr bank.jpg" alt="QR chuyển khoản" className="bmc-qr-img" />
          <p className="bmc-qr-label">Chuyển khoản ngân hàng</p>
        </div>

        {/* Right panel: coffee widget */}
        <div className="bmc-panel-right">
          <div className="bmc-avatar">
            <img src="/tachyon.jpg" alt="avatar" className="bmc-avatar-img" />
          </div>
          <h1 className="bmc-title">Buy me a coffee</h1>
          <p className="bmc-subtitle">
            Nếu PDF Editor có ích với bạn, hãy mời mình một ly cà phê nhé!
            <br />
            Mỗi ly giúp mình có thêm động lực phát triển thêm tính năng mới.
          </p>
          <div className="bmc-options">
            {COFFEES.map(({ label, amount, price }) => (
              <button
                key={amount}
                className="bmc-btn"
                onClick={() => handleSupport(amount)}
              >
                <span className="bmc-btn-label">{label}</span>
                <span className="bmc-btn-price">{price}</span>
              </button>
            ))}
          </div>
          <p className="bmc-thanks">Cảm ơn bạn rất nhiều!</p>
        </div>
      </div>
    </div>
  );
}
