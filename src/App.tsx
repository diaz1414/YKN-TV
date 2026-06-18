import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import ChannelDetail from './pages/ChannelDetail';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/watch/:id" element={<ChannelDetail />} />
        <Route path="/ykn-c0ntr0l-hq" element={<AdminDashboard />} />
        <Route path="/ykn-c0ntr0l-hq/dashboard" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
