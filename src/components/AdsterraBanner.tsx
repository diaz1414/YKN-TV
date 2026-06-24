import React, { useEffect, useRef } from 'react';

interface AdsterraBannerProps {
  zoneId: string;
  format: '728x90' | '320x50' | '468x60' | '300x250';
}

const AdsterraBanner: React.FC<AdsterraBannerProps> = ({ zoneId, format }) => {
  const adContainerRef = useRef<HTMLDivElement>(null);
  const isPlaceholder = zoneId === 'GANTI_ZONE_ID_ADSTERRA_DISINI' || !zoneId;
  const isLocal = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.startsWith('192.168.'));

  useEffect(() => {
    if (!adContainerRef.current) return;

    adContainerRef.current.innerHTML = '';

    // Tampilkan placeholder di localhost atau jika ID belum diisi
    if (isPlaceholder || isLocal) {
      const mockupText = document.createElement('div');
      mockupText.className =
        'text-zinc-500/80 font-bold text-[10px] sm:text-xs font-mono select-none pointer-events-none uppercase tracking-widest text-center px-4';
      mockupText.innerText = `Banner Ad Placeholder (${format})`;
      adContainerRef.current.appendChild(mockupText);
      return;
    }

    // ═══════════════════════════════════════════════════════════════
    //  ANTI-REDIRECT SHIELD — mencegah iklan redirect halaman tanpa
    //  klik dari pengguna. Iklan masih tampil normal, tapi tidak bisa
    //  membajak halaman secara paksa.
    // ═══════════════════════════════════════════════════════════════

    // 1. Lacak apakah pengguna sedang aktif menekan/klik
    let userIsActive = false;
    let activeTimer: ReturnType<typeof setTimeout>;

    const onInteractionStart = () => {
      userIsActive = true;
      clearTimeout(activeTimer);
    };
    const onInteractionEnd = () => {
      // Beri waktu 800ms setelah klik — cukup untuk iklan membuka tab baru
      activeTimer = setTimeout(() => { userIsActive = false; }, 800);
    };

    document.addEventListener('mousedown', onInteractionStart, { passive: true });
    document.addEventListener('touchstart', onInteractionStart, { passive: true });
    document.addEventListener('mouseup',   onInteractionEnd,   { passive: true });
    document.addEventListener('touchend',  onInteractionEnd,   { passive: true });

    // 2. Intersep window.location.href setter — blokir jika bukan dari klik user
    const locationDesc = Object.getOwnPropertyDescriptor(window.location, 'href');
    let _origHrefSetter: ((v: string) => void) | undefined;
    if (locationDesc && locationDesc.set) {
      _origHrefSetter = locationDesc.set.bind(window.location);
      try {
        Object.defineProperty(window.location, 'href', {
          get: locationDesc.get?.bind(window.location),
          set(url: string) {
            if (userIsActive) {
              _origHrefSetter!(url);
            }
            // Jika bukan klik aktif → silent block (tidak redirect)
          },
          configurable: true,
        });
      } catch (_) { /* Browser tertentu tidak mengizinkan — skip */ }
    }

    // 3. Intersep window.location.assign & replace
    const _origAssign  = window.location.assign.bind(window.location);
    const _origReplace = window.location.replace.bind(window.location);
    try {
      // @ts-ignore — intentional override
      window.location.assign  = (url: string) => { if (userIsActive) _origAssign(url); };
      // @ts-ignore
      window.location.replace = (url: string) => { if (userIsActive) _origReplace(url); };
    } catch (_) { /* Safari terkadang tidak mengizinkan */ }

    // 4. Intersep window.top agar script dalam iframe tidak bisa mengakses
    //    window.top.location dan redirect halaman utama
    const _origTopDesc = Object.getOwnPropertyDescriptor(window, 'top');
    try {
      Object.defineProperty(window, 'top', {
        get() { return window; },
        configurable: true,
      });
    } catch (_) { /* Sudah dibekukan — skip */ }

    // 5. Blokir window.open tanpa klik aktif (mencegah popup paksa)
    const _origOpen = window.open.bind(window);
    window.open = (...args) => {
      if (userIsActive) return _origOpen(...args);
      return null;
    };

    // ─── Inject script iklan Adsterra ───────────────────────────────
    const adWrapper = document.createElement('div');
    adWrapper.id = `container-${zoneId}`;
    adContainerRef.current.appendChild(adWrapper);

    const atOptionsScript = document.createElement('script');
    atOptionsScript.type = 'text/javascript';
    atOptionsScript.innerHTML = `
      atOptions = {
        'key' : '${zoneId}',
        'format' : 'iframe',
        'height' : ${format.split('x')[1]},
        'width' : ${format.split('x')[0]},
        'params' : {}
      };
    `;

    const adScript = document.createElement('script');
    adScript.type = 'text/javascript';
    adScript.src = `//www.highperformanceformat.com/${zoneId}/invoke.js`;

    adContainerRef.current.appendChild(atOptionsScript);
    adContainerRef.current.appendChild(adScript);

    // ─── Cleanup saat komponen di-unmount ────────────────────────────
    return () => {
      clearTimeout(activeTimer);
      document.removeEventListener('mousedown', onInteractionStart);
      document.removeEventListener('touchstart', onInteractionStart);
      document.removeEventListener('mouseup',   onInteractionEnd);
      document.removeEventListener('touchend',  onInteractionEnd);

      // Pulihkan window.location.href descriptor
      if (locationDesc) {
        try { Object.defineProperty(window.location, 'href', locationDesc); } catch (_) { /* skip */ }
      }

      // Pulihkan assign & replace
      try {
        // @ts-ignore
        window.location.assign  = _origAssign;
        // @ts-ignore
        window.location.replace = _origReplace;
      } catch (_) { /* skip */ }

      // Pulihkan window.top
      if (_origTopDesc) {
        try { Object.defineProperty(window, 'top', _origTopDesc); } catch (_) { /* skip */ }
      }

      // Pulihkan window.open
      window.open = _origOpen;
    };
  }, [zoneId, format, isPlaceholder, isLocal]);

  const getDimensions = () => {
    switch (format) {
      case '728x90':  return 'w-[728px] h-[90px]';
      case '468x60':  return 'w-[468px] h-[60px]';
      case '300x250': return 'w-[300px] h-[250px]';
      default:        return 'w-[320px] h-[50px]'; // 320x50 mobile
    }
  };

  return (
    <div className="flex flex-col items-center justify-center my-6 select-none max-w-full overflow-hidden">
      <span className="text-[9px] font-black text-zinc-500 tracking-widest uppercase mb-1.5 opacity-60">
        Sponsored Advertisement
      </span>
      <div
        className={`bg-zinc-950/40 border border-white/5 rounded-2xl flex items-center justify-center overflow-hidden shadow-inner max-w-full ${getDimensions()}`}
        ref={adContainerRef}
      />
    </div>
  );
};

export default AdsterraBanner;
