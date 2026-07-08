import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import ChannelDetail from './pages/ChannelDetail';
import StatusPage from './pages/StatusPage';

const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

const isPrivilegedAdminSession = () => {
  const role = localStorage.getItem('ykn_admin_role') || sessionStorage.getItem('ykn_admin_role');
  const loggedIn =
    localStorage.getItem('ykn_admin_logged_in') === 'true' ||
    sessionStorage.getItem('ykn_admin_logged_in') === 'true';

  return role === 'developer' || role === 'admin' || loggedIn;
};

const pausePageMedia = () => {
  document.querySelectorAll<HTMLMediaElement>('video, audio').forEach((media) => {
    media.pause();
  });
};

// Komponen pengontrol pemuatan dan pembersihan iklan secara dinamis
function AdsController() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    const isWatchPage = path.startsWith('/watch/');
    const isAdminPage = path.startsWith('/ykn-c0ntr0l-hq');

    // Deteksi sesi developer atau admin
    const isAdmin = isPrivilegedAdminSession();

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

function DevToolsGuard() {
  useEffect(() => {
    const forceDebuggerPause = () => {
      try {
        Function('debugger')();
      } catch {
        // Ignore strict CSP/eval blocks.
      }
    };

    const lockPublicView = () => {
      if (isPrivilegedAdminSession()) return;
      pausePageMedia();
      forceDebuggerPause();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const blockedShortcut =
        key === 'f12' ||
        (event.ctrlKey && event.shiftKey && ['i', 'j', 'c'].includes(key)) ||
        (event.ctrlKey && key === 'u');

      if (!blockedShortcut || isPrivilegedAdminSession()) return;

      event.preventDefault();
      event.stopPropagation();
      lockPublicView();
    };

    const handleContextMenu = (event: MouseEvent) => {
      if (isPrivilegedAdminSession()) return;

      event.preventDefault();
      lockPublicView();
    };

    const interval = window.setInterval(() => {
      if (isPrivilegedAdminSession()) return;

      const sizeGapOpen =
        window.outerWidth - window.innerWidth > 160 ||
        window.outerHeight - window.innerHeight > 160;

      const start = performance.now();
      forceDebuggerPause();
      const debuggerPaused = performance.now() - start > 120;

      if (sizeGapOpen || debuggerPaused) {
        pausePageMedia();
      }
    }, 700);

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('contextmenu', handleContextMenu, true);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('contextmenu', handleContextMenu, true);
    };
  }, []);

  return null;
}

function App() {
  const adminDashboard = (
    <Suspense fallback={null}>
      <AdminDashboard />
    </Suspense>
  );

  return (
    <Router>
      <AdsController />
      <DevToolsGuard />
      <div className="min-h-screen">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/status" element={<StatusPage />} />
          <Route path="/watch/:id" element={<ChannelDetail />} />
          <Route path="/ykn-c0ntr0l-hq" element={adminDashboard} />
          <Route path="/ykn-c0ntr0l-hq/dashboard" element={adminDashboard} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
