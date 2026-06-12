import React, { useEffect, useRef, useState } from 'react';
import shaka from 'shaka-player';
import Hls from 'hls.js';
import { 
  Server, Shield, Play, Pause, Info, AlertTriangle, Monitor, Globe, 
  RefreshCcw, Volume2, VolumeX, Maximize2, Minimize2, Settings 
} from 'lucide-react';
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

    // Fullscreen Event sync
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

      const { cleanUrl, keys } = parseDrmInfo(currentServer.url);
      const isHls = cleanUrl.includes('.m3u8') || cleanUrl.includes('m3u8');
      
      setError(null);
      setLevels([]);
      setCurrentLevel('auto');
      await destroyPlayers();

      try {
        if (isHls && Hls.isSupported()) {
          console.log('Using Hls.js to play HLS stream:', cleanUrl);
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            xhrSetup: (xhr, _url) => {
              if (currentServer.header?.['user-agent']) {
                xhr.setRequestHeader('User-Agent', currentServer.header['user-agent']);
              }
              if (currentServer.header?.referer) {
                xhr.setRequestHeader('Referer', currentServer.header.referer);
              }
            }
          });
          hlsRef.current = hls;

          hls.loadSource(cleanUrl);
          hls.attachMedia(videoRef.current);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            const qualityLevels: QualityOption[] = hls.levels.map((level, idx) => ({
              index: idx,
              label: level.height ? `${level.height}p` : `${Math.round(level.bitrate / 1000)}k`
            }));
            setLevels([{ index: 'auto', label: 'Auto' }, ...qualityLevels]);

            if (isPlaying) {
              videoRef.current?.play().catch(err => {
                console.warn('Autoplay prevented:', err);
              });
            }
          });

          let triedProxy = false;
          hls.on(Hls.Events.ERROR, async (_event, data) => {
            if (data.fatal) {
              console.error('Fatal Hls.js Error:', data);
              if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                if (!triedProxy) {
                  triedProxy = true;
                  const proxied = getProxiedUrl(cleanUrl, true);
                  console.log('Attempting CORS Proxy Fallback for Hls.js:', proxied);
                  hls.loadSource(proxied);
                  hls.startLoad();
                } else {
                  setError('Failed to load stream. (Network Error via Proxy)');
                }
              } else {
                setError(`Playback Error: ${data.details}`);
              }
            }
          });

        } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
          console.log('Using native Safari HLS playback:', cleanUrl);
          videoRef.current.src = cleanUrl;
          if (isPlaying) {
            videoRef.current.play().catch(e => console.warn(e));
          }
        } else if (playerRef.current) {
          console.log('Using Shaka Player:', cleanUrl);
          const player = playerRef.current;
          await player.attach(videoRef.current);
          
          player.getNetworkingEngine()?.clearAllRequestFilters();
          player.getNetworkingEngine()?.registerRequestFilter((_type, request) => {
            if (currentServer.header?.['user-agent']) {
              request.headers['User-Agent'] = currentServer.header['user-agent'];
            }
            if (currentServer.header?.referer) {
              request.headers['Referer'] = currentServer.header.referer;
            }
          });

          if (currentServer.type === 'drm' && keys) {
            player.configure({
              drm: { clearKeys: keys }
            });
          } else {
            player.configure({ drm: { clearKeys: {} } });
          }

          await player.load(cleanUrl);
          console.log('Stream loaded successfully with Shaka Player:', currentServer.name);

          // Get variant tracks for quality settings
          const tracks = player.getVariantTracks();
          const uniqueHeights = Array.from(new Set(tracks.map(t => t.height).filter(Boolean)));
          uniqueHeights.sort((a, b) => (b ?? 0) - (a ?? 0));
          const qualityLevels: QualityOption[] = uniqueHeights.map(height => ({
            index: height as number,
            label: `${height}p`
          }));
          setLevels([{ index: 'auto', label: 'Auto' }, ...qualityLevels]);
        } else {
          setError('No compatible streaming engine found.');
        }
      } catch (e: any) {
        console.error('Player Load/Attach Error:', e);
        
        if (e.code === 1002 || e.code === 1001) {
          const proxiedUrl = getProxiedUrl(cleanUrl, true);
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
          setError(`Failed to load stream. (Internal Code: ${e.code || 'UNKNOWN'})`);
        }
      }
    };

    loadStream();
  }, [currentServer]);

  // Autohide Controls effect
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
          setError("Playback failed. Please try another server.");
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
        className="relative aspect-video rounded-[2rem] overflow-hidden bg-black ring-1 ring-white/10 group shadow-2xl flex items-center justify-center"
      >
        <video
          ref={videoRef}
          className="w-full h-full object-contain cursor-pointer"
          poster="https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&q=80&w=2000"
          playsInline
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
          onClick={() => togglePlay()}
        />

        {/* Custom Controls Overlay */}
        {isPlaying && (
          <div 
            className={`absolute inset-0 bg-gradient-to-t from-dark/95 via-transparent to-transparent flex flex-col justify-end p-6 transition-all duration-500 z-30 ${
              showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            {/* Progress Bar for VOD */}
            {!isLive && (
              <div 
                onClick={handleSeek}
                className="w-full h-1.5 bg-white/10 rounded-full mb-4 cursor-pointer relative group/progress transition-all hover:h-2"
              >
                <div 
                  className="h-full bg-primary rounded-full relative shadow-[0_0_10px_rgba(0,255,136,0.6)]"
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                >
                  <div className="w-3.5 h-3.5 bg-white border-2 border-primary rounded-full absolute right-0 top-1/2 -translate-y-1/2 scale-0 group-hover/progress:scale-100 transition-transform shadow-[0_0_8px_rgba(0,255,136,0.8)]" />
                </div>
              </div>
            )}

            {/* Bottom Row Control Panel */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {/* Play/Pause Button */}
                <button 
                  onClick={() => togglePlay()}
                  className="w-10 h-10 bg-primary hover:bg-primary/90 text-dark rounded-full flex items-center justify-center transition-all hover:scale-110 shadow-lg cursor-pointer"
                >
                  {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                </button>

                {/* Volume Section */}
                <div className="flex items-center gap-2 group/volume relative">
                  <button 
                    onClick={toggleMute}
                    className="p-2 text-white/80 hover:text-white transition-colors cursor-pointer"
                  >
                    {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  </button>
                  <input 
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-0 group-hover/volume:w-20 transition-all duration-300 origin-left accent-primary h-1 bg-white/20 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Time Display or Live Badge */}
                {isLive ? (
                  <div className="flex items-center gap-2 py-1 px-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse select-none">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                    LIVE
                  </div>
                ) : (
                  <div className="text-xs font-mono font-bold text-white/60 select-none">
                    {formatTime(currentTime)} <span className="text-white/25">/</span> {formatTime(duration)}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                {/* Technical Info Button */}
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowInfo(!showInfo); }}
                  className="p-2.5 text-white/60 hover:text-white transition-all hover:bg-white/5 rounded-xl border border-white/5 cursor-pointer"
                  title="Technical Details"
                >
                  <Info size={16} />
                </button>

                {/* Quality / Resolution Selector */}
                {levels.length > 1 && (
                  <div className="relative">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setShowQualityMenu(!showQualityMenu); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/10 rounded-xl text-xs font-bold text-white/80 hover:text-white transition-all cursor-pointer"
                    >
                      <Settings size={14} className={showQualityMenu ? 'rotate-45' : ''} />
                      {currentLevel === 'auto' ? 'Auto' : levels.find(l => l.index === currentLevel)?.label || 'Auto'}
                    </button>
                    {showQualityMenu && (
                      <div className="absolute bottom-12 right-0 bg-surface/95 backdrop-blur-md border border-white/10 rounded-2xl p-2 w-32 shadow-2xl flex flex-col gap-1 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                        {levels.map((level) => (
                          <button
                            key={level.index}
                            onClick={() => handleLevelChange(level.index)}
                            className={`w-full py-2 px-3 text-left rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              currentLevel === level.index 
                                ? 'bg-primary text-dark font-black' 
                                : 'text-white/60 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            {level.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Fullscreen Button */}
                <button 
                  onClick={toggleFullscreen}
                  className="p-2.5 text-white/80 hover:text-white transition-colors cursor-pointer"
                >
                  {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
              </div>
            </div>
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 bg-dark/80 backdrop-blur-md z-30 flex flex-col items-center justify-center p-8 text-center">
            <AlertTriangle className="text-red-500 mb-4" size={48} />
            <h4 className="text-xl font-bold mb-2">Streaming Error</h4>
            <p className="text-white/60 mb-6 max-w-sm">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-primary text-dark font-bold rounded-xl flex items-center gap-2 hover:scale-105 transition-transform cursor-pointer"
            >
              <RefreshCcw size={18} />
              Retry Connection
            </button>
          </div>
        )}

        {showInfo && (
          <div className="absolute inset-0 bg-dark/90 backdrop-blur-md p-8 z-40 flex flex-col animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-6 text-white">
              <h4 className="text-xl font-bold flex items-center gap-2">
                <Info size={20} className="text-primary" />
                Stream Compliance Info
              </h4>
              <button onClick={() => setShowInfo(false)} className="text-white/40 hover:text-white transition-colors cursor-pointer">Close</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-white overflow-y-auto">
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
          <div className="absolute inset-0 bg-dark/60 backdrop-blur-sm flex flex-col items-center justify-center gap-6 z-20">
            <div 
              className="w-20 h-20 bg-primary rounded-full flex items-center justify-center text-dark hover:scale-110 transition-transform cursor-pointer shadow-[0_0_30px_rgba(0,255,136,0.4)]" 
              onClick={() => togglePlay()}
            >
              <Play fill="currentColor" size={32} className="ml-1" />
            </div>
            <div className="text-center select-none">
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
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all relative overflow-hidden group cursor-pointer ${
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
            className="p-2.5 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-xl transition-all flex items-center gap-2 text-xs font-bold border border-white/5 cursor-pointer"
          >
            <Info size={16} />
            <span className="hidden sm:inline">Technical Details</span>
          </button>
          <div className="flex items-center gap-2 py-2 px-3 bg-primary/10 border border-primary/20 rounded-xl select-none">
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
