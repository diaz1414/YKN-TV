import React, { useEffect, useRef } from 'react';

interface AdsterraBannerProps {
  zoneId: string;
  format: '728x90' | '320x50' | '468x60' | '300x250';
}

const AdsterraBanner: React.FC<AdsterraBannerProps> = ({ zoneId, format }) => {
  const adContainerRef = useRef<HTMLDivElement>(null);
  const isPlaceholder = zoneId === 'GANTI_ZONE_ID_ADSTERRA_DISINI' || !zoneId;
  const isLocal = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.startsWith('192.168.'));

  useEffect(() => {
    if (!adContainerRef.current) return;

    // Bersihkan container dari iklan lama jika ada re-render
    adContainerRef.current.innerHTML = '';

    if (isPlaceholder || isLocal) {
      // Tampilkan mockup banner di localhost / jika ID belum diisi
      const mockupText = document.createElement('div');
      mockupText.className = 'text-zinc-500/80 font-bold text-[10px] sm:text-xs font-mono select-none pointer-events-none uppercase tracking-widest text-center px-4';
      mockupText.innerText = `Banner Ad Placeholder (${format})`;
      adContainerRef.current.appendChild(mockupText);
      return;
    }

    // Buat container element untuk Adsterra
    const adWrapper = document.createElement('div');
    adWrapper.id = `container-${zoneId}`;
    adContainerRef.current.appendChild(adWrapper);

    // Buat konfigurasi script Adsterra
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
  }, [zoneId, format, isPlaceholder, isLocal]);

  // Tentukan dimensi container berdasarkan format
  const getDimensions = () => {
    switch (format) {
      case '728x90': return 'w-[728px] h-[90px]';
      case '468x60': return 'w-[468px] h-[60px]';
      case '300x250': return 'w-[300px] h-[250px]';
      default: return 'w-[320px] h-[50px]'; // 320x50 mobile
    }
  };

  return (
    <div className="flex flex-col items-center justify-center my-6 select-none max-w-full overflow-hidden">
      <span className="text-[9px] font-black text-zinc-500 tracking-widest uppercase mb-1.5 opacity-60">Sponsored Advertisement</span>
      <div 
        className={`bg-zinc-950/40 border border-white/5 rounded-2xl flex items-center justify-center overflow-hidden shadow-inner max-w-full ${getDimensions()}`}
        ref={adContainerRef}
      />
    </div>
  );
};

export default AdsterraBanner;
