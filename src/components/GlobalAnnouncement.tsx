import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, AlertTriangle, CheckCircle2, X, Bell, ShieldAlert } from 'lucide-react';
import { supabase } from '../services/supabase';
import yknwcLogo from '../assets/yknwc-logo.png';

interface GlobalAnnouncementProps {
  onlyShowWhenNormal?: boolean;
  onlyShowWhenFullscreen?: boolean;
  isFullscreen?: boolean; // Optional, can be passed by parent or auto-detected
}

interface AnnouncementData {
  message: string;
  type: string;
  duration: number;
  updated_at: string;
}

// ─── Shared Supabase Channel Singleton ──────────────────────────────────────
// Supabase closes duplicate channel subscriptions with the same name.
// This module-level singleton ensures only ONE real channel exists.
// All GlobalAnnouncement instances register as in-memory listeners.
// ─────────────────────────────────────────────────────────────────────────────
// let _sharedChannel: any = null;
// let _channelSubscriberCount = 0;
// const _channelListeners = new Set<(event: string, data: any) => void>();

// function _registerChannelListener(listener: (event: string, data: any) => void) {
//   _channelListeners.add(listener);
//   _channelSubscriberCount++;

//   if (!_sharedChannel) {
//     _sharedChannel = supabase.channel('ykn-global-announcements');
//     _sharedChannel
//       .on('broadcast', { event: 'new-announcement' }, (payload: any) => {
//         _channelListeners.forEach(cb => cb('new-announcement', payload.payload));
//       })
//       .on('broadcast', { event: 'clear-announcement' }, () => {
//         _channelListeners.forEach(cb => cb('clear-announcement', null));
//       })
//       .subscribe((status: string) => {
//         console.log('GlobalAnnouncement [shared channel]:', status);
//       });
//   }

//   return () => {
//     _channelListeners.delete(listener);
//     _channelSubscriberCount--;
//     if (_channelSubscriberCount === 0 && _sharedChannel) {
//       _sharedChannel.unsubscribe();
//       _sharedChannel = null;
//     }
//   };
// }
// ───────────────────────────────────────────────────────────────────────────── p


const GlobalAnnouncement: React.FC<GlobalAnnouncementProps> = ({
  onlyShowWhenNormal = false,
  onlyShowWhenFullscreen = false,
  isFullscreen: propIsFullscreen,
}) => {
  const [announcement, setAnnouncement] = useState<AnnouncementData | null>(null);
  const [visible, setVisible] = useState(false);
  const [remainingDuration, setRemainingDuration] = useState<number>(0);
  const [isFS, setIsFS] = useState(!!document.fullscreenElement);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref to always call the latest version of checkAndShowAnnouncement (avoids stale closure in broadcast listeners)
  const checkAndShowRef = useRef<(data: AnnouncementData) => void>(() => { });

  // Auto-detect fullscreen if prop is not provided
  useEffect(() => {
    if (propIsFullscreen !== undefined) {
      setIsFS(propIsFullscreen);
      return;
    }

    const handleFsChange = () => {
      setIsFS(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, [propIsFullscreen]);

  // Handle auto-dismiss timer
  const startDismissTimer = (durationInSeconds: number) => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
    }

    if (durationInSeconds <= 0) return;

    dismissTimerRef.current = setTimeout(() => {
      setVisible(false);
    }, durationInSeconds * 1000);
  };

  const checkAndShowAnnouncement = (data: AnnouncementData) => {
    console.log('GlobalAnnouncement: checkAndShowAnnouncement called with:', data);
    const closedKey = `ykn_announcement_closed_${data.updated_at}`;
    const shownKey = `ykn_announcement_shown_${data.updated_at}`;

    const isClosed = localStorage.getItem(closedKey) === 'true';
    console.log('GlobalAnnouncement: closedKey check:', closedKey, 'isClosed:', isClosed);
    if (isClosed) return;

    let initialRemaining = data.duration;

    if (data.duration > 0) {
      const shownAtStr = localStorage.getItem(shownKey);
      console.log('GlobalAnnouncement: shownKey check:', shownKey, 'shownAtStr:', shownAtStr);
      if (shownAtStr) {
        const shownAt = parseInt(shownAtStr, 10);
        if (!isNaN(shownAt)) {
          const elapsed = (Date.now() - shownAt) / 1000;
          console.log('GlobalAnnouncement: elapsed time:', elapsed, 'duration:', data.duration);
          if (elapsed >= data.duration) {
            console.log('GlobalAnnouncement: Announcement has expired. Not showing.');
            return;
          }
          initialRemaining = data.duration - elapsed;
        }
      } else {
        // Record the start time when shown for the first time
        try {
          console.log('GlobalAnnouncement: Setting shown timestamp in localStorage:', shownKey);
          localStorage.setItem(shownKey, Date.now().toString());
        } catch (e) {
          console.warn('LocalStorage shown-state write failed:', e);
        }
      }
    }

    // Cache to sessionStorage for seamless/instant transitions
    try {
      sessionStorage.setItem('ykn_current_active_announcement', JSON.stringify(data));
    } catch (e) {
      console.warn('SessionStorage write failed:', e);
    }

    console.log('GlobalAnnouncement: Displaying announcement, remaining duration:', initialRemaining);
    setAnnouncement(data);
    setRemainingDuration(initialRemaining);
    setVisible(true);

    // Clean up old announcement keys to keep localStorage clean
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('ykn_announcement_shown_') || key.startsWith('ykn_announcement_closed_'))) {
          if (!key.endsWith(data.updated_at)) {
            keysToRemove.push(key);
          }
        }
      }
      keysToRemove.forEach(k => {
        console.log('GlobalAnnouncement: Cleaning up old localStorage key:', k);
        localStorage.removeItem(k);
      });
    } catch (e) {
      console.warn('LocalStorage cleanup failed:', e);
    }

    if (initialRemaining > 0) {
      startDismissTimer(initialRemaining);
    }
  };

  // Keep ref always pointing to the latest version of checkAndShowAnnouncement
  useEffect(() => {
    checkAndShowRef.current = checkAndShowAnnouncement;
  });

  // 1. Mount-once shared channel listener registration.
  // Uses the module-level singleton so only one real Supabase channel exists
  // across all GlobalAnnouncement instances. Avoids Supabase closing duplicate channels.
  // useEffect(() => {
  //   const unregister = _registerChannelListener((event, data) => {
  //     if (event === 'new-announcement' && data) {
  //       // Use ref to always call the latest non-stale version of checkAndShowAnnouncement
  //       checkAndShowRef.current(data as AnnouncementData);
  //     } else if (event === 'clear-announcement') {
  //       sessionStorage.removeItem('ykn_current_active_announcement');
  //       setVisible(false);
  //     }
  //   });

  //   return unregister;
  // }, []);

  // 2. Active announcement polling and layout dormancy checks.
  // Responds dynamically when toggling between fullscreen and normal modes.
  useEffect(() => {
    // Determine if this instance should be active
    const isDormant =
      (onlyShowWhenFullscreen && !isFS) ||
      (onlyShowWhenNormal && isFS);

    if (isDormant) {
      // If dormant, ensure we clear state and timers
      setVisible(false);
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
      return;
    }

    const fetchActiveAnnouncement = async () => {
      // Check cache first for instant layout restoration
      try {
        const cached = sessionStorage.getItem('ykn_current_active_announcement');
        if (cached) {
          const parsed = JSON.parse(cached) as AnnouncementData;
          checkAndShowAnnouncement(parsed);
        }
      } catch (e) {
        console.warn('SessionStorage read failed:', e);
      }

      try {
        const { data, error } = await supabase
          .from('ykn_announcements')
          .select('message, type, duration, is_active, updated_at')
          .eq('id', 1)
          .single();

        if (error) {
          console.warn('Announcement fetch warning (might need to create table):', error.message);
          return;
        }

        if (data) {
          const payloadData = {
            message: data.message,
            type: data.type,
            duration: data.duration,
            updated_at: data.updated_at,
          };
          if (data.is_active) {
            checkAndShowAnnouncement(payloadData);
          } else {
            sessionStorage.removeItem('ykn_current_active_announcement');
            setVisible(false);
          }
        }
      } catch (err) {
        console.error('Error fetching announcement:', err);
      }
    };

    fetchActiveAnnouncement();

    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [onlyShowWhenFullscreen, onlyShowWhenNormal, isFS]);

  const handleClose = () => {
    if (announcement) {
      const closedKey = `ykn_announcement_closed_${announcement.updated_at}`;
      localStorage.setItem(closedKey, 'true');
    }
    setVisible(false);
  };

  // Render checks
  if (!visible || !announcement) return null;
  if (onlyShowWhenNormal && isFS) return null;
  if (onlyShowWhenFullscreen && !isFS) return null;

  // Determine colors and icons based on announcement type
  let accentColor = '#3b82f6'; // info (blue)
  let badgeText = 'PENGUMUMAN';
  let IconComponent = Info;

  switch (announcement.type) {
    case 'success':
      accentColor = '#10b981'; // green
      badgeText = 'SUKSES';
      IconComponent = CheckCircle2;
      break;
    case 'warning':
      accentColor = '#f59e0b'; // yellow
      badgeText = 'PERINGATAN';
      IconComponent = AlertTriangle;
      break;
    case 'alert':
      accentColor = '#ef4444'; // red
      badgeText = 'PERHATIAN';
      IconComponent = ShieldAlert;
      break;
    default:
      accentColor = '#3b82f6';
      badgeText = 'PENGUMUMAN';
      IconComponent = Bell;
  }



  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -80, scale: 0.95, x: '-50%' }}
          animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
          exit={{ opacity: 0, y: -80, scale: 0.95, x: '-50%' }}
          transition={{ type: 'spring', stiffness: 260, damping: 25 }}
          className={`${isFS ? 'absolute' : 'fixed'
            } top-5 left-1/2 z-[99999] w-[calc(100%-2rem)] max-w-[420px] rounded-2xl bg-zinc-950/85 backdrop-blur-xl border border-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.8)] overflow-hidden`}
          style={{ borderLeft: `4px solid ${accentColor}` }}
        >
          {/* Main Card Content */}
          <div className="p-4 flex items-start gap-3.5 pr-10 relative select-none">
            {/* Left App Icon / Avatar */}
            <div className="w-9 h-9 rounded-full bg-zinc-900 border border-primary/20 p-0.5 shrink-0 shadow-lg flex items-center justify-center">
              <img
                src={yknwcLogo}
                alt="YKN TV"
                className="w-full h-full object-contain rounded-full"
              />
            </div>

            {/* Middle Message Area */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-white font-display tracking-wide uppercase italic">YKN TV</span>
                <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider">• Sekarang</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className="text-[7.5px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border font-sans inline-flex items-center gap-1"
                  style={{ backgroundColor: `${accentColor}10`, borderColor: `${accentColor}25`, color: accentColor }}
                >
                  <IconComponent size={9} strokeWidth={3} />
                  {badgeText}
                </span>
              </div>
              <p className="text-[11.5px] font-black text-zinc-200 leading-relaxed break-words font-sans">
                {announcement.message}
              </p>
            </div>

            {/* Right Close Button */}
            <button
              onClick={handleClose}
              className="absolute top-3.5 right-3.5 w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center border border-white/5 transition-all active:scale-90 cursor-pointer"
            >
              <X size={12} strokeWidth={2.5} />
            </button>
          </div>

          {/* iOS Style Bottom Progress Dismiss Bar */}
          {announcement.duration > 0 && remainingDuration > 0 && (
            <div className="w-full h-[3px] bg-white/5 absolute bottom-0 left-0 overflow-hidden">
              <motion.div
                key={`${announcement.updated_at}_${remainingDuration}`}
                initial={{ width: `${(remainingDuration / announcement.duration) * 100}%` }}
                animate={{ width: '0%' }}
                transition={{ duration: remainingDuration, ease: 'linear' }}
                className="h-full"
                style={{ backgroundColor: accentColor }}
              />
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GlobalAnnouncement;
