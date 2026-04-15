import React, { useEffect, useRef, useState } from 'react';
import shaka from 'shaka-player';
import { Server, Shield, Play, Info, AlertTriangle, Monitor, Globe, RefreshCcw } from 'lucide-react';
import { getProxiedUrl } from '../services/streamService';

interface ServerOption {
  name: string;
  url: string;
  type: 'direct' | 'drm' | 'referer';
  header?: {
    'user-agent'?: string;
    referer?: string;
  };
}

interface VideoPlayerProps {
  servers: ServerOption[];
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ servers }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<shaka.Player | null>(null);
  const [currentServer, setCurrentServer] = useState(servers[0] || null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper to parse Clearkey DRM from the pipe symbol
  const parseDrmInfo = (url: string) => {
    const [cleanUrl, drmString] = url.split('|');
    if (!drmString) return { cleanUrl, keys: null };

    const keys: Record<string, string> = {};
    const pairs = drmString.split('&');
    pairs.forEach(pair => {
      const [id, key] = pair.split('=');
      if (id && key) {
        const cleanId = id.replace(/.*=/, '').trim();
        const cleanKey = key.trim();
        keys[cleanId] = cleanKey;
      }
    });

    return { cleanUrl, keys: Object.keys(keys).length > 0 ? keys : null };
  };

  useEffect(() => {
    if (!videoRef.current) return;

    shaka.polyfill.installAll();
    if (!shaka.Player.isBrowserSupported()) {
      setError('Browser not supported for professional streaming.');
      return;
    }

    const player = new shaka.Player();
    playerRef.current = player;

    player.addEventListener('error', (event: any) => {
      console.error('Shaka Player Error:', event.detail);
      setError(`Stream Error: ${event.detail.code}`);
    });

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy().catch(e => console.error("Player destroy error:", e));
      }
    };
  }, []);

  useEffect(() => {
    const loadStream = async () => {
      if (!playerRef.current || !currentServer || !videoRef.current) return;

      const player = playerRef.current;
      const { cleanUrl, keys } = parseDrmInfo(currentServer.url);
      
      setError(null);
      
      try {
        // Fix Error 7002: Ensure element is attached before loading
        await player.attach(videoRef.current);
        
        // Configure Headers
        player.getNetworkingEngine()?.clearAllRequestFilters();
        player.getNetworkingEngine()?.registerRequestFilter((_type, request) => {
          if (currentServer.header?.['user-agent']) {
            request.headers['User-Agent'] = currentServer.header['user-agent'];
          }
          if (currentServer.header?.referer) {
            request.headers['Referer'] = currentServer.header.referer;
          }
        });

        // Configure DRM if applicable
        if (currentServer.type === 'drm' && keys) {
          player.configure({
            drm: { clearKeys: keys }
          });
        } else {
          player.configure({ drm: { clearKeys: {} } });
        }

        await player.load(cleanUrl);
        console.log('Stream loaded successfully:', currentServer.name);
      } catch (e: any) {
        console.error('Shaka Load/Attach Error:', e);
        
        // Handle CORS Error 1002 with Auto Proxy Fallback
        if (e.code === 1002 || e.code === 1001) {
          const proxiedUrl = getProxiedUrl(cleanUrl);
          if (proxiedUrl !== cleanUrl) {
            console.log('Attempting CORS Proxy Fallback...');
            try {
              await player.load(proxiedUrl);
              return;
            } catch (proxyError) {
              console.error('Proxy Fallback Failed:', proxyError);
            }
          }
        }

        // Ignore "Load interrupted" errors which happen during rapid switching
        if (e.code !== 7000) {
          setError(`Failed to load stream. (Internal Code: ${e.code})`);
        }
      }
    };

    loadStream();
  }, [currentServer]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(e => {
          console.error("Playback failed:", e);
          setError("Playback failed. Please try another server.");
        });
      }
      setIsPlaying(!isPlaying);
    }
  };

  if (!currentServer) return null;

  return (
    <div className="space-y-6">
      <div className="relative aspect-video rounded-[2rem] overflow-hidden bg-black ring-1 ring-white/10 group shadow-2xl">
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          poster="https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&q=80&w=2000"
          playsInline
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
        
        {error && (
          <div className="absolute inset-0 bg-dark/80 backdrop-blur-md z-30 flex flex-col items-center justify-center p-8 text-center">
            <AlertTriangle className="text-red-500 mb-4" size={48} />
            <h4 className="text-xl font-bold mb-2">Streaming Error</h4>
            <p className="text-white/60 mb-6 max-w-sm">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-primary text-dark font-bold rounded-xl flex items-center gap-2 hover:scale-105 transition-transform"
            >
              <RefreshCcw size={18} />
              Retry Connection
            </button>
          </div>
        )}

        {showInfo && (
          <div className="absolute inset-0 bg-dark/90 backdrop-blur-md p-8 z-20 flex flex-col animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-6 text-white">
              <h4 className="text-xl font-bold flex items-center gap-2">
                <Info size={20} className="text-primary" />
                Stream Compliance Info
              </h4>
              <button onClick={() => setShowInfo(false)} className="text-white/40 hover:text-white transition-colors">Close</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-white">
              <div className="space-y-4">
                <InfoItem icon={<Monitor size={16} />} label="Stream Engine" value="Shaka Player (DRM Compliant)" />
                <InfoItem icon={<Shield size={16} />} label="Type" value={currentServer.type.toUpperCase()} />
                <InfoItem icon={<Globe size={16} />} label="Source URL" value={currentServer.url.split('|')[0]} />
              </div>
              <div className="space-y-4">
                <InfoItem icon={<Globe size={16} />} label="User Agent" value={currentServer.header?.['user-agent'] || 'Browser Default'} />
                <InfoItem icon={<Globe size={16} />} label="Referer" value={currentServer.header?.referer || 'None'} />
              </div>
            </div>

            <div className="mt-auto p-4 bg-primary/10 border border-primary/20 rounded-2xl flex items-start gap-3">
              <Shield className="text-primary shrink-0" size={18} />
              <p className="text-[10px] text-white/60 leading-relaxed font-medium">
                This player is configured to handle DRM-protected content and custom headers as defined in the Football Live Streaming API documentation.
              </p>
            </div>
          </div>
        )}

        {!isPlaying && !showInfo && !error && (
          <div className="absolute inset-0 bg-dark/60 backdrop-blur-sm flex flex-col items-center justify-center gap-6">
            <div 
              className="w-20 h-20 bg-primary rounded-full flex items-center justify-center text-dark hover:scale-110 transition-transform cursor-pointer shadow-[0_0_30px_rgba(0,255,136,0.4)]" 
              onClick={togglePlay}
            >
              <Play fill="currentColor" size={32} className="ml-1" />
            </div>
            <div className="text-center">
              <h4 className="text-xl font-bold mb-1">Click to Start Stream</h4>
              <div className="flex items-center gap-2 justify-center text-white/40 text-sm">
                <span className="px-2 py-0.5 bg-white/5 rounded-md border border-white/5">{currentServer.type.toUpperCase()}</span>
                <span>•</span>
                <span>{currentServer.name}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-4 p-4 glass rounded-2xl">
        <div className="flex items-center gap-2 pr-4 lg:border-r border-white/10">
          <Server size={18} className="text-primary" />
          <span className="text-sm font-bold whitespace-nowrap">Servers</span>
        </div>
        
        <div className="flex flex-wrap gap-2 flex-1">
          {servers.map((server, idx) => (
            <button
              key={idx}
              onClick={() => {
                setCurrentServer(server);
                setIsPlaying(false);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all relative overflow-hidden group ${
                currentServer.url === server.url 
                  ? 'bg-primary text-dark' 
                  : 'bg-white/5 hover:bg-white/10 text-white/60'
              }`}
            >
              <span className="relative z-10">{server.name}</span>
              {server.type === 'drm' && <Shield size={10} className="absolute top-1 right-1 opacity-50" />}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-3 ml-auto text-white">
          <button 
            onClick={() => setShowInfo(!showInfo)}
            className="p-2.5 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-xl transition-all flex items-center gap-2 text-xs font-bold border border-white/5"
          >
            <Info size={16} />
            <span className="hidden sm:inline">Technical Details</span>
          </button>
          <div className="flex items-center gap-2 py-2 px-3 bg-primary/10 border border-primary/20 rounded-xl">
            <Shield size={16} className="text-primary animate-pulse" />
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider">DRM Active</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const InfoItem = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="space-y-1">
    <div className="flex items-center gap-2 text-white/30 text-[10px] font-bold uppercase tracking-wider">
      {icon}
      {label}
    </div>
    <div className="bg-white/5 p-3 rounded-xl border border-white/5 font-mono text-[11px] break-all leading-relaxed text-white/80 shrink-0">
      {value}
    </div>
  </div>
);

export default VideoPlayer;
