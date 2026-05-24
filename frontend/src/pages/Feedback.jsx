import { useNavigate } from "react-router-dom";
import { useState } from "react";

export default function Feedback() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", type: "feedback", message: "" });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.message.trim()) return;
    // TODO: gửi lên backend hoặc email service
    setSubmitted(true);
  };

  return (
    <div className="feedback-wrapper">
      <button className="bmc-back" onClick={() => navigate("/")}>
        ← Quay lại
      </button>

      <div className="feedback-layout">
        {/* Form */}
        <div className="feedback-card">
          <h1 className="feedback-title">Feedback & Liên hệ</h1>
          <div className="feedback-avatar">
            <img src="/teio.jpg" alt="avatar" className="feedback-avatar-img" />
          </div>
          <p className="feedback-subtitle">
            Góp ý, báo lỗi hoặc đơn giản là nói xin chào — mình đọc hết!
          </p>

          {submitted ? (
            <div className="feedback-success">
              <p>Gửi thành công! Cảm ơn bạn đã gửi! Mình sẽ phản hồi sớm nhất có thể.</p>
              <button className="tool-btn" onClick={() => { setSubmitted(false); setForm({ name: "", email: "", type: "feedback", message: "" }); }}>
                Gửi thêm
              </button>
            </div>
          ) : (
            <form className="feedback-form" onSubmit={handleSubmit}>
              <div className="feedback-row">
                <label>Tên</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Tên của bạn (không bắt buộc)"
                />
              </div>

              <div className="feedback-row">
                <label>Email</label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="email@example.com (không bắt buộc)"
                />
              </div>

              <div className="feedback-row">
                <label>Loại</label>
                <div className="feedback-type-group">
                  {[
                    { value: "feedback", label: "Góp ý" },
                    { value: "bug", label: "Báo lỗi" },
                    { value: "feature", label: "Đề xuất tính năng" },
                    { value: "other", label: "Khác" },
                  ].map(({ value, label }) => (
                    <button
                      type="button"
                      key={value}
                      className={`type-chip ${form.type === value ? "active" : ""}`}
                      onClick={() => setForm((p) => ({ ...p, type: value }))}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="feedback-row">
                <label>Nội dung <span style={{ color: "#f85149" }}>*</span></label>
                <textarea
                  name="message"
                  value={form.message}
                  onChange={handleChange}
                  placeholder="Viết gì đó..."
                  rows={5}
                  required
                />
              </div>

              <button type="submit" className="feedback-submit">
                Gửi
              </button>
            </form>
          )}
        </div>

        {/* Contact info */}
        <div className="contact-card">
          <h2 className="contact-title">Liên hệ trực tiếp</h2>
          <div className="contact-list">
            <a className="contact-item" href="mailto:tuannguyen205111@gmail.com">
              <span>tuannguyen205111@gmail.com</span>
            </a>
            <a className="contact-item" href="https://github.com/AIVIETNAM-AIO-felixdoit/pdf-editor" target="_blank" rel="noreferrer">
              <span>GitHub</span>
            </a>
            <a className="contact-item" href="https://www.facebook.com/nguyenvdtuan/" target="_blank" rel="noreferrer">
              <span>Facebook</span>
            </a>
          </div>

          <div className="contact-note">
            <p>Thường phản hồi trong vòng <strong>24–48 giờ</strong>.</p>
            <p>Báo lỗi kèm mô tả chi tiết sẽ được ưu tiên xử lý.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
