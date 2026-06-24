import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import ChannelDetail from './pages/ChannelDetail';
import AdminDashboard from './pages/AdminDashboard';

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
      // Jika masuk ke halaman nonton/admin dan iklan masih aktif di memori (dari halaman utama),
      // lakukan reload halaman sekali untuk membersihkan seluruh event listener iklan dari memori.
      console.log('[AdsController] Watch/Admin page detected with active Monetag. Purging ads by reloading page...');
      window.location.reload();
    } else if (!isWatchPage && !isAdminPage && !hasMonetag) {
      // Jika kembali ke halaman utama dan iklan belum dimuat,
      // suntikkan iklan secara dinamis tanpa reload halaman untuk transisi yang mulus.
      console.log('[AdsController] Home page detected without Monetag. Injecting ads dynamically...');
      
      // 1. Monetag Vignette Tag
      const s1 = document.createElement('script');
      s1.dataset.zone = '11195257';
      s1.src = 'https://nap5k.com/tag.min.js';
      
      // 2. Monetag Popunder Tag
      const s2 = document.createElement('script');
      s2.dataset.zone = '11195261';
      s2.src = 'https://al5sm.com/tag.min.js';
      
      // 3. Monetag Push Notification Tag
      const s3 = document.createElement('script');
      s3.src = 'https://5gvci.com/act/files/tag.min.js?z=11195471';
      s3.setAttribute('data-cfasync', 'false');
      s3.async = true;
      
      const target = [document.documentElement, document.body].filter(Boolean).pop();
      if (target) {
        target.appendChild(s1);
        target.appendChild(s2);
        target.appendChild(s3);
      }
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
          <Route path="/watch/:id" element={<ChannelDetail />} />
          <Route path="/ykn-c0ntr0l-hq" element={<AdminDashboard />} />
          <Route path="/ykn-c0ntr0l-hq/dashboard" element={<AdminDashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
