import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  src?: string;
  height?: number;
  bandwidth?: number;
}

interface IOSFullscreenViewport {
  width: number;
  height: number;
  top: number;
  left: number;
}

const getIOSFullscreenViewport = (): IOSFullscreenViewport => {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0, top: 0, left: 0 };
  }

  const viewport = window.visualViewport;
  return {
    width: Math.round(viewport?.width || window.innerWidth || document.documentElement.clientWidth),
    height: Math.round(viewport?.height || window.innerHeight || document.documentElement.clientHeight),
    top: Math.round(viewport?.offsetTop || 0),
    left: Math.round(viewport?.offsetLeft || 0),
  };
};

const isIOSDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;

  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';

  return (
    /iPhone|iPad|iPod/i.test(ua) ||
    (platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
};

const fetchManifestText = async (url: string): Promise<{ text: string; finalUrl: string }> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Manifest request failed: ${response.status}`);
    }

    return {
      text: await response.text(),
      finalUrl: response.url || url,
    };
  } finally {
    clearTimeout(timer);
  }
};

const parseNativeHlsQualityOptions = (playlistText: string, playlistUrl: string): QualityOption[] => {
  if (!playlistText.includes('#EXT-X-STREAM-INF')) return [];

  const lines = playlistText.split('\n');
  const variants: QualityOption[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line.startsWith('#EXT-X-STREAM-INF')) continue;

    const resolutionMatch = line.match(/RESOLUTION=\d+x(\d+)/i);
    const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/i);
    const height = resolutionMatch ? Number(resolutionMatch[1]) : undefined;
    const bandwidth = bandwidthMatch ? Number(bandwidthMatch[1]) : undefined;

    let uri = '';
    for (let next = i + 1; next < lines.length; next += 1) {
      const candidate = lines[next].trim();
      if (!candidate) continue;
      if (candidate.startsWith('#')) break;
      uri = candidate;
      break;
    }

    if (!uri) continue;

    const src = new URL(uri, playlistUrl).toString();
    const fallbackIndex = 100000 + variants.length;
    variants.push({
      index: height || fallbackIndex,
      label: height ? `${height}p` : bandwidth ? `${Math.round(bandwidth / 1000)}k` : `Level ${variants.length + 1}`,
      src,
      height,
      bandwidth,
    });
  }

  const bestByLabel = new Map<string, QualityOption>();
  variants.forEach((variant) => {
    const key = variant.height ? `h-${variant.height}` : variant.label;
    const existing = bestByLabel.get(key);
    if (!existing || (variant.bandwidth || 0) > (existing.bandwidth || 0)) {
      bestByLabel.set(key, variant);
    }
  });

  return Array.from(bestByLabel.values()).sort((a, b) => (
    (b.height || 0) - (a.height || 0) ||
    (b.bandwidth || 0) - (a.bandwidth || 0)
  ));
};

const VideoPlayer: React.FC<VideoPlayerProps> = ({ servers }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<shaka.Player | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const iosMasterUrlRef = useRef<string | null>(null);
  const streamLoadIdRef = useRef(0);
  const iosFullscreenScrollYRef = useRef(0);
  const iosBodyStyleRef = useRef<{
    position: string;
    top: string;
    left: string;
    right: string;
    width: string;
    height: string;
    overflow: string;
    overscrollBehavior: string;
    touchAction: string;
  } | null>(null);
  const iosHtmlStyleRef = useRef<{
    overflow: string;
    height: string;
    overscrollBehavior: string;
    touchAction: string;
  } | null>(null);

  const isIOSRuntime = useMemo(() => isIOSDevice(), []);
  const useIOSNativePlayer = isIOSRuntime;

  const [currentServer, setCurrentServer] = useState(servers[0] || null);
  const [isPlaying, setIsPlaying] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const STARTUP_GRACE_MS = 45000;

  const [isBooting, setIsBooting] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Memuat siaran...');
  const playbackConfirmedRef = useRef(false);
  const startupErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Custom Controls State
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isIOSNativeFullscreen, setIsIOSNativeFullscreen] = useState(false);
  const [isIOSCssFullscreenFallback, setIsIOSCssFullscreenFallback] = useState(false);
  const [isIframeCssFullscreen, setIsIframeCssFullscreen] = useState(false);
  const [iosFullscreenViewport, setIOSFullscreenViewport] = useState<IOSFullscreenViewport>(() => (
    getIOSFullscreenViewport()
  ));
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLive, setIsLive] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [levels, setLevels] = useState<QualityOption[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number | 'auto'>('auto');
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showIframeChrome, setShowIframeChrome] = useState(true);
  const [hasStarted, setHasStarted] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isAtLiveEdge, setIsAtLiveEdge] = useState(true);
  const [activeHeight, setActiveHeight] = useState<number | null>(null);
  const stallWatchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const iframeChromeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTimeRef = useRef<number>(0);
  const stallCountRef = useRef<number>(0);
  const lastQualityChangeTimeRef = useRef<number>(0);
  const bufferingDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getPublicServerName = (server: any) => {
    const index = servers.findIndex(s => s.url === server?.url && s.forceProxy === server?.forceProxy);
    return `Server ${index >= 0 ? index + 1 : 1}`;
  };

  // Sync current server if servers list changes
  useEffect(() => {
    if (!servers || servers.length === 0) return;

    setCurrentServer((prev) => {
      // Kalau user sudah pilih server, jangan diganti otomatis.
      // Ini mencegah balik ke Server 1 saat polling extraServers jalan.
      if (prev?.url && servers.some(s => s.url === prev.url && s.forceProxy === prev.forceProxy)) {
        return prev;
      }

      // Hanya set Server 1 saat pertama kali player belum punya server.
      return servers[0];
    });
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

  const resolveDynamicStreamUrl = async (server: StreamServer): Promise<string> => {
    const rawUrl = cleanStreamUrl(server.url);

    if (!server.tokenChannelId || !server.tokenEndpoint) {
      return rawUrl;
    }

    const tokenRes = await fetch(getProxiedUrl(server.tokenEndpoint, true), {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channelId: server.tokenChannelId }),
      cache: 'no-store',
    });

    if (!tokenRes.ok) {
      throw new Error(`SBS token request failed: ${tokenRes.status}`);
    }

    const tokenData = await tokenRes.json() as { playUrl?: string };

    if (!tokenData.playUrl) {
      throw new Error('SBS token response missing playUrl');
    }

    return new URL(tokenData.playUrl, server.tokenBaseUrl || window.location.origin).toString();
  };

  const getProxyFallbackServer = () => {
    if (!currentServer || currentServer.forceProxy) return null;

    const currentRawUrl = cleanStreamUrl(currentServer.url);
    return servers.find((server) => (
      server.forceProxy === true && cleanStreamUrl(server.url) === currentRawUrl
    )) || null;
  };

  const selectServer = (server: StreamServer) => {
    setCurrentServer(server);
    setIsPlaying(false);
    setHasStarted(true);
    setError(null);
    setIsBooting(true);
    setIsBuffering(true);
    setLoadingMessage(`Memuat ${getPublicServerName(server)}...`);
    setIsAtLiveEdge(true);
    setActiveHeight(null);
  };

  const clearBufferingDelayTimer = () => {
    if (bufferingDelayTimerRef.current) {
      clearTimeout(bufferingDelayTimerRef.current);
      bufferingDelayTimerRef.current = null;
    }
  };

  const showBufferingImmediately = () => {
    clearBufferingDelayTimer();
    setIsBuffering(true);
  };

  const hideBuffering = () => {
    clearBufferingDelayTimer();
    setIsBuffering(false);
  };

  const showBufferingWithDelay = () => {
    clearBufferingDelayTimer();

    const video = videoRef.current;
    if (!video || video.paused || video.ended || error) return;

    bufferingDelayTimerRef.current = setTimeout(() => {
      const latestVideo = videoRef.current;
      if (!latestVideo || latestVideo.paused || latestVideo.ended || error) return;

      if (latestVideo.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        return;
      }

      setIsBuffering(true);
    }, useIOSNativePlayer ? 900 : 300);
  };

  const getNativeVideoErrorMessage = (video: HTMLVideoElement): string => {
    const nativeError = video.error;
    const code = nativeError?.code;
    const activeServerName = currentServer ? getPublicServerName(currentServer) : 'server ini';
    const proxyHint = useIOSNativePlayer
      ? 'Browser iOS ini tidak support player HLS JS, jadi fallback ke native Safari. Kalau masih gagal, source iOS ini perlu diganti.'
      : currentServer?.forceProxy
        ? 'Kalau masih gagal, source HLS kemungkinan memang ditolak Safari iOS.'
        : 'Coba pilih Server 2 (Proxy) supaya playlist dan segment lewat proxy.';

    if (code === 2) {
      return `iOS gagal mengambil playlist/segment HLS dari ${activeServerName}. ${proxyHint}`;
    }

    if (code === 3) {
      return 'Stream terbaca, tapi iOS gagal decode video/audio. Kemungkinan codec HLS tidak cocok untuk Safari iPhone.';
    }

    if (code === 4) {
      return `iOS menolak source HLS dari ${activeServerName}. Biasanya karena playlist tidak kompatibel, redirect/token bermasalah, atau codec tidak didukung. ${proxyHint}`;
    }

    return `iOS native player gagal memuat siaran dari ${activeServerName}. ${proxyHint}`;
  };

  const handleNativeVideoError = () => {
    const video = videoRef.current;
    if (!video) return;

    const nativeError = video.error;
    if (nativeError?.code === 1) {
      return;
    }

    console.warn('Native video error:', {
      code: nativeError?.code,
      message: nativeError?.message,
      src: video.currentSrc || video.src,
      server: currentServer,
    });

    clearStartupErrorTimer();
    setIsBooting(false);
    hideBuffering();
    setIsPlaying(false);
    setError(getNativeVideoErrorMessage(video));
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

  const clearStartupErrorTimer = () => {
    if (startupErrorTimerRef.current) {
      clearTimeout(startupErrorTimerRef.current);
      startupErrorTimerRef.current = null;
    }
  };

  const confirmPlaybackReady = () => {
    playbackConfirmedRef.current = true;
    clearStartupErrorTimer();
    setIsBooting(false);
    hideBuffering();
    setError(null);
    setIsPlaying(true);
  };

  const showStartupErrorWithDelay = (message: string) => {
    if (playbackConfirmedRef.current) {
      setIsBooting(false);
      hideBuffering();
      setError(message);
      return;
    }

    setError(null);
    setIsBooting(true);
    showBufferingImmediately();
    setLoadingMessage('Menyambungkan siaran...');

    clearStartupErrorTimer();

    startupErrorTimerRef.current = setTimeout(() => {
      if (!playbackConfirmedRef.current) {
        setIsBooting(false);
        hideBuffering();
        setError(message);
      }
    }, STARTUP_GRACE_MS);
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setIsFullscreen(isFs);
      if (!isFs) {
        setIsIOSNativeFullscreen(false);
        setIsIOSCssFullscreenFallback(false);
        setIsIframeCssFullscreen(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (iframeChromeTimerRef.current) {
      clearTimeout(iframeChromeTimerRef.current);
      iframeChromeTimerRef.current = null;
    }

    if (currentServer?.type !== 'iframe' || (!isFullscreen && !isIframeCssFullscreen)) {
      setShowIframeChrome(true);
      return;
    }

    setShowIframeChrome(true);
    iframeChromeTimerRef.current = setTimeout(() => {
      setShowIframeChrome(false);
      iframeChromeTimerRef.current = null;
    }, 2400);

    return () => {
      if (iframeChromeTimerRef.current) {
        clearTimeout(iframeChromeTimerRef.current);
        iframeChromeTimerRef.current = null;
      }
    };
  }, [currentServer?.type, isFullscreen, isIframeCssFullscreen]);

  useEffect(() => {
    if (!videoRef.current) return;

    shaka.polyfill.installAll();
    const player = new shaka.Player();
    playerRef.current = player;

    player.addEventListener('error', (event: any) => {
      console.error('Shaka Player Error:', event.detail);
      if (!hlsRef.current) {
        // Only trigger UI error overlay if the error severity is CRITICAL (2)
        if (event.detail && event.detail.severity === 2) {
          showStartupErrorWithDelay(`Stream Error: ${event.detail.code}`);
        } else {
          console.warn('Recoverable Shaka error ignored in UI:', event.detail.code);
        }
      }
    });

    player.addEventListener('buffering', (event: any) => {
      if (!useIOSNativePlayer) {
        if (event.buffering) {
          showBufferingWithDelay();
        } else {
          hideBuffering();
        }
      }
    });

    player.addEventListener('adaptation', () => {
      const activeTrack = player.getVariantTracks().find(t => t.active);
      if (activeTrack && activeTrack.height) {
        setActiveHeight(activeTrack.height);
      }
    });

    const videoEl = videoRef.current;
    const handleWebkitBeginFullscreen = () => {
      setIsIOSNativeFullscreen(true);
      setIsFullscreen(true);
      setShowControls(false);
      setShowQualityMenu(false);
    };
    const handleWebkitEndFullscreen = () => {
      setIsIOSNativeFullscreen(false);
      setIsFullscreen(false);
      setShowControls(true);
      if (videoEl) {
        videoEl.controls = false;
      }
    };

    if (videoEl) {
      videoEl.addEventListener('webkitbeginfullscreen', handleWebkitBeginFullscreen);
      videoEl.addEventListener('webkitendfullscreen', handleWebkitEndFullscreen);
    }

    return () => {
      clearStartupErrorTimer();
      clearBufferingDelayTimer();
      destroyPlayers();
      if (playerRef.current) {
        playerRef.current.destroy().catch(e => console.error("Player destroy error:", e));
      }
      if (videoEl) {
        videoEl.removeEventListener('webkitbeginfullscreen', handleWebkitBeginFullscreen);
        videoEl.removeEventListener('webkitendfullscreen', handleWebkitEndFullscreen);
      }
    };
  }, []);

  // Manage body scroll and orientation lock dynamically when isFullscreen changes
  useEffect(() => {
    const shouldManageBodyFullscreen = !useIOSNativePlayer || isIframeCssFullscreen;
    if (!shouldManageBodyFullscreen) return;

    const releaseBodyFullscreen = () => {
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
    };

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

      return releaseBodyFullscreen;
    }

    releaseBodyFullscreen();
  }, [isFullscreen, useIOSNativePlayer, isIframeCssFullscreen]);

  useEffect(() => {
    if (!useIOSNativePlayer || !isIOSCssFullscreenFallback || isIOSNativeFullscreen) return;

    const html = document.documentElement;
    const body = document.body;

    iosFullscreenScrollYRef.current = window.scrollY || html.scrollTop || 0;
    iosBodyStyleRef.current = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      height: body.style.height,
      overflow: body.style.overflow,
      overscrollBehavior: body.style.overscrollBehavior,
      touchAction: body.style.touchAction,
    };
    iosHtmlStyleRef.current = {
      overflow: html.style.overflow,
      height: html.style.height,
      overscrollBehavior: html.style.overscrollBehavior,
      touchAction: html.style.touchAction,
    };

    const syncIOSViewport = () => {
      setIOSFullscreenViewport(getIOSFullscreenViewport());
    };

    syncIOSViewport();
    const rafId = window.requestAnimationFrame(syncIOSViewport);
    const settleTimer = window.setTimeout(syncIOSViewport, 350);

    html.classList.add('ykn-ios-video-fullscreen');
    body.classList.add('ykn-fullscreen-active', 'ykn-ios-video-fullscreen');

    html.style.overflow = 'hidden';
    html.style.height = '100%';
    html.style.overscrollBehavior = 'none';
    html.style.touchAction = 'none';

    body.style.position = 'fixed';
    body.style.top = `-${iosFullscreenScrollYRef.current}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.height = '100%';
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';
    body.style.touchAction = 'none';

    window.visualViewport?.addEventListener('resize', syncIOSViewport);
    window.visualViewport?.addEventListener('scroll', syncIOSViewport);
    window.addEventListener('resize', syncIOSViewport);
    window.addEventListener('orientationchange', syncIOSViewport);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(settleTimer);
      window.visualViewport?.removeEventListener('resize', syncIOSViewport);
      window.visualViewport?.removeEventListener('scroll', syncIOSViewport);
      window.removeEventListener('resize', syncIOSViewport);
      window.removeEventListener('orientationchange', syncIOSViewport);

      html.classList.remove('ykn-ios-video-fullscreen');
      body.classList.remove('ykn-fullscreen-active', 'ykn-ios-video-fullscreen');

      const htmlStyle = iosHtmlStyleRef.current;
      if (htmlStyle) {
        html.style.overflow = htmlStyle.overflow;
        html.style.height = htmlStyle.height;
        html.style.overscrollBehavior = htmlStyle.overscrollBehavior;
        html.style.touchAction = htmlStyle.touchAction;
      }

      const bodyStyle = iosBodyStyleRef.current;
      if (bodyStyle) {
        body.style.position = bodyStyle.position;
        body.style.top = bodyStyle.top;
        body.style.left = bodyStyle.left;
        body.style.right = bodyStyle.right;
        body.style.width = bodyStyle.width;
        body.style.height = bodyStyle.height;
        body.style.overflow = bodyStyle.overflow;
        body.style.overscrollBehavior = bodyStyle.overscrollBehavior;
        body.style.touchAction = bodyStyle.touchAction;
      }

      window.scrollTo(0, iosFullscreenScrollYRef.current);
    };
  }, [isIOSCssFullscreenFallback, useIOSNativePlayer, isIOSNativeFullscreen]);

  // Pause playback and stop audio when a connection error screen is displayed
  useEffect(() => {
    if (error && videoRef.current) {
      try {
        videoRef.current.pause();
        setIsPlaying(false);
      } catch (e) {
        console.warn('Failed to pause video on error:', e);
      }
    }
  }, [error]);

  const loadIOSNativeQualityLevels = async (
    streamUrl: string,
    rawUrl: string,
    loadId: number
  ) => {
    const manifestUrls = [streamUrl];
    const forcedProxyUrl = getProxiedUrl(rawUrl, true);

    if (forcedProxyUrl !== streamUrl) {
      manifestUrls.push(forcedProxyUrl);
    }

    for (const manifestUrl of manifestUrls) {
      try {
        const { text, finalUrl } = await fetchManifestText(manifestUrl);
        const qualityLevels = parseNativeHlsQualityOptions(text, finalUrl);

        if (streamLoadIdRef.current !== loadId) return;

        if (qualityLevels.length > 0) {
          setLevels([{ index: 'auto', label: 'Auto' }, ...qualityLevels]);
        }
        return;
      } catch (err) {
        console.warn('iOS quality manifest fetch failed:', manifestUrl, err);
      }
    }
  };

  useEffect(() => {
    const loadStream = async () => {
      if (!currentServer || !videoRef.current) return;

      const loadId = streamLoadIdRef.current + 1;
      streamLoadIdRef.current = loadId;

      let rawUrl = cleanStreamUrl(currentServer.url);
      const keys = getDrmKeys(currentServer);

      if (currentServer.tokenChannelId) {
        setError(null);
        setIsBooting(true);
        showBufferingImmediately();
        setLoadingMessage('Mengambil token SBS...');

        try {
          rawUrl = await resolveDynamicStreamUrl(currentServer);
        } catch (e) {
          console.error('SBS token resolver failed:', e);
          setIsBooting(false);
          hideBuffering();
          setIsPlaying(false);
          setError('Gagal mengambil token SBS terbaru. Coba segarkan koneksi atau pilih server lain.');
          return;
        }
      }

      const forceProxy = currentServer.forceProxy === true || rawUrl.startsWith('http://');
      const autoProxiedUrl = getProxiedUrl(rawUrl, forceProxy);
      let streamUrl = autoProxiedUrl;
      let isHls = streamUrl.includes('.m3u8') || streamUrl.includes('m3u8');

      const lowerStreamUrl = streamUrl.toLowerCase();

      const shouldResolvePlaylistContainer =
        lowerStreamUrl.endsWith('.m3u') ||
        lowerStreamUrl.includes('/base.m3u') ||
        lowerStreamUrl.includes('githubusercontent') ||
        lowerStreamUrl.includes('iptvcat') ||
        lowerStreamUrl.includes('playlist');

      // Client-side parser for IPTV playlist containers (e.g. IPTVCat lists)
      // Khusus iOS native jangan paksa fetch manifest dari JS, biar Safari handle langsung.
      // iOS paling aman pakai URL HLS .m3u8 asli/non-DRM.
      // Catatan: .m3u8 asli jangan di-fetch manual supaya tidak double request manifest.
      if (isHls && !useIOSNativePlayer && shouldResolvePlaylistContainer) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 7000);
        try {
          const checkRes = await fetch(streamUrl, { signal: controller.signal, cache: 'no-store' });
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
                streamUrl = getProxiedUrl(resolvedUrl, currentServer.forceProxy === true);
                isHls = streamUrl.includes('.m3u8') || streamUrl.includes('m3u8');
              }
            }
          }
        } catch (e) {
          console.warn('IPTV container resolver failed or timed out:', e);
        } finally {
          clearTimeout(timer);
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

      playbackConfirmedRef.current = false;
      clearStartupErrorTimer();

      setError(null);
      setIsBooting(true);
      showBufferingImmediately();
      setLoadingMessage(`Memuat ${getPublicServerName(currentServer)}...`);
      setLevels([]);
      setCurrentLevel('auto');
      setActiveHeight(null);
      await destroyPlayers();

      try {
        if (useIOSNativePlayer) {
          const video = videoRef.current;
          if (!video) return;

          if (keys) {
            setIsBooting(false);
            hideBuffering();
            setError('Server ini memakai DRM/ClearKey dan tidak cocok untuk iPhone. Coba pilih Server iOS / HLS biasa.');
            return;
          }

          if (!isHls) {
            setIsBooting(false);
            hideBuffering();
            setError('Format server ini tidak cocok untuk iPhone. iOS paling aman pakai server HLS .m3u8.');
            return;
          }

          console.log('Using iOS native video player fallback:', streamUrl);

          iosMasterUrlRef.current = streamUrl;
          video.controls = false;
          video.playsInline = true;
          video.setAttribute('playsinline', 'true');
          video.setAttribute('webkit-playsinline', 'true');

          // Explicitly assign source and load to ensure Safari reacts to the source change
          video.src = streamUrl;
          video.load();

          setCurrentLevel('auto');
          setShowQualityMenu(false);
          setShowControls(true);
          setIsBooting(false);
          hideBuffering();
          setError(null);
          setHasStarted(true);
          void loadIOSNativeQualityLevels(streamUrl, rawUrl, loadId);

          // Autoplay on iOS is strict. Attempt to play and catch any rejection.
          video.play().then(() => {
            confirmPlaybackReady();
          }).catch(err => {
            console.warn('iOS autoplay prevented:', err);
            clearStartupErrorTimer();
            setIsPlaying(false);
            setShowControls(true);
          });

          return;
        }

        if (isHls && Hls.isSupported() && !keys) {
          console.log('Using Hls.js to play HLS stream:', streamUrl);
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,

            // Stabilitas live > latency. Jangan terlalu nempel live edge karena gampang rebuffer.
            liveSyncDurationCount: 5,
            liveMaxLatencyDurationCount: 10,

            // Buffer lebih tebal supaya aman di jaringan mobile/VPS proxy yang naik-turun.
            maxBufferLength: 45,
            maxMaxBufferLength: 90,
            backBufferLength: 30,
            maxBufferSize: 80 * 1000 * 1000,
            maxBufferHole: 0.5,
            startFragPrefetch: true,

            // ABR selalu mulai dari level terendah (startLevel: 0), baru naik bertahap sesuai bandwidth.
            // abrEwmaDefaultEstimate dikecilkan ke 500 kbps biar estimasi awal konservatif.
            // abrBandWidthUpFactor dikecilkan ke 0.5 biar naik lebih hati-hati, tidak langsung lompat tinggi.
            startLevel: 0,
            testBandwidth: true,
            abrEwmaDefaultEstimate: 500_000,
            abrEwmaFastLive: 3,
            abrEwmaSlowLive: 9,
            abrBandWidthFactor: 0.85,
            abrBandWidthUpFactor: 0.35,  // Naik kualitas lebih pelan — cegah overshoot → rebuffer
            abrMaxWithRealBitrate: true,
            maxStarvationDelay: 4,
            maxLoadingDelay: 4,
            nudgeOffset: 0.1,
            nudgeMaxRetry: 5,

            // Retry jangan terlalu lama menggantung di 1 segment rusak.
            fragLoadPolicy: {
              default: {
                maxTimeToFirstByteMs: 7000,
                maxLoadTimeMs: 15000,
                timeoutRetry: { maxNumRetry: 3, retryDelayMs: 800, maxRetryDelayMs: 4000 },
                errorRetry: { maxNumRetry: 4, retryDelayMs: 800, maxRetryDelayMs: 5000 }
              }
            },
            manifestLoadPolicy: {
              default: {
                maxTimeToFirstByteMs: 5000,
                maxLoadTimeMs: 10000,
                timeoutRetry: { maxNumRetry: 3, retryDelayMs: 500, maxRetryDelayMs: 2500 },
                errorRetry: { maxNumRetry: 3, retryDelayMs: 500, maxRetryDelayMs: 2500 }
              }
            }
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
            // Non-fatal stall sering terjadi di live HLS. Coba recover tanpa menampilkan error layar.
            if (!data.fatal) {
              if (
                data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR ||
                data.details === Hls.ErrorDetails.BUFFER_NUDGE_ON_STALL
              ) {
                // Biarkan hls.js recover sendiri lewat nudge mechanism-nya.
                // Jangan langsung seek — itu malah bikin segment di-request ulang dari awal dan re-stall.
                hls.startLoad();
              } else if (data.details === Hls.ErrorDetails.BUFFER_SEEK_OVER_HOLE) {
                // Ada gap/hole di buffer — seek ke posisi aman yang jauh dari live edge.
                const video = videoRef.current;
                if (video && isLive && video.seekable && video.seekable.length > 0) {
                  const liveEdge = video.seekable.end(video.seekable.length - 1);
                  video.currentTime = Math.max(liveEdge - 18, video.seekable.start(0));
                }
                hls.startLoad();
              }
              return;
            }

            console.error('Fatal Hls.js Error:', data);
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              if (currentServer.forceProxy === true) {
                if (!triedProxy) {
                  triedProxy = true;
                  hls.startLoad();
                } else {
                  showStartupErrorWithDelay('Gagal memuat siaran video (Error Jaringan).');
                }
              } else {
                showStartupErrorWithDelay('Server direct gagal dimuat. Coba pilih Server Proxy Backup.');
              }
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              try {
                hls.recoverMediaError();
              } catch (_) {
                showStartupErrorWithDelay(`Playback Error: ${data.details}`);
              }
            } else {
              showStartupErrorWithDelay(`Playback Error: ${data.details}`);
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

          // Jangan set Origin/Referer dari browser: header ini sering ditolak browser/CDN dan bisa memicu fallback/proxy.
          // Origin/Referer khusus upstream cukup diatur di proxy Node.js lewat env SOURCE_ORIGIN/SOURCE_REFERER.

          if (keys) {
            player.configure({
              drm: { clearKeys: keys }
            });
          } else {
            player.configure({ drm: { clearKeys: {} } });
          }

          // Shaka: mulai dari resolusi terendah, naikkan bertahap.
          // defaultBandwidthEstimate dikecilkan ke 300 kbps biar Shaka pilih track paling rendah dulu.
          // restrictions.maxHeight diset ke 240 saat awal, lalu dilepas setelah 8 detik playback berjalan.
          player.configure({
            abr: {
              defaultBandwidthEstimate: 300_000,
              bandwidthUpgradeTarget: 0.7,
              bandwidthDowngradeTarget: 0.95,
              switchInterval: 8,
              restrictions: { maxHeight: 240 }
            },
            streaming: {
              rebufferingGoal: 8,
              bufferingGoal: 30,
              bufferBehind: 30,
              retryParameters: {
                maxAttempts: 5,
                baseDelay: 700,
                backoffFactor: 2,
                timeout: 15000
              }
            },
            manifest: {
              retryParameters: {
                maxAttempts: 4,
                baseDelay: 500,
                backoffFactor: 2,
                timeout: 10000
              }
            }
          });

          await player.load(streamUrl);
          onShakaLoadSuccess(player);

          // Setelah 8 detik playback berjalan, lepas batasan resolusi biar ABR bisa naik bebas.
          setTimeout(() => {
            if (playerRef.current === player) {
              player.configure({ abr: { restrictions: { maxHeight: Infinity } } });
              console.log('Shaka ABR: resolusi restriction dilepas, siap naik kualitas.');
            }
          }, 8000);

        } else {
          setError('Format siaran tidak didukung di peramban ini.');
        }
      } catch (e: any) {
        console.error('Player Load/Attach Error:', e);

        // 1001 = BAD_HTTP_STATUS, 1002 = HTTP_ERROR, 1009 = REQUEST_FILTER_ERROR or bad CDN response
        const isNetworkError = [1001, 1002, 1009].includes(e.code);
        if (isNetworkError && currentServer.forceProxy !== true) {
          showStartupErrorWithDelay('Server direct gagal dimuat. Coba pilih Server Proxy Backup.');
          return;
        }

        if (e.code !== 7000) {
          showStartupErrorWithDelay(`Gagal memuat siaran. Kode Internal: ${e.code || 'UNKNOWN'}`);
        }
      }
    };

    loadStream();
  }, [
    currentServer?.url,
    currentServer?.forceProxy,
    currentServer?.tokenChannelId,
    currentServer?.tokenEndpoint,
    currentServer?.tokenBaseUrl,
    useIOSNativePlayer,
  ]);

  // Stall Watchdog: detects when video freezes silently (no error, no buffering event)
  // and automatically recovers by skipping forward to a safe live offset (not the extreme edge)
  useEffect(() => {
    if (useIOSNativePlayer) return;

    const startWatchdog = () => {
      if (stallWatchdogRef.current) clearInterval(stallWatchdogRef.current);
      stallWatchdogRef.current = setInterval(() => {
        const video = videoRef.current;
        if (!video || !isPlaying || isBuffering || error) {
          stallCountRef.current = 0;
          return;
        }

        // Skip watchdog check for 12 seconds after a manual quality switch to let buffer stabilize
        const timeSinceQualityChange = Date.now() - lastQualityChangeTimeRef.current;
        if (timeSinceQualityChange < 12000) {
          stallCountRef.current = 0;
          return;
        }

        const currentPos = video.currentTime;
        if (currentPos === lastTimeRef.current && !video.paused && !video.ended) {
          stallCountRef.current += 1;
          console.warn(`Stream stall detected (count: ${stallCountRef.current}), currentTime: ${currentPos}`);

          // Trigger recovery only after 3 consecutive stalls (9 seconds total) to prevent aggressive seeking
          if (stallCountRef.current >= 3) {
            if (isLive && video.seekable && video.seekable.length > 0) {
              const liveEdge = video.seekable.end(video.seekable.length - 1);
              // Seek ke posisi 15s di belakang live edge — cukup jauh agar CDN sudah siapkan segment
              const targetSeek = Math.max(liveEdge - 15, video.seekable.start(0));
              console.log(`Stall recovery: seeking to safe live offset ${targetSeek} (liveEdge: ${liveEdge})`);
              video.currentTime = targetSeek;
            } else {
              console.log('Stall recovery: nudging currentTime forward');
              video.currentTime = currentPos + 0.5;
            }
            video.play().catch(e => console.warn('Stall recovery play failed:', e));
            stallCountRef.current = 0;
          }
        } else {
          stallCountRef.current = 0;
        }
        lastTimeRef.current = currentPos;
      }, 3000); // check every 3 seconds
    };

    if (isPlaying) {
      startWatchdog();
    } else {
      if (stallWatchdogRef.current) clearInterval(stallWatchdogRef.current);
    }

    return () => {
      if (stallWatchdogRef.current) clearInterval(stallWatchdogRef.current);
    };
  }, [isPlaying, isBuffering, error, isLive, useIOSNativePlayer]);

  // Autohide Controls
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleHide = () => {
      clearTimeout(timeoutId);
      if (isPlaying && !showQualityMenu) {
        timeoutId = setTimeout(() => {
          setShowControls(false);
          setShowQualityMenu(false);
        }, 3000);
      }
    };

    const revealControls = () => {
      setShowControls(true);
      scheduleHide();
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', revealControls);
      container.addEventListener('pointerdown', revealControls);
      container.addEventListener('touchstart', revealControls);
    }

    scheduleHide();

    return () => {
      if (container) {
        container.removeEventListener('mousemove', revealControls);
        container.removeEventListener('pointerdown', revealControls);
        container.removeEventListener('touchstart', revealControls);
      }
      clearTimeout(timeoutId);
    };
  }, [isPlaying, showQualityMenu]);

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

  const lockLandscapeIfPossible = async () => {
    try {
      const orientation = screen.orientation as any;
      if (orientation && typeof orientation.lock === 'function') {
        await orientation.lock('landscape');
      }
    } catch (err) {
      console.warn('Orientation lock failed:', err);
    }
  };

  const unlockOrientationIfPossible = () => {
    try {
      const orientation = screen.orientation as any;
      if (orientation && typeof orientation.unlock === 'function') {
        orientation.unlock();
      }
    } catch (err) {
      console.warn('Orientation unlock failed:', err);
    }
  };

  const enterIOSCssFullscreenFallback = () => {
    setIsIOSNativeFullscreen(false);
    setIsIOSCssFullscreenFallback(true);
    setIOSFullscreenViewport(getIOSFullscreenViewport());
    setIsFullscreen(true);
    setShowControls(true);
    setShowQualityMenu(false);
    window.requestAnimationFrame(() => {
      setIOSFullscreenViewport(getIOSFullscreenViewport());
      containerRef.current?.focus();
    });
    void lockLandscapeIfPossible();
  };

  const exitIOSCssFullscreenFallback = () => {
    setIsIOSCssFullscreenFallback(false);
    setIsFullscreen(false);
    setShowControls(true);
    setShowQualityMenu(false);
    unlockOrientationIfPossible();
  };

  const toggleFullscreen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;

    if (useIOSNativePlayer) {
      const video = videoRef.current;
      if (!video) return;

      const docFullscreen = document.fullscreenElement || (document as any).webkitFullscreenElement;

      if (docFullscreen) {
        try {
          if (document.exitFullscreen) {
            await document.exitFullscreen();
          } else if ((document as any).webkitExitFullscreen) {
            (document as any).webkitExitFullscreen();
          }
        } catch (err) {
          console.warn('Exit fullscreen failed:', err);
        }
        setIsFullscreen(false);
        setIsIOSCssFullscreenFallback(false);
        setIsIOSNativeFullscreen(false);
        setShowControls(true);
        unlockOrientationIfPossible();
        return;
      }

      if (isIOSCssFullscreenFallback) {
        exitIOSCssFullscreenFallback();
        return;
      }

      setShowQualityMenu(false);
      setShowControls(true);
      setIsIOSNativeFullscreen(false);

      try {
        const iosVideo = video as HTMLVideoElement & {
          webkitEnterFullscreen?: () => void;
          webkitEnterFullScreen?: () => void;
          webkitExitFullscreen?: () => void;
          webkitDisplayingFullscreen?: boolean;
        };

        if (iosVideo.webkitDisplayingFullscreen && iosVideo.webkitExitFullscreen) {
          iosVideo.webkitExitFullscreen();
          setIsIOSNativeFullscreen(false);
          setIsFullscreen(false);
          setShowControls(true);
          return;
        }

        if (container.requestFullscreen) {
          await container.requestFullscreen();
          setIsFullscreen(true);
          setIsIOSCssFullscreenFallback(false);
          await lockLandscapeIfPossible();
        } else if ((container as any).webkitRequestFullscreen) {
          (container as any).webkitRequestFullscreen();
          setIsFullscreen(true);
          setIsIOSCssFullscreenFallback(false);
          await lockLandscapeIfPossible();
        } else if (iosVideo.webkitEnterFullscreen) {
          video.controls = true;
          setShowControls(false);
          setIsIOSNativeFullscreen(true);
          iosVideo.webkitEnterFullscreen();
        } else if (iosVideo.webkitEnterFullScreen) {
          video.controls = true;
          setShowControls(false);
          setIsIOSNativeFullscreen(true);
          iosVideo.webkitEnterFullScreen();
        } else {
          enterIOSCssFullscreenFallback();
        }
      } catch (err) {
        console.warn('iOS fullscreen failed, using CSS fallback:', err);
        enterIOSCssFullscreenFallback();
      }

      return;
    }

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

  const enterIframeCssFullscreen = () => {
    setIsIframeCssFullscreen(true);
    setIsFullscreen(true);
    setShowQualityMenu(false);
    window.requestAnimationFrame(() => {
      containerRef.current?.focus();
    });
    void lockLandscapeIfPossible();
  };

  const exitIframeFullscreen = async () => {
    const docFullscreen = document.fullscreenElement || (document as any).webkitFullscreenElement;

    if (docFullscreen) {
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        }
      } catch (err) {
        console.warn('Exit iframe fullscreen failed:', err);
      }
    }

    setIsIframeCssFullscreen(false);
    setIsFullscreen(false);
    unlockOrientationIfPossible();
  };

  const toggleIframeFullscreen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;

    const docFullscreen = document.fullscreenElement || (document as any).webkitFullscreenElement;
    if (docFullscreen || isIframeCssFullscreen) {
      await exitIframeFullscreen();
      return;
    }

    setShowQualityMenu(false);

    try {
      if (container.requestFullscreen) {
        await container.requestFullscreen();
        setIsFullscreen(true);
        setIsIframeCssFullscreen(false);
        await lockLandscapeIfPossible();
      } else if ((container as any).webkitRequestFullscreen) {
        (container as any).webkitRequestFullscreen();
        setIsFullscreen(true);
        setIsIframeCssFullscreen(false);
        await lockLandscapeIfPossible();
      } else {
        enterIframeCssFullscreen();
      }
    } catch (err) {
      console.warn('Iframe fullscreen failed, using CSS fallback:', err);
      enterIframeCssFullscreen();
    }
  };

  const revealIframeChrome = () => {
    setShowIframeChrome(true);

    if (iframeChromeTimerRef.current) {
      clearTimeout(iframeChromeTimerRef.current);
      iframeChromeTimerRef.current = null;
    }

    if (currentServer?.type === 'iframe' && (isFullscreen || isIframeCssFullscreen)) {
      iframeChromeTimerRef.current = setTimeout(() => {
        setShowIframeChrome(false);
        iframeChromeTimerRef.current = null;
      }, 2400);
    }
  };

  useEffect(() => {
    if (!isIframeCssFullscreen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      setIsIframeCssFullscreen(false);
      setIsFullscreen(false);

      try {
        const orientation = screen.orientation as any;
        if (orientation && typeof orientation.unlock === 'function') {
          orientation.unlock();
        }
      } catch (err) {
        console.warn('Orientation unlock failed:', err);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isIframeCssFullscreen]);

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
        videoRef.current.currentTime = Math.max(seekRange.end - 8, seekRange.start);
      } else {
        const seekable = videoRef.current.seekable;
        if (seekable && seekable.length > 0) {
          videoRef.current.currentTime = Math.max(seekable.end(seekable.length - 1) - 8, seekable.start(0));
        } else if (videoRef.current.duration && isFinite(videoRef.current.duration)) {
          videoRef.current.currentTime = Math.max(videoRef.current.duration - 8, 0);
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

      // Auto-clear loading overlays when time starts advancing
      if (!videoRef.current.paused) {
        if (isBooting) setIsBooting(false);
        if (isBuffering || bufferingDelayTimerRef.current) {
          hideBuffering();
        }
      }

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
          setIsAtLiveEdge(delay <= 20); // Synced if delay is 20 seconds or less
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
    lastQualityChangeTimeRef.current = Date.now();
    setCurrentLevel(levelIdx);
    setShowQualityMenu(false);

    if (useIOSNativePlayer) {
      const video = videoRef.current;
      const selectedLevel = levels.find(level => level.index === levelIdx);
      const nextSrc = levelIdx === 'auto' ? iosMasterUrlRef.current : selectedLevel?.src;

      if (!video || !nextSrc) return;

      if ((video.currentSrc || video.src) === nextSrc) {
        setActiveHeight(selectedLevel?.height || null);
        return;
      }

      const wasPlaying = !video.paused;
      const resumeTime = video.currentTime;
      const shouldRestoreTime = !isLive && Number.isFinite(resumeTime) && resumeTime > 0;

      setError(null);
      showBufferingImmediately();
      setLoadingMessage('Mengganti resolusi...');
      setActiveHeight(selectedLevel?.height || null);

      if (shouldRestoreTime) {
        video.addEventListener('loadedmetadata', () => {
          try {
            video.currentTime = resumeTime;
          } catch (err) {
            console.warn('Failed to restore playback position after quality switch:', err);
          }
        }, { once: true });
      }

      video.src = nextSrc;
      video.load();

      if (wasPlaying) {
        video.play().then(() => {
          setIsPlaying(true);
        }).catch(err => {
          console.warn('iOS quality switch play failed:', err);
          setIsPlaying(false);
          hideBuffering();
        });
      }

      return;
    }

    if (hlsRef.current) {
      // -1 = auto ABR mode in Hls.js
      if (levelIdx === 'auto') {
        hlsRef.current.currentLevel = -1;
        hlsRef.current.nextAutoLevel = -1;
      } else {
        hlsRef.current.currentLevel = levelIdx as number;
        hlsRef.current.nextLevel = levelIdx as number;
      }
    } else if (playerRef.current) {
      if (levelIdx === 'auto') {
        // True auto: re-enable ABR and let it manage quality based on real bandwidth
        playerRef.current.configure({
          abr: {
            enabled: true,
            switchInterval: 8
          }
        });
        console.log('Quality: Auto ABR enabled');
      } else {
        // Forced quality: restrict ABR to only tracks at or below the selected height
        // This allows ABR to still manage bandwidth but caps the max resolution
        const selectedHeight = levelIdx as number;
        const tracks = playerRef.current.getVariantTracks();

        // Find track that exactly matches selected height
        const matchTrack = tracks.find(t => t.height === selectedHeight);
        if (matchTrack) {
          // Keep ABR enabled but lock to selected track - ABR can still downgrade if needed
          playerRef.current.configure({ abr: { enabled: false } });
          playerRef.current.selectVariantTrack(matchTrack, /* clearBuffer= */ false);
          console.log(`Quality: Locked to ${selectedHeight}p (ABR disabled, manual lock)`);
        }
      }
    }
  };

  if (servers.length === 0) {
    return (
      <div className="aspect-video bg-zinc-950/85 backdrop-blur-xl border border-white/5 rounded-[1.5rem] sm:rounded-3xl flex flex-col items-center justify-center p-6 text-center select-none space-y-4 relative overflow-hidden">
        <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-netflix-red/5 rounded-full blur-3xl pointer-events-none" />
        <AlertTriangle className="text-netflix-red" size={44} />
        <h4 className="text-sm sm:text-base font-black uppercase font-display text-white">Siaran Tidak Didukung di iOS</h4>
        <p className="text-zinc-400 text-[10px] sm:text-xs font-bold max-w-xs sm:max-w-sm leading-relaxed">
          Pertandingan ini hanya tersedia dalam format DASH/DRM yang tidak didukung oleh perangkat Apple iOS (Safari).
          Silakan coba tonton menggunakan perangkat Android atau Laptop/PC.
        </p>
      </div>
    );
  }

  if (!currentServer) return null;

  // ── Iframe mode (Xoilac / embedded player) ─────────────────────────────
  if (currentServer.type === 'iframe') {
    const iframeIsFullscreen = isFullscreen || isIframeCssFullscreen;
    const iframeContainerStyle: React.CSSProperties = isIframeCssFullscreen
      ? {
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100dvh',
        maxWidth: 'none',
        maxHeight: 'none',
        borderRadius: 0,
        zIndex: 2147483647,
        backgroundColor: '#000',
      }
      : { aspectRatio: '16/9' };
    const iframeChromeClass = !iframeIsFullscreen || showIframeChrome
      ? 'opacity-100 translate-y-0'
      : 'opacity-0 translate-y-1';

    return (
      <div className="flex flex-col gap-3 w-full">
        <div
          ref={containerRef}
          className={`relative w-full overflow-hidden bg-black ${iframeIsFullscreen ? 'rounded-none' : 'rounded-2xl'}`}
          style={iframeContainerStyle}
          tabIndex={0}
          onMouseMove={revealIframeChrome}
          onTouchStart={revealIframeChrome}
          onFocus={revealIframeChrome}
        >
          <iframe
            key={currentServer.url}
            src={currentServer.url}
            className="absolute inset-0 w-full h-full border-0"
            allow="autoplay; encrypted-media; picture-in-picture"
            sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
            referrerPolicy="no-referrer"
            scrolling="no"
            title="YKN TV Live Stream"
          />

          <div
            className={`absolute top-3 right-3 z-20 pointer-events-none select-none transition-all duration-300 ${iframeChromeClass}`}
          >
            <div className="flex items-baseline gap-[3px] drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
              <span
                className="text-xl font-black leading-none text-white sm:text-3xl"
                style={{ fontFamily: "'Arial Black', Arial, sans-serif", letterSpacing: 0 }}
              >
                YKN
              </span>
              <span
                className="text-xl font-black leading-none sm:text-3xl"
                style={{ fontFamily: "'Arial Black', Arial, sans-serif", color: '#D4AF37', letterSpacing: 0 }}
              >
                TV
              </span>
            </div>
          </div>

          <button
            onMouseMove={revealIframeChrome}
            onTouchStart={revealIframeChrome}
            onClick={toggleIframeFullscreen}
            className={`absolute bottom-3 right-3 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/65 text-white shadow-2xl backdrop-blur-md transition-all duration-300 hover:bg-white/15 active:scale-95 tv-focusable ${iframeChromeClass}`}
            title={iframeIsFullscreen ? 'Keluar fullscreen YKN TV' : 'Fullscreen YKN TV'}
            tabIndex={0}
          >
            {iframeIsFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>

        {servers.length > 1 && (
          <div className="mx-4 flex flex-col md:flex-row md:items-center gap-4 p-4 bg-[#080808]/40 border border-white/5 rounded-2xl sm:mx-0">
            <div className="flex items-center gap-2 pr-4 md:border-r border-white/5 select-none shrink-0">
              <Server size={16} className="text-primary" />
              <span className="text-xs font-black uppercase tracking-wider">Pilih Server</span>
            </div>
            <div className="flex flex-wrap gap-2 flex-1">
              {servers.map((server, index) => (
                <button
                  key={`${server.url}-${index}`}
                  onClick={() => setCurrentServer(server)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer tv-focusable ${currentServer.url === server.url
                    ? 'bg-primary text-dark shadow-md'
                    : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/5'
                    }`}
                  tabIndex={0}
                >
                  Server {index + 1}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const proxyFallbackServer = getProxyFallbackServer();
  const currentQualityLabel = currentLevel === 'auto'
    ? `Auto${activeHeight ? ` ${activeHeight}p` : ''}`
    : levels.find(level => level.index === currentLevel)?.label || 'Auto';
  const usesCSSFullscreen = (!useIOSNativePlayer && isFullscreen) || isIOSCssFullscreenFallback;
  const iosFullscreenStyle: React.CSSProperties | undefined = useIOSNativePlayer && isIOSCssFullscreenFallback
    ? {
      position: 'fixed',
      top: `${iosFullscreenViewport.top}px`,
      left: `${iosFullscreenViewport.left}px`,
      width: iosFullscreenViewport.width ? `${iosFullscreenViewport.width}px` : '100vw',
      height: iosFullscreenViewport.height ? `${iosFullscreenViewport.height}px` : '100dvh',
      maxWidth: 'none',
      maxHeight: 'none',
      borderRadius: 0,
      zIndex: 2147483647,
      backgroundColor: '#000',
      transform: 'translate3d(0, 0, 0)',
      WebkitTransform: 'translate3d(0, 0, 0)',
      touchAction: 'none',
    }
    : undefined;

  return (
    <div className="space-y-6">
      <div
        ref={containerRef}
        className={`relative bg-black group shadow-2xl flex items-center justify-center overflow-hidden transition-all duration-300 tv-focusable ${usesCSSFullscreen
          ? 'fixed inset-0 w-screen h-screen h-[100dvh] rounded-none ring-0 border-none z-[2147483647]'
          : 'aspect-video rounded-[1.5rem] border border-white/5 ring-1 ring-white/5 sm:rounded-[2rem]'
          } ${!useIOSNativePlayer && !showControls ? 'cursor-none' : ''}`}
        style={iosFullscreenStyle}
        tabIndex={0}
        onKeyDown={(e) => {
          if (useIOSNativePlayer) return;

          // Only trigger if TV mode is active (body class exists)
          if (!document.body.classList.contains('tv-mode-active')) return;

          switch (e.key) {
            case 'ArrowUp':
              e.preventDefault();
              e.stopPropagation();
              setVolume((prev) => {
                const next = Math.min(prev + 0.1, 1);
                if (videoRef.current) {
                  videoRef.current.volume = next;
                  videoRef.current.muted = next === 0;
                  setIsMuted(next === 0);
                }
                return next;
              });
              setShowControls(true);
              break;
            case 'ArrowDown':
              e.preventDefault();
              e.stopPropagation();
              setVolume((prev) => {
                const next = Math.max(prev - 0.1, 0);
                if (videoRef.current) {
                  videoRef.current.volume = next;
                  videoRef.current.muted = next === 0;
                  setIsMuted(next === 0);
                }
                return next;
              });
              setShowControls(true);
              break;
            case 'ArrowLeft':
              if (!isLive) {
                e.preventDefault();
                e.stopPropagation();
                if (videoRef.current) {
                  videoRef.current.currentTime = Math.max(videoRef.current.currentTime - 10, 0);
                }
                setShowControls(true);
              }
              break;
            case 'ArrowRight':
              if (!isLive) {
                e.preventDefault();
                e.stopPropagation();
                if (videoRef.current) {
                  videoRef.current.currentTime = Math.min(videoRef.current.currentTime + 10, duration);
                }
                setShowControls(true);
              }
              break;
            case 'Enter':
            case ' ':
              e.preventDefault();
              e.stopPropagation();
              togglePlay();
              break;
          }
        }}
      >
        <video
          ref={videoRef}
          className={`w-full h-full object-contain ${useIOSNativePlayer || showControls ? 'cursor-pointer' : 'cursor-none'}`}
          preload={useIOSNativePlayer ? 'auto' : 'metadata'}
          playsInline
          controls={useIOSNativePlayer ? isIOSNativeFullscreen : false}
          onPlay={() => {
            setIsPlaying(true);
            setHasStarted(true);
          }}
          onPause={() => setIsPlaying(false)}
          onWaiting={() => {
            showBufferingWithDelay();
          }}
          onPlaying={confirmPlaybackReady}
          onCanPlay={() => {
            setLoadingMessage('Siaran hampir siap...');
            hideBuffering();
            if (useIOSNativePlayer) {
              setIsBooting(false);
              if (videoRef.current?.videoHeight) {
                setActiveHeight(videoRef.current.videoHeight);
              }
            }
          }}
          onSeeked={hideBuffering}
          onStalled={() => {
            showBufferingWithDelay();
          }}
          onSeeking={() => {
            showBufferingWithDelay();
          }}
          onLoadStart={() => {
            if (isBooting || !playbackConfirmedRef.current) {
              showBufferingImmediately();
            } else {
              showBufferingWithDelay();
            }
          }}
          onError={handleNativeVideoError}
          onTimeUpdate={handleTimeUpdate}
        />

        {useIOSNativePlayer && (
          <>
            <GlobalAnnouncement onlyShowWhenFullscreen={true} isFullscreen={isFullscreen} />

            <div
              className={`absolute inset-0 z-10 pointer-events-none bg-gradient-to-t from-black/80 via-transparent to-black/55 transition-opacity duration-300 ${showControls || showQualityMenu || !isPlaying ? 'opacity-100' : 'opacity-0'
                }`}
            />

            <div
              className={`absolute inset-x-0 top-0 z-30 px-3 pt-[calc(env(safe-area-inset-top)+12px)] sm:px-5 sm:pt-5 transition-all duration-300 select-none ${showControls || showQualityMenu || !isPlaying
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 -translate-y-2 pointer-events-none'
                }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex items-center gap-2 drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)]">
                  <div className="flex items-baseline gap-[2px] shrink-0">
                    <span className="text-lg sm:text-xl font-black leading-none text-white font-display">YKN</span>
                    <span className="text-lg sm:text-xl font-black leading-none text-primary font-display">TV</span>
                  </div>
                  <span className="h-4 w-px bg-white/25 shrink-0" />
                  <span className="truncate text-[10px] sm:text-xs font-black uppercase tracking-wider text-white/85">
                    {getPublicServerName(currentServer)}
                  </span>
                </div>
              </div>
            </div>

            {(isBooting || isBuffering) && !error && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/25 pointer-events-none select-none">
                <div className="w-11 h-11 border-[3px] border-white/80 border-t-transparent rounded-full animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-widest text-white/85">{loadingMessage || 'Memuat siaran...'}</p>
              </div>
            )}

            {(!isPlaying || showControls) && !isBuffering && !error && (
              <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none select-none">
                <button
                  onClick={togglePlay}
                  className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-black/55 border border-white/20 backdrop-blur-md text-white flex items-center justify-center shadow-2xl active:scale-95 transition-transform pointer-events-auto"
                >
                  {isPlaying ? <Pause size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" className="ml-1" />}
                </button>
              </div>
            )}

            <div
              className={`absolute inset-x-0 bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-16 sm:px-5 sm:pb-5 bg-gradient-to-t from-black/90 via-black/45 to-transparent transition-all duration-300 select-none ${showControls || showQualityMenu || !isPlaying
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-2 pointer-events-none'
                }`}
              onClick={(e) => e.stopPropagation()}
            >
              {!isLive ? (
                <div
                  onClick={handleSeek}
                  className="w-full h-6 flex items-center cursor-pointer group/progress"
                >
                  <div className="w-full h-1 bg-white/25 rounded-full relative overflow-hidden group-active/progress:h-1.5 transition-all">
                    <div
                      className="h-full bg-red-600 rounded-full"
                      style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="w-full h-6 flex items-center">
                  <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                    <div className={`h-full ${isAtLiveEdge ? 'bg-red-600' : 'bg-white/45'} rounded-full`} style={{ width: '100%' }} />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    onClick={togglePlay}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white bg-white/10 active:bg-white/20 transition-colors shrink-0"
                  >
                    {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                  </button>

                  {isLive ? (
                    <button
                      onClick={seekToLiveEdge}
                      className={`h-8 px-2.5 rounded-full flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider transition-colors shrink-0 ${isAtLiveEdge
                        ? 'text-white bg-red-600'
                        : 'text-zinc-200 bg-white/10 active:bg-white/20'
                        }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {isAtLiveEdge ? 'LIVE' : 'SYNC'}
                    </button>
                  ) : (
                    <div className="text-[11px] sm:text-xs font-bold text-white/85 font-mono whitespace-nowrap">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {levels.length > 1 && (
                    <div className="relative">
                      <button
                        onClick={() => {
                          setShowControls(true);
                          setShowQualityMenu(!showQualityMenu);
                        }}
                        className="h-9 px-2.5 rounded-full bg-white/10 active:bg-white/20 text-white flex items-center gap-1.5 text-[10px] font-black transition-colors"
                      >
                        <Settings size={15} className={showQualityMenu ? 'rotate-45 transition-transform' : 'transition-transform'} />
                        <span className="max-w-16 truncate">{currentQualityLabel}</span>
                      </button>

                      {showQualityMenu && (
                        <div className="absolute bottom-11 right-0 w-28 bg-[#080808]/95 border border-white/15 backdrop-blur-md rounded-lg p-1 shadow-2xl flex flex-col gap-0.5">
                          {levels.map((level) => (
                            <button
                              key={level.index}
                              onClick={() => handleLevelChange(level.index)}
                              className={`w-full py-2 px-2 text-left rounded-md text-[10px] font-black uppercase tracking-wider transition-colors ${currentLevel === level.index
                                ? 'bg-white text-black'
                                : 'text-zinc-300 active:bg-white/15'
                                }`}
                            >
                              {level.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={toggleFullscreen}
                    className="w-9 h-9 rounded-full bg-white/10 active:bg-white/20 text-white flex items-center justify-center transition-colors"
                  >
                    {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {!useIOSNativePlayer && (
          <>
            <GlobalAnnouncement onlyShowWhenFullscreen={true} isFullscreen={isFullscreen} />

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

            <div
              className={`absolute bottom-2 left-2 right-2 sm:bottom-4 sm:left-4 sm:right-4 bg-black/60 backdrop-blur-md border border-white/10 flex flex-col justify-end p-2.5 sm:p-3.5 rounded-2xl sm:rounded-[1.5rem] transition-all duration-300 z-30 shadow-2xl ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
                }`}
            >
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

              <div className="flex items-center justify-between gap-2 select-none">
                <div className="flex items-center gap-2 sm:gap-3.5">
                  <button
                    onClick={() => togglePlay()}
                    className="w-7.5 h-7.5 sm:w-8 sm:h-8 bg-primary hover:bg-primary/95 text-black rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary/10 cursor-pointer shrink-0 tv-focusable"
                    tabIndex={0}
                  >
                    {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" className="ml-0.5" />}
                  </button>

                  <div className="flex items-center gap-1 group/volume relative">
                    <button
                      onClick={toggleMute}
                      className="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0 tv-focusable rounded-lg"
                      tabIndex={0}
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

                  {isLive ? (
                    <button
                      onClick={seekToLiveEdge}
                      className={`flex items-center gap-1 py-0.5 px-2 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-wider select-none transition-all cursor-pointer tv-focusable ${isAtLiveEdge
                        ? 'bg-red-500/20 border border-red-400/50 text-red-400 shadow-[0_0_10px_rgba(248,113,113,0.35)] animate-pulse'
                        : 'bg-zinc-800/80 border border-zinc-700 text-zinc-400 hover:bg-red-500/15 hover:text-red-400 hover:border-red-400/40'
                        }`}
                      title={isAtLiveEdge ? "Siaran sinkron dengan Live" : "Siaran tertunda. Klik untuk sinkronisasi ulang ke Live"}
                      tabIndex={0}
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
                      className="p-1 text-zinc-400 hover:text-white transition-all hover:bg-white/5 rounded-lg border border-white/5 cursor-pointer tv-focusable"
                      title="Picture-in-Picture"
                      tabIndex={0}
                    >
                      <PictureInPicture2 size={14} />
                    </button>
                  )}

                  {levels.length > 1 && (
                    <div className="relative">
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowQualityMenu(!showQualityMenu); }}
                        className="flex items-center gap-0.5 px-2 py-0.5 sm:py-1 bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/10 rounded-lg text-[9px] sm:text-[10px] font-black text-zinc-300 hover:text-white transition-all cursor-pointer tv-focusable"
                        tabIndex={0}
                      >
                        <Settings size={10} className={showQualityMenu ? 'rotate-45' : ''} />
                        {currentQualityLabel}
                      </button>
                      {showQualityMenu && (
                        <div className="absolute bottom-9 right-0 bg-[#080808]/95 backdrop-blur-md border border-white/10 rounded-xl p-1 w-20 sm:w-24 shadow-2xl flex flex-col gap-0.5 z-50">
                          {levels.map((level) => (
                            <button
                              key={level.index}
                              onClick={() => handleLevelChange(level.index)}
                              className={`w-full py-1 px-1.5 text-left rounded-md text-[8px] sm:text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer tv-focusable ${currentLevel === level.index
                                ? 'bg-primary text-dark font-black shadow-md'
                                : 'text-zinc-400 hover:text-white hover:bg-white/5'
                                }`}
                              tabIndex={0}
                            >
                              {level.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={toggleFullscreen}
                    className="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer animate-none tv-focusable rounded-lg"
                    tabIndex={0}
                  >
                    {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  </button>
                </div>
              </div>
            </div>

            {(isBooting || isBuffering) && !error && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-20 select-none pointer-events-none">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(212,175,55,0.2)]" />
                <p className="text-[10px] font-black uppercase tracking-widest text-primary animate-pulse">{loadingMessage || 'Memuat Aliran...'}</p>
              </div>
            )}

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
                    <span>{getPublicServerName(currentServer)}</span>
                  </div>
                </div>
              </div>
            )}

            {hasStarted && !isPlaying && !error && !isBuffering && (
              <div
                className="absolute inset-0 bg-black/40 z-10 cursor-pointer"
                onClick={togglePlay}
              />
            )}

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
          </>
        )}

        {error && !isBooting && (
          <div className="absolute inset-0 bg-[#020202]/95 backdrop-blur-md z-30 flex flex-col items-center justify-center p-8 text-center select-none animate-in fade-in duration-300">
            <AlertTriangle className="text-netflix-red mb-4 shadow-lg" size={44} />
            <h4 className="text-lg font-black uppercase font-display mb-1.5">Gangguan Koneksi Siaran</h4>
            <p className="text-zinc-500 text-xs font-bold mb-6 max-w-xs leading-relaxed">{error}</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
              {proxyFallbackServer && (
                <button
                  onClick={() => selectServer(proxyFallbackServer)}
                  className="px-5 py-3 bg-primary text-dark font-black rounded-xl flex items-center gap-2 hover:scale-102 transition-transform cursor-pointer text-xs uppercase tracking-wider shadow"
                >
                  <Server size={14} />
                  Coba Server Proxy
                </button>
              )}
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-3 bg-white/10 text-white font-black rounded-xl flex items-center gap-2 hover:bg-white/15 transition-colors cursor-pointer text-xs uppercase tracking-wider shadow"
              >
                <RefreshCcw size={14} />
                Segarkan Koneksi
              </button>
            </div>
          </div>
        )}
      </div>

      {servers.length > 1 && (
        <div className="mx-4 flex flex-col md:flex-row md:items-center gap-4 p-4 bg-[#080808]/40 border border-white/5 rounded-2xl sm:mx-0">
          <div className="flex items-center gap-2 pr-4 md:border-r border-white/5 select-none shrink-0">
            <Server size={16} className="text-primary" />
            <span className="text-xs font-black uppercase tracking-wider">Pilih Server</span>
          </div>

          <div className="flex flex-wrap gap-2 flex-1">
            {servers.map((server, index) => (
              <button
                key={`${server.url}-${index}`}
                onClick={() => selectServer(server)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all relative overflow-hidden group cursor-pointer tv-focusable ${currentServer.url === server.url && currentServer.forceProxy === server.forceProxy
                  ? 'bg-primary text-dark shadow-md'
                  : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/5'
                  }`}
                tabIndex={0}
              >
                <span className="relative z-10">Server {index + 1}</span>

                {(server.forceProxy || server.keyId || server.keys || server.url.includes('|')) && (
                  <Shield size={9} className="absolute top-0.5 right-0.5 opacity-40 shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
