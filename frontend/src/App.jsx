import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Editor from "./pages/Editor";
import BuyMeCoffee from "./pages/BuyMeCoffee";
import Feedback from "./pages/Feedback";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/editor" element={<Editor />} />
        <Route path="/buy-me-coffee" element={<BuyMeCoffee />} />
        <Route path="/feedback" element={<Feedback />} />
      </Routes>
    </BrowserRouter>
  );
}