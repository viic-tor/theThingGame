import { useCallback, useEffect, useState } from 'react';

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenEnabled?: boolean;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export function isTouchMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const smallViewport = Math.min(window.innerWidth, window.innerHeight) <= 900;
  return coarse || smallViewport;
}

export function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    window.matchMedia?.('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export function isFullscreenSupported(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as FullscreenDocument;
  const el = document.documentElement as FullscreenElement;
  return Boolean(
    doc.fullscreenEnabled ||
      doc.webkitFullscreenEnabled ||
      typeof el.requestFullscreen === 'function' ||
      typeof el.webkitRequestFullscreen === 'function'
  );
}

export function getIsFullscreen(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as FullscreenDocument;
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
}

export async function enterFullscreen(): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  if (getIsFullscreen() || isStandalonePWA()) return true;

  const el = document.documentElement as FullscreenElement;
  try {
    if (typeof el.requestFullscreen === 'function') {
      await el.requestFullscreen({ navigationUI: 'hide' });
      return true;
    }
    if (typeof el.webkitRequestFullscreen === 'function') {
      await el.webkitRequestFullscreen();
      return true;
    }
  } catch {
    // Some browsers (notably iOS Safari) block JS Fullscreen API without standalone mode
  }
  return false;
}

export async function exitFullscreen(): Promise<void> {
  if (typeof document === 'undefined') return;
  const doc = document as FullscreenDocument;
  try {
    if (doc.fullscreenElement && typeof doc.exitFullscreen === 'function') {
      await doc.exitFullscreen();
    } else if (doc.webkitFullscreenElement && typeof doc.webkitExitFullscreen === 'function') {
      await doc.webkitExitFullscreen();
    }
  } catch {
    // Ignore exit errors
  }
}

export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => getIsFullscreen() || isStandalonePWA());
  const [isMobile, setIsMobile] = useState<boolean>(() => isTouchMobileDevice());
  const supported = isFullscreenSupported();
  const standalone = isStandalonePWA();
  const ios = isIOSDevice();

  useEffect(() => {
    const syncState = () => {
      setIsFullscreen(getIsFullscreen() || isStandalonePWA());
      setIsMobile(isTouchMobileDevice());
    };
    document.addEventListener('fullscreenchange', syncState);
    document.addEventListener('webkitfullscreenchange', syncState);
    window.addEventListener('resize', syncState);
    return () => {
      document.removeEventListener('fullscreenchange', syncState);
      document.removeEventListener('webkitfullscreenchange', syncState);
      window.removeEventListener('resize', syncState);
    };
  }, []);

  const toggle = useCallback(async () => {
    if (getIsFullscreen()) {
      await exitFullscreen();
    } else {
      await enterFullscreen();
    }
  }, []);

  const enterIfMobile = useCallback(async () => {
    if (isTouchMobileDevice() && !getIsFullscreen() && !isStandalonePWA()) {
      await enterFullscreen();
    }
  }, []);

  return {
    isFullscreen,
    isMobile,
    supported,
    standalone,
    ios,
    enter: enterFullscreen,
    exit: exitFullscreen,
    toggle,
    enterIfMobile,
  };
}
