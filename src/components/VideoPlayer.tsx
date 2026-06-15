import React, { useEffect, useRef, useState } from 'react';
import shaka from 'shaka-player';
import Hls from 'hls.js';
import { 
  Server, Shield, Play, Pause, Info, AlertTriangle, Monitor, Globe, 
  RefreshCcw, Volume2, VolumeX, Maximize2, Minimize2, Settings 
} from 'lucide-react';
import { getProxiedUrl, type StreamServer } from '../services/streamService';

interface VideoPlayerProps {
  servers: StreamServer[];
}

interface QualityOption {
  index: number | 'auto';
  label: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ servers }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<shaka.Player | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  
  const [currentServer, setCurrentServer] = useState(servers[0] || null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Custom Controls State
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLive, setIsLive] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [levels, setLevels] = useState<QualityOption[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number | 'auto'>('auto');
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  // Sync current server if servers list changes
  useEffect(() => {
    if (servers.length > 0) {
      setCurrentServer(servers[0]);
      setIsPlaying(false);
    }
  }, [servers]);

  // Extract clearKeys DRM keys from server info or fallback to URL pipe strings
  const getDrmKeys = (server: StreamServer) => {
    if (server.keyId && server.key) {
      return { [server.keyId.trim()]: server.key.trim() };
    }
    
    // Fallback: Check for key parameters appended with '|' inside the URL
    const [, drmString] = server.url.split('|');
    if (!drmString) return null;

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

    return Object.keys(keys).length > 0 ? keys : null;
  };

  const cleanStreamUrl = (url: string): string => {
    return url.split('|')[0].trim();
  };

  const destroyPlayers = async () => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (playerRef.current) {
      try {
        await playerRef.current.detach();
      } catch (e) {
        console.warn('Shaka Player detach error:', e);
      }
    }
  };

  useEffect(() => {
    if (!videoRef.current) return;

    shaka.polyfill.installAll();
    const player = new shaka.Player();
    playerRef.current = player;

    player.addEventListener('error', (event: any) => {
      console.error('Shaka Player Error:', event.detail);
      if (!hlsRef.current) {
        setError(`Stream Error: ${event.detail.code}`);
      }
    });

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      destroyPlayers();
      if (playerRef.current) {
        playerRef.current.destroy().catch(e => console.error("Player destroy error:", e));
      }
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const loadStream = async () => {
      if (!currentServer || !videoRef.current) return;

      const rawUrl = cleanStreamUrl(currentServer.url);
      const keys = getDrmKeys(currentServer);
      
      const autoProxiedUrl = getProxiedUrl(rawUrl);
      const streamUrl = autoProxiedUrl;
      
      const isHls = streamUrl.includes('.m3u8') || streamUrl.includes('m3u8');
      
      setError(null);
      setLevels([]);
      setCurrentLevel('auto');
      await destroyPlayers();

      try {
        if (isHls && Hls.isSupported() && !keys) {
          console.log('Using Hls.js to play HLS stream:', streamUrl);
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true
          });
          hlsRef.current = hls;

          hls.loadSource(streamUrl);
          hls.attachMedia(videoRef.current);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            const qualityLevels: QualityOption[] = hls.levels.map((level, idx) => ({
              index: idx,
              label: level.height ? `${level.height}p` : `${Math.round(level.bitrate / 1000)}k`
            }));
            setLevels([{ index: 'auto', label: 'Auto' }, ...qualityLevels]);

            videoRef.current?.play().then(() => {
              setIsPlaying(true);
            }).catch(err => {
              console.warn('Autoplay prevented:', err);
            });
          });

          let triedProxy = false;
          hls.on(Hls.Events.ERROR, async (_event, data) => {
            if (data.fatal) {
              console.error('Fatal Hls.js Error:', data);
              if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                if (!triedProxy) {
                  triedProxy = true;
                  const proxied = getProxiedUrl(rawUrl, true);
                  console.log('Attempting CORS Proxy Fallback for Hls.js:', proxied);
                  hls.loadSource(proxied);
                  hls.startLoad();
                } else {
                  setError('Gagal memuat siaran video (Error Jaringan).');
                }
              } else {
                setError(`Playback Error: ${data.details}`);
              }
            }
          });

        } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl') && !keys) {
          console.log('Using native Safari HLS playback:', streamUrl);
          videoRef.current.src = streamUrl;
          videoRef.current.play().then(() => {
            setIsPlaying(true);
          }).catch(e => console.warn(e));
        } else if (playerRef.current) {
          console.log('Using Shaka Player:', streamUrl);
          const player = playerRef.current;
          await player.attach(videoRef.current);
          
          player.getNetworkingEngine()?.clearAllRequestFilters();

          if (keys) {
            player.configure({
              drm: { clearKeys: keys }
            });
          } else {
            player.configure({ drm: { clearKeys: {} } });
          }

          // Buffer targets to optimize live startup
          player.configure({
            streaming: {
              rebufferingGoal: 1.5,
              bufferingGoal: 10
            }
          });

          await player.load(streamUrl);
          console.log('Stream loaded successfully with Shaka Player:', currentServer.name);

          videoRef.current?.play().then(() => {
            setIsPlaying(true);
          }).catch(err => console.warn(err));

          const tracks = player.getVariantTracks();
          const uniqueHeights = Array.from(new Set(tracks.map(t => t.height).filter(Boolean)));
          uniqueHeights.sort((a, b) => (b ?? 0) - (a ?? 0));
          const qualityLevels: QualityOption[] = uniqueHeights.map(height => ({
            index: height as number,
            label: `${height}p`
          }));
          setLevels([{ index: 'auto', label: 'Auto' }, ...qualityLevels]);
        } else {
          setError('Format siaran tidak didukung di peramban ini.');
        }
      } catch (e: any) {
        console.error('Player Load/Attach Error:', e);
        
        if (e.code === 1002 || e.code === 1001) {
          const proxiedUrl = getProxiedUrl(rawUrl, true);
          console.log('Attempting CORS Proxy Fallback for Shaka Player:', proxiedUrl);
          try {
            if (playerRef.current) {
              await playerRef.current.load(proxiedUrl);
            }
            return;
          } catch (proxyError) {
            console.error('Proxy Fallback Failed:', proxyError);
          }
        }

        if (e.code !== 7000) {
          setError(`Gagal memuat siaran. (Kode Internal: ${e.code || 'UNKNOWN'})`);
        }
      }
    };

    loadStream();
  }, [currentServer]);

  // Autohide Controls
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(timeoutId);
      if (isPlaying) {
        timeoutId = setTimeout(() => {
          setShowControls(false);
          setShowQualityMenu(false);
        }, 3000);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
    }
    return () => {
      if (container) {
        container.removeEventListener('mousemove', handleMouseMove);
      }
      clearTimeout(timeoutId);
    };
  }, [isPlaying]);

  const togglePlay = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(err => {
          console.error("Playback failed:", err);
          setError("Gagal memutar siaran. Silakan coba server alternatif.");
        });
      }
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      const muteState = val === 0;
      videoRef.current.muted = muteState;
      setIsMuted(muteState);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      const nextMute = !isMuted;
      setIsMuted(nextMute);
      videoRef.current.muted = nextMute;
      if (!nextMute && volume === 0) {
        setVolume(0.5);
        videoRef.current.volume = 0.5;
      }
    }
  };

  const toggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error('Fullscreen failed:', err);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || !isFinite(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      const dur = videoRef.current.duration;
      if (dur === Infinity || isNaN(dur) || dur <= 0) {
        setIsLive(true);
      } else {
        setIsLive(false);
        setDuration(dur);
      }
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!videoRef.current || isLive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = pos * duration;
  };

  const handleLevelChange = (levelIdx: number | 'auto') => {
    setCurrentLevel(levelIdx);
    setShowQualityMenu(false);
    
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIdx === 'auto' ? -1 : (levelIdx as number);
    } else if (playerRef.current) {
      if (levelIdx === 'auto') {
        playerRef.current.configure({ abr: { enabled: true } });
      } else {
        playerRef.current.configure({ abr: { enabled: false } });
        const tracks = playerRef.current.getVariantTracks();
        const selectedHeight = levelIdx as number;
        const matchTrack = tracks.find(t => t.height === selectedHeight);
        if (matchTrack) {
          playerRef.current.selectVariantTrack(matchTrack, true);
        }
      }
    }
  };

  if (!currentServer) return null;

  return (
    <div className="space-y-6">
      <div 
        ref={containerRef}
        className={`relative bg-black group shadow-2xl flex items-center justify-center overflow-hidden transition-all duration-300 ${
          isFullscreen 
            ? 'w-screen h-screen rounded-none ring-0 border-none z-[9999]' 
            : 'aspect-video rounded-[2rem] ring-1 ring-white/5 border border-white/5'
        } ${showControls ? '' : 'cursor-none'}`}
      >
        <video
          ref={videoRef}
          className="w-full h-full object-contain cursor-pointer"
          playsInline
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
          onClick={() => togglePlay()}
        />

        {/* Custom Controls Panel */}
        <div 
          className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent flex flex-col justify-end p-4 md:p-6 transition-all duration-500 z-30 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Timeline Seek bar for VOD */}
          {!isLive && (
            <div 
              onClick={handleSeek}
              className="w-full h-1.5 bg-white/10 rounded-full mb-4 cursor-pointer relative group/progress transition-all hover:h-2"
            >
              <div 
                className="h-full bg-primary rounded-full relative shadow-[0_0_10px_rgba(212,175,55,0.6)]"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              >
                <div className="w-3 h-3 bg-white border-2 border-primary rounded-full absolute right-0 top-1/2 -translate-y-1/2 scale-0 group-hover/progress:scale-100 transition-transform shadow-[0_0_8px_rgba(212,175,55,0.8)]" />
              </div>
            </div>
          )}

          {/* Control Actions row */}
          <div className="flex items-center justify-between gap-4 select-none">
            <div className="flex items-center gap-3 md:gap-4">
              {/* Play / Pause */}
              <button 
                onClick={() => togglePlay()}
                className="w-9 h-9 md:w-10 md:h-10 bg-primary hover:bg-primary/90 text-dark rounded-full flex items-center justify-center transition-all hover:scale-105 shadow-md cursor-pointer"
              >
                {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
              </button>

              {/* Volume Controller */}
              <div className="flex items-center gap-1 group/volume relative">
                <button 
                  onClick={toggleMute}
                  className="p-2 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <input 
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-0 group-hover/volume:w-16 md:group-hover/volume:w-20 transition-all duration-300 origin-left accent-primary h-1 bg-white/20 rounded-lg cursor-pointer"
                />
              </div>

              {/* Live Status indicator */}
              {isLive ? (
                <div className="flex items-center gap-1.5 py-1 px-3 bg-netflix-red/10 border border-netflix-red/20 text-netflix-red rounded-full text-[9px] font-black uppercase tracking-wider select-none">
                  <span className="w-1.5 h-1.5 bg-netflix-red rounded-full animate-pulse-live" />
                  LIVE
                </div>
              ) : (
                <div className="text-xs font-mono font-bold text-zinc-400 select-none">
                  {formatTime(currentTime)} <span className="text-white/25">/</span> {formatTime(duration)}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              {/* Compliance / Spec details popup */}
              <button 
                onClick={(e) => { e.stopPropagation(); setShowInfo(!showInfo); }}
                className="p-2 text-zinc-400 hover:text-white transition-all hover:bg-white/5 rounded-xl border border-white/5 cursor-pointer"
                title="Spesifikasi Siaran"
              >
                <Info size={16} />
              </button>

              {/* Video Resolution list */}
              {levels.length > 1 && (
                <div className="relative">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowQualityMenu(!showQualityMenu); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/10 rounded-xl text-xs font-black text-zinc-300 hover:text-white transition-all cursor-pointer"
                  >
                    <Settings size={12} className={showQualityMenu ? 'rotate-45' : ''} />
                    {currentLevel === 'auto' ? 'Auto' : levels.find(l => l.index === currentLevel)?.label || 'Auto'}
                  </button>
                  {showQualityMenu && (
                    <div className="absolute bottom-12 right-0 bg-[#080808]/95 backdrop-blur-md border border-white/10 rounded-2xl p-1.5 w-28 shadow-2xl flex flex-col gap-1 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                      {levels.map((level) => (
                        <button
                          key={level.index}
                          onClick={() => handleLevelChange(level.index)}
                          className={`w-full py-1.5 px-2.5 text-left rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                            currentLevel === level.index 
                              ? 'bg-primary text-dark font-black shadow-md' 
                              : 'text-zinc-400 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          {level.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Fullscreen view toggle */}
              <button 
                onClick={toggleFullscreen}
                className="p-2 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            </div>
          </div>
        </div>
        
        {/* Error State display screen */}
        {error && (
          <div className="absolute inset-0 bg-[#020202]/95 backdrop-blur-md z-30 flex flex-col items-center justify-center p-8 text-center select-none animate-in fade-in duration-300">
            <AlertTriangle className="text-netflix-red mb-4 shadow-lg" size={44} />
            <h4 className="text-lg font-black uppercase font-display mb-1.5">Gangguan Koneksi Siaran</h4>
            <p className="text-zinc-500 text-xs font-bold mb-6 max-w-xs leading-relaxed">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-primary text-dark font-black rounded-xl flex items-center gap-2 hover:scale-102 transition-transform cursor-pointer text-xs uppercase tracking-wider shadow"
            >
              <RefreshCcw size={14} />
              Segarkan Koneksi
            </button>
          </div>
        )}

        {/* Technical compliance info view overlay */}
        {showInfo && (
          <div className="absolute inset-0 bg-[#020202]/95 backdrop-blur-md p-6 md:p-8 z-40 flex flex-col animate-in fade-in duration-200 select-none">
            <div className="flex justify-between items-center mb-6 text-white">
              <h4 className="text-lg font-black font-display uppercase tracking-wider flex items-center gap-2">
                <Info size={18} className="text-primary" />
                Spesifikasi Siaran Video
              </h4>
              <button onClick={() => setShowInfo(false)} className="text-zinc-500 hover:text-white text-xs font-black uppercase tracking-wider border border-white/5 px-2.5 py-1.5 bg-white/5 rounded-xl cursor-pointer">Tutup</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs overflow-y-auto custom-scrollbar flex-1 pb-4">
              <div className="space-y-4">
                <InfoItem icon={<Monitor size={14} />} label="Enjin Pemutar Video" value="Shaka Player & Hls.js (DRM Decrypted)" />
                <InfoItem icon={<Globe size={14} />} label="URL Sumber M3U8" value={cleanStreamUrl(currentServer.url)} />
              </div>
              <div className="space-y-4">
                <InfoItem icon={<Shield size={14} />} label="Lisensi Pengaman (DRM)" value={currentServer.keyId && currentServer.key ? `Clearkey Keypair (${currentServer.keyId.substring(0, 8)}...:${currentServer.key.substring(0, 8)}...)` : 'Tidak Aktif (Direct HLS Stream)'} />
                <InfoItem icon={<Server size={14} />} label="Server Aktif" value={currentServer.name} />
              </div>
            </div>

            <div className="mt-auto p-4 bg-primary/10 border border-primary/20 rounded-2xl flex items-start gap-3">
              <Shield className="text-primary shrink-0" size={16} />
              <p className="text-[10px] text-zinc-400 leading-relaxed font-bold">
                Pemutar video terintegrasi ini secara otomatis mendekripsi proteksi DRM Clearkey serta mengamankan parameter referer sesuai spesifikasi siaran langsung resmi.
              </p>
            </div>
          </div>
        )}

        {/* Static Play button display before start */}
        {!isPlaying && !showInfo && !error && (
          <div className="absolute inset-0 bg-[#020202]/70 backdrop-blur-sm flex flex-col items-center justify-center gap-6 z-20 select-none">
            <div 
              className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-dark hover:scale-105 transition-transform cursor-pointer shadow-[0_0_35px_rgba(212,175,55,0.4)]" 
              onClick={() => togglePlay()}
            >
              <Play fill="currentColor" size={24} className="ml-1" />
            </div>
            <div className="text-center">
              <h4 className="text-base font-black uppercase font-display tracking-wider mb-1 text-white">Mulai Siaran Langsung</h4>
              <div className="flex items-center gap-2 justify-center text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                <span className="px-2 py-0.5 bg-white/5 rounded border border-white/5">{currentServer.type.toUpperCase() || 'DIRECT'}</span>
                <span>•</span>
                <span>{currentServer.name}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Server options grid switcher bar */}
      <div className="flex flex-col md:flex-row md:items-center gap-4 p-4 bg-[#080808]/40 border border-white/5 rounded-2xl">
        <div className="flex items-center gap-2 pr-4 md:border-r border-white/5 select-none shrink-0">
          <Server size={16} className="text-primary" />
          <span className="text-xs font-black uppercase tracking-wider">Pilih Server</span>
        </div>
        
        <div className="flex flex-wrap gap-2 flex-1">
          {servers.map((server, idx) => (
            <button
              key={idx}
              onClick={() => {
                setCurrentServer(server);
                setIsPlaying(false);
              }}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all relative overflow-hidden group cursor-pointer ${
                currentServer.url === server.url 
                  ? 'bg-primary text-dark shadow-md' 
                  : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/5'
              }`}
            >
              <span className="relative z-10">{server.name}</span>
              {(server.keyId || server.url.includes('|')) && (
                <Shield size={9} className="absolute top-0.5 right-0.5 opacity-40 shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const InfoItem = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="space-y-1">
    <div className="flex items-center gap-2 text-zinc-500 text-[9px] font-black uppercase tracking-wider">
      {icon}
      {label}
    </div>
    <div className="bg-white/5 p-3 rounded-xl border border-white/5 font-mono text-[10px] break-all leading-relaxed text-zinc-300 font-bold shrink-0">
      {value}
    </div>
  </div>
);

export default VideoPlayer;
