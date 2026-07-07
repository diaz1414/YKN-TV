import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import ChannelDetail from './pages/ChannelDetail';
import AdminDashboard from './pages/AdminDashboard';
import StatusPage from './pages/StatusPage';

// Komponen pengontrol pemuatan dan pembersihan iklan secara dinamis
function AdsController() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    const isWatchPage = path.startsWith('/watch/');
    const isAdminPage = path.startsWith('/ykn-c0ntr0l-hq');

    // Deteksi sesi developer atau admin
    const role = localStorage.getItem('ykn_admin_role') || sessionStorage.getItem('ykn_admin_role');
    const isAdmin = role === 'developer' || role === 'admin' || localStorage.getItem('ykn_admin_logged_in') === 'true' || sessionStorage.getItem('ykn_admin_logged_in') === 'true';

    // Deteksi keberadaan script Monetag di DOM saat ini (Vignette, Popunder, atau Push Notification)
    const hasMonetag = !!(
      document.querySelector('script[src*="nap5k.com"]') ||
      document.querySelector('script[src*="al5sm.com"]') ||
      document.querySelector('script[src*="5gvci.com"]')
    );

    if (isAdmin) {
      // Jika terdeteksi admin/developer dan iklan masih ada di DOM (karena baru login/berpindah),
      // lakukan reload sekali untuk membersihkannya secara bersih dari memori.
      if (hasMonetag) {
        console.log('[AdsController] Admin/Developer session active with Monetag loaded. Purging ads...');
        window.location.reload();
      }
      return;
    }

    if ((isWatchPage || isAdminPage) && hasMonetag) {
      console.log('[AdsController] Watch/Admin page detected with active Monetag. Purging ads...');
      window.location.reload();
    }
  }, [location]);

  return null;
}

function App() {
  return (
    <Router>
      <AdsController />
      <div className="min-h-screen">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/status" element={<StatusPage />} />
          <Route path="/watch/:id" element={<ChannelDetail />} />
          <Route path="/ykn-c0ntr0l-hq" element={<AdminDashboard />} />
          <Route path="/ykn-c0ntr0l-hq/dashboard" element={<AdminDashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
