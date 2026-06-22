import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// Extended TV/Smart TV User Agent detection
const TV_USER_AGENT_REGEX =
  /SmartTV|Tizen|Web0S|webOS|PlayStation|Xbox|AppleTV|Roku|Kodi|GoogleTV|AndroidTV|SHIELD|AFTB|AFTN|STB|HbbTV|DLNA|NetCast|SMART-TV|SamsungBrowser.*TV/i;

const detectTvFromUserAgent = () => TV_USER_AGENT_REGEX.test(navigator.userAgent);

export const useTvNavigation = () => {
  const navigate = useNavigate();

  const [isTvMode, setIsTvMode] = useState<boolean>(() => {
    // If user manually toggled, respect that choice
    const manual = localStorage.getItem('ykn_tv_mode_manual');
    if (manual !== null) return manual === 'true';
    // Otherwise auto-detect from User Agent
    return detectTvFromUserAgent();
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // showToast must be defined BEFORE it's used in useEffects below
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    const timer = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Sync body class + localStorage whenever isTvMode changes
  useEffect(() => {
    if (isTvMode) {
      document.body.classList.add('tv-mode-active');
    } else {
      document.body.classList.remove('tv-mode-active');
    }
  }, [isTvMode]);

  // ── D-pad auto-detection ──────────────────────────────────────────────────
  // If the user presses an arrow key while TV Mode is OFF and they haven't
  // manually disabled it, automatically enable TV Mode.
  // This is the same approach used by Netflix, YouTube TV, etc.
  // A keyboard/mouse user on PC rarely presses arrow keys to navigate a page.
  useEffect(() => {
    if (isTvMode) return; // already active — nothing to do

    const handleFirstArrow = (e: KeyboardEvent) => {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;

      // Don't auto-enable if user explicitly turned it off
      const manual = localStorage.getItem('ykn_tv_mode_manual');
      if (manual === 'false') return;

      setIsTvMode(true);
      localStorage.setItem('ykn_tv_mode_manual', 'true');
      showToast('Mode TV Terdeteksi Otomatis 📺');
    };

    window.addEventListener('keydown', handleFirstArrow);
    return () => window.removeEventListener('keydown', handleFirstArrow);
  }, [isTvMode, showToast]);

  // ── Manual toggle (from UI button) ───────────────────────────────────────
  const toggleTvMode = useCallback(() => {
    setIsTvMode((prev) => {
      const next = !prev;
      localStorage.setItem('ykn_tv_mode_manual', String(next));
      showToast(next ? 'Mode TV Aktif (Gunakan Tombol Arah & Enter)' : 'Mode TV Dinonaktifkan');
      return next;
    });
  }, [showToast]);

  // ── Spatial navigation (2D D-pad) ─────────────────────────────────────────
  const moveFocus = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    const activeEl = document.activeElement as HTMLElement;
    const candidates = Array.from(document.querySelectorAll('.tv-focusable')) as HTMLElement[];

    // Filter out invisible elements
    const visibleCandidates = candidates.filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    if (visibleCandidates.length === 0) return;

    // If nothing focused or the active element is not in our list, focus the first
    if (!activeEl || activeEl === document.body || !visibleCandidates.includes(activeEl)) {
      visibleCandidates[0].focus();
      visibleCandidates[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const activeRect = activeEl.getBoundingClientRect();
    const activeCenter = {
      x: activeRect.left + activeRect.width / 2,
      y: activeRect.top + activeRect.height / 2,
    };

    let bestCandidate: HTMLElement | null = null;
    let minScore = Infinity;

    for (const candidate of visibleCandidates) {
      if (candidate === activeEl) continue;

      const candRect = candidate.getBoundingClientRect();
      const candCenter = {
        x: candRect.left + candRect.width / 2,
        y: candRect.top + candRect.height / 2,
      };

      const dx = candCenter.x - activeCenter.x;
      const dy = candCenter.y - activeCenter.y;

      let isCorrectDirection = false;
      let primaryDist = 0;
      let secondaryDist = 0;

      switch (direction) {
        case 'left':
          isCorrectDirection = candCenter.x < activeCenter.x;
          primaryDist = activeCenter.x - candCenter.x;
          secondaryDist = Math.abs(dy);
          break;
        case 'right':
          isCorrectDirection = candCenter.x > activeCenter.x;
          primaryDist = candCenter.x - activeCenter.x;
          secondaryDist = Math.abs(dy);
          break;
        case 'up':
          isCorrectDirection = candCenter.y < activeCenter.y;
          primaryDist = activeCenter.y - candCenter.y;
          secondaryDist = Math.abs(dx);
          break;
        case 'down':
          isCorrectDirection = candCenter.y > activeCenter.y;
          primaryDist = candCenter.y - activeCenter.y;
          secondaryDist = Math.abs(dx);
          break;
      }

      if (!isCorrectDirection) continue;

      // Score: primary distance + weighted secondary distance
      // A higher weight on secondary prevents diagonal jumps
      const score = primaryDist + 4 * secondaryDist;
      if (score < minScore) {
        minScore = score;
        bestCandidate = candidate;
      }
    }

    if (bestCandidate) {
      bestCandidate.focus();
      bestCandidate.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }
  }, []);

  // ── Main keyboard handler (only active in TV Mode) ───────────────────────
  useEffect(() => {
    if (!isTvMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;

      // Let text inputs handle their own keyboard events
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.getAttribute('contenteditable') === 'true')
      ) {
        if (e.key === 'Escape') {
          (activeEl as HTMLElement).blur();
          e.preventDefault();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          moveFocus('up');
          break;
        case 'ArrowDown':
          e.preventDefault();
          moveFocus('down');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          moveFocus('left');
          break;
        case 'ArrowRight':
          e.preventDefault();
          moveFocus('right');
          break;
        case 'Enter':
        case ' ': // Space
          if (activeEl && activeEl.classList.contains('tv-focusable')) {
            e.preventDefault();
            (activeEl as HTMLElement).click();
          }
          break;
        case 'Escape':
        case 'Backspace':
        case 'GoBack':
          e.preventDefault();
          if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
            if (document.exitFullscreen) {
              document.exitFullscreen().catch((err) => console.warn(err));
            } else if ((document as any).webkitExitFullscreen) {
              (document as any).webkitExitFullscreen();
            }
          } else {
            navigate(-1);
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTvMode, moveFocus, navigate]);

  return {
    isTvMode,
    toggleTvMode,
    toastMessage,
    showToast,
  };
};
