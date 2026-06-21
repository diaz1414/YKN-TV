import React, { useEffect, useRef, useState } from 'react';
import shaka from 'shaka-player';
import Hls from 'hls.js';
import {
  Server, Shield, Play, Pause, AlertTriangle,
  RefreshCcw, Volume2, VolumeX, Maximize2, Minimize2, Settings, PictureInPicture2
} from 'lucide-react';
import { getProxiedUrl, type StreamServer } from '../services/streamService';
import GlobalAnnouncement from './GlobalAnnouncement';

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
  const [hasStarted, setHasStarted] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isAtLiveEdge, setIsAtLiveEdge] = useState(true);
  const [activeHeight, setActiveHeight] = useState<number | null>(null);

  // Sync current server if servers list changes
  useEffect(() => {
    if (servers.length > 0) {
      setCurrentServer(servers[0]);
      setIsPlaying(false);
      setHasStarted(true);
      setIsBuffering(false);
      setIsAtLiveEdge(true);
    }
  }, [servers]);

  // Extract clearKeys DRM keys from server info or fallback to URL pipe strings
  const getDrmKeys = (server: StreamServer) => {
    if (server.keys && Object.keys(server.keys).length > 0) {
      return server.keys;
    }

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

    player.addEventListener('buffering', (event: any) => {
      setIsBuffering(event.buffering);
    });

    player.addEventListener('adaptation', () => {
      const activeTrack = player.getVariantTracks().find(t => t.active);
      if (activeTrack && activeTrack.height) {
        setActiveHeight(activeTrack.height);
      }
    });

    const handleFullscreenChange = () => {
      const isFs = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setIsFullscreen(isFs);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      destroyPlayers();
      if (playerRef.current) {
        playerRef.current.destroy().catch(e => console.error("Player destroy error:", e));
      }
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Manage body scroll and orientation lock dynamically when isFullscreen changes
  useEffect(() => {
    if (isFullscreen) {
      document.body.classList.add('ykn-fullscreen-active');
      document.body.style.overflow = 'hidden';

      // Auto-lock landscape orientation if supported
      const orientation = screen.orientation as any;
      if (orientation && typeof orientation.lock === 'function') {
        orientation.lock('landscape').catch((err: any) => {
          console.warn('Orientation lock failed:', err);
        });
      }
    } else {
      document.body.classList.remove('ykn-fullscreen-active');
      document.body.style.overflow = '';

      const orientation = screen.orientation as any;
      if (orientation && typeof orientation.unlock === 'function') {
        try {
          orientation.unlock();
        } catch (e) {
          console.warn('Orientation unlock failed:', e);
        }
      }
    }
  }, [isFullscreen]);

  useEffect(() => {
    const loadStream = async () => {
      if (!currentServer || !videoRef.current) return;

      const rawUrl = cleanStreamUrl(currentServer.url);
      const keys = getDrmKeys(currentServer);

      const autoProxiedUrl = getProxiedUrl(rawUrl);
      let streamUrl = autoProxiedUrl;
      let isHls = streamUrl.includes('.m3u8') || streamUrl.includes('m3u8');

      // Client-side parser for IPTV playlist containers (e.g. IPTVCat lists)
      if (isHls) {
        try {
          const checkRes = await fetch(streamUrl);
          if (checkRes.ok) {
            const bodyText = await checkRes.text();
            if (bodyText.includes('#EXTINF') && !bodyText.includes('#EXT-X-TARGETDURATION') && !bodyText.includes('#EXT-X-STREAM-INF')) {
              const lines = bodyText.split('\n');
              const targetLine = lines.find(line => {
                const trimmed = line.trim();
                return trimmed && !trimmed.startsWith('#') && (trimmed.startsWith('http') || trimmed.includes('.m3u8') || trimmed.includes('.ts'));
              });
              if (targetLine) {
                const resolvedUrl = new URL(targetLine.trim(), checkRes.url).toString();
                console.log('Frontend resolved IPTV container to:', resolvedUrl);
                streamUrl = getProxiedUrl(resolvedUrl, true);
                isHls = streamUrl.includes('.m3u8') || streamUrl.includes('m3u8');
              }
            }
          }
        } catch (e) {
          console.warn('IPTV container resolver failed or timed out:', e);
        }
      }

      const onShakaLoadSuccess = (playerInstance: shaka.Player) => {
        console.log('Stream loaded successfully with Shaka Player:', currentServer.name);
        setError(null);

        const activeTrack = playerInstance.getVariantTracks().find(t => t.active);
        if (activeTrack && activeTrack.height) {
          setActiveHeight(activeTrack.height);
        }

        videoRef.current?.play().then(() => {
          setIsPlaying(true);
        }).catch(err => console.warn(err));

        const tracks = playerInstance.getVariantTracks();
        const uniqueHeights = Array.from(new Set(tracks.map(t => t.height).filter(Boolean)));
        uniqueHeights.sort((a, b) => (b ?? 0) - (a ?? 0));
        const qualityLevels: QualityOption[] = uniqueHeights.map(height => ({
          index: height as number,
          label: `${height}p`
        }));
        setLevels([{ index: 'auto', label: 'Auto' }, ...qualityLevels]);
      };

      setError(null);
      setIsBuffering(true);
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

          hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
            const level = hls.levels[data.level];
            if (level && level.height) {
              setActiveHeight(level.height);
            }
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

          // Buffer targets to optimize live startup and reduce buffering issues
          player.configure({
            streaming: {
              rebufferingGoal: 4,
              bufferingGoal: 30,
              retryParameters: {
                maxAttempts: 4,
                baseDelay: 1000,
                backoffFactor: 2,
                timeout: 15000
              }
            }
          });

          await player.load(streamUrl);
          onShakaLoadSuccess(player);
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
              onShakaLoadSuccess(playerRef.current);
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
    const container = containerRef.current;
    if (!container) return;

    if (!isFullscreen) {
      // Enter Fullscreen (handles browser compatibility and fallbacks)
      if (container.requestFullscreen) {
        container.requestFullscreen().catch(err => {
          console.warn('Native fullscreen failed, using CSS fallback:', err);
        });
      } else if ((container as any).webkitRequestFullscreen) {
        (container as any).webkitRequestFullscreen();
      } else if (videoRef.current && (videoRef.current as any).webkitEnterFullscreen) {
        // iPhone native video fullscreen fallback
        try {
          (videoRef.current as any).webkitEnterFullscreen();
        } catch (err) {
          console.warn('webkitEnterFullscreen failed:', err);
        }
      }
      setIsFullscreen(true);
    } else {
      // Exit Fullscreen
      if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(err => console.warn(err));
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        }
      }
      setIsFullscreen(false);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || !isFinite(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const seekToLiveEdge = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current || !isLive) return;

    try {
      if (playerRef.current) {
        const seekRange = playerRef.current.seekRange();
        videoRef.current.currentTime = seekRange.end - 1;
      } else {
        const seekable = videoRef.current.seekable;
        if (seekable && seekable.length > 0) {
          videoRef.current.currentTime = seekable.end(seekable.length - 1) - 1;
        } else if (videoRef.current.duration && isFinite(videoRef.current.duration)) {
          videoRef.current.currentTime = videoRef.current.duration - 1;
        }
      }
      setIsAtLiveEdge(true);
    } catch (err) {
      console.warn('Seek to live edge failed:', err);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const cur = videoRef.current.currentTime;
      setCurrentTime(cur);
      const dur = videoRef.current.duration;
      if (dur === Infinity || isNaN(dur) || dur <= 0) {
        setIsLive(true);
        // Calculate delay
        let liveEnd = 0;
        if (playerRef.current) {
          liveEnd = playerRef.current.seekRange().end;
        } else {
          const seekable = videoRef.current.seekable;
          if (seekable && seekable.length > 0) {
            liveEnd = seekable.end(seekable.length - 1);
          }
        }
        if (liveEnd > 0) {
          const delay = liveEnd - cur;
          setIsAtLiveEdge(delay <= 10); // Synced if delay is 10 seconds or less
        } else {
          setIsAtLiveEdge(true);
        }
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
        const tracks = playerRef.current.getVariantTracks();
        const sortedTracks = [...tracks].sort((a, b) => (a.height || 0) - (b.height || 0));
        const mediumTrack = sortedTracks.find(t => (t.height || 0) >= 480) || sortedTracks[0];
        if (mediumTrack) {
          playerRef.current.selectVariantTrack(mediumTrack, true);
        }
        playerRef.current.configure({
          abr: {
            enabled: true,
            clearBufferSwitch: true
          }
        });
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
        className={`relative bg-black group shadow-2xl flex items-center justify-center overflow-hidden transition-all duration-300 ${isFullscreen
          ? 'fixed inset-0 w-screen h-screen rounded-none ring-0 border-none z-[99999]'
          : 'aspect-video rounded-[2rem] ring-1 ring-white/5 border border-white/5'
          } ${showControls ? '' : 'cursor-none'}`}
      >
        <video
          ref={videoRef}
          className={`w-full h-full object-contain ${showControls ? 'cursor-pointer' : 'cursor-none'}`}
          playsInline
          onPlay={() => {
            setIsPlaying(true);
            setHasStarted(true);
            setIsBuffering(false);
          }}
          onPause={() => setIsPlaying(false)}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onSeeking={() => setIsBuffering(true)}
          onSeeked={() => setIsBuffering(false)}
          onLoadStart={() => setIsBuffering(true)}
          onLoadedData={() => setIsBuffering(false)}
          onTimeUpdate={handleTimeUpdate}
        />

        {/* Global iOS Style Announcement Banner for Fullscreen Mode */}
        <GlobalAnnouncement onlyShowWhenFullscreen={true} isFullscreen={isFullscreen} />

        {/* YKN TV Watermark Logo - top right, follows control visibility */}
        <div
          className={`absolute top-3 right-3 sm:top-4 sm:right-4 z-30 pointer-events-none select-none transition-all duration-300 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
            }`}
        >
          <div className="flex items-baseline gap-[3px] drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
            <span
              className="text-white font-black tracking-tight leading-none"
              style={{ fontSize: 'clamp(18px, 3.5vw, 30px)', fontFamily: "'Arial Black', Arial, sans-serif", letterSpacing: '-0.5px' }}
            >
              YKN
            </span>
            <span
              className="font-black leading-none"
              style={{ fontSize: 'clamp(18px, 3.5vw, 30px)', fontFamily: "'Arial Black', Arial, sans-serif", color: '#D4AF37', letterSpacing: '-0.5px' }}
            >
              TV
            </span>
          </div>
        </div>

        {/* Custom Controls Panel */}
        <div
          className={`absolute bottom-2 left-2 right-2 sm:bottom-4 sm:left-4 sm:right-4 bg-black/60 backdrop-blur-md border border-white/10 flex flex-col justify-end p-2.5 sm:p-3.5 rounded-2xl sm:rounded-[1.5rem] transition-all duration-300 z-30 shadow-2xl ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
            }`}
        >
          {/* Timeline Seek bar for VOD */}
          {!isLive && (
            <div
              onClick={handleSeek}
              className="w-full h-1 bg-white/10 rounded-full mb-2.5 cursor-pointer relative group/progress transition-all hover:h-1.5"
            >
              <div
                className="h-full bg-primary rounded-full relative shadow-[0_0_10px_rgba(212,175,55,0.6)]"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              >
                <div className="w-2.5 h-2.5 bg-white border-2 border-primary rounded-full absolute right-0 top-1/2 -translate-y-1/2 scale-0 group-hover/progress:scale-100 transition-transform shadow-[0_0_8px_rgba(212,175,55,0.8)]" />
              </div>
            </div>
          )}

          {/* Control Actions row */}
          <div className="flex items-center justify-between gap-2 select-none">
            <div className="flex items-center gap-2 sm:gap-3.5">
              {/* Play / Pause */}
              <button
                onClick={() => togglePlay()}
                className="w-7.5 h-7.5 sm:w-8 sm:h-8 bg-primary hover:bg-primary/95 text-black rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary/10 cursor-pointer shrink-0"
              >
                {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" className="ml-0.5" />}
              </button>

              {/* Volume Controller */}
              <div className="flex items-center gap-1 group/volume relative">
                <button
                  onClick={toggleMute}
                  className="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0"
                >
                  {isMuted || volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-0 opacity-0 group-hover/volume:w-16 md:group-hover/volume:w-20 group-hover/volume:opacity-100 transition-all duration-300 origin-left accent-primary h-1 bg-white/10 hover:bg-white/20 rounded-lg cursor-pointer hidden sm:block"
                />
              </div>

              {/* Live Status indicator / Catch up button */}
              {isLive ? (
                <button
                  onClick={seekToLiveEdge}
                  className={`flex items-center gap-1 py-0.5 px-2 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-wider select-none transition-all cursor-pointer ${isAtLiveEdge
                    ? 'bg-red-500/20 border border-red-400/50 text-red-400 shadow-[0_0_10px_rgba(248,113,113,0.35)] animate-pulse'
                    : 'bg-zinc-800/80 border border-zinc-700 text-zinc-400 hover:bg-red-500/15 hover:text-red-400 hover:border-red-400/40'
                    }`}
                  title={isAtLiveEdge ? "Siaran sinkron dengan Live" : "Siaran tertunda. Klik untuk sinkronisasi ulang ke Live"}
                >
                  <span className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${isAtLiveEdge ? 'bg-red-400' : 'bg-zinc-500'}`} />
                  {isAtLiveEdge ? 'LIVE' : 'LIVE (SYNC)'}
                </button>
              ) : (
                <div className="text-[10px] sm:text-[11px] font-mono font-bold text-zinc-400 select-none">
                  {formatTime(currentTime)} <span className="text-white/25">/</span> {formatTime(duration)}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2.5">
              {/* Picture-in-Picture toggle */}
              {document.pictureInPictureEnabled && (
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!videoRef.current) return;
                    try {
                      if (document.pictureInPictureElement) {
                        await document.exitPictureInPicture();
                      } else {
                        await videoRef.current.requestPictureInPicture();
                      }
                    } catch (err) {
                      console.warn('PiP failed:', err);
                    }
                  }}
                  className="p-1 text-zinc-400 hover:text-white transition-all hover:bg-white/5 rounded-lg border border-white/5 cursor-pointer"
                  title="Picture-in-Picture"
                >
                  <PictureInPicture2 size={14} />
                </button>
              )}

              {/* Video Resolution list */}
              {levels.length > 1 && (
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowQualityMenu(!showQualityMenu); }}
                    className="flex items-center gap-0.5 px-2 py-0.5 sm:py-1 bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/10 rounded-lg text-[9px] sm:text-[10px] font-black text-zinc-300 hover:text-white transition-all cursor-pointer"
                  >
                    <Settings size={10} className={showQualityMenu ? 'rotate-45' : ''} />
                    {currentLevel === 'auto' ? `Auto ${activeHeight ? `(${activeHeight}p)` : ''}` : levels.find(l => l.index === currentLevel)?.label || 'Auto'}
                  </button>
                  {showQualityMenu && (
                    <div className="absolute bottom-9 right-0 bg-[#080808]/95 backdrop-blur-md border border-white/10 rounded-xl p-1 w-20 sm:w-24 shadow-2xl flex flex-col gap-0.5 z-50">
                      {levels.map((level) => (
                        <button
                          key={level.index}
                          onClick={() => handleLevelChange(level.index)}
                          className={`w-full py-1 px-1.5 text-left rounded-md text-[8px] sm:text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${currentLevel === level.index
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
                className="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer animate-none"
              >
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
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



        {/* Buffering Overlay */}
        {isBuffering && !error && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-20 select-none pointer-events-none">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(212,175,55,0.2)]" />
            <p className="text-[10px] font-black uppercase tracking-widest text-primary animate-pulse">Memuat Aliran...</p>
          </div>
        )}

        {/* Solid Play button display before start */}
        {!hasStarted && !error && (
          <div className="absolute inset-0 bg-[#090909] flex flex-col items-center justify-center gap-6 z-20 select-none">
            <div
              className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-black hover:scale-105 transition-all cursor-pointer shadow-[0_0_35px_rgba(212,175,55,0.4)]"
              onClick={(e) => {
                setHasStarted(true);
                togglePlay(e);
              }}
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

        {/* Dim overlay when paused to block other interactions and allow click-to-play */}
        {hasStarted && !isPlaying && !error && !isBuffering && (
          <div
            className="absolute inset-0 bg-black/40 z-10 cursor-pointer"
            onClick={togglePlay}
          />
        )}

        {/* Center Play/Pause button when cursor moves (or when paused) */}
        {hasStarted && showControls && !error && !isBuffering && (
          <div className="absolute inset-0 flex items-center justify-center z-25 select-none pointer-events-none">
            <button
              onClick={togglePlay}
              className="text-white hover:text-primary transition-all duration-300 scale-100 hover:scale-110 active:scale-90 pointer-events-auto filter drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]"
            >
              {isPlaying ? <Pause size={48} fill="currentColor" /> : <Play size={48} fill="currentColor" className="ml-1.5" />}
            </button>
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
                setHasStarted(true);
                setIsBuffering(false);
                setIsAtLiveEdge(true);
              }}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all relative overflow-hidden group cursor-pointer ${currentServer.url === server.url
                ? 'bg-primary text-dark shadow-md'
                : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/5'
                }`}
            >
              <span className="relative z-10">{server.name}</span>
              {(server.keyId || server.keys || server.url.includes('|')) && (
                <Shield size={9} className="absolute top-0.5 right-0.5 opacity-40 shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;