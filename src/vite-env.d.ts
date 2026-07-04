/// <reference types="vite/client" />

interface Window {
  yknAdRedirect?: (forceRedirect?: boolean) => boolean;
  yknAdCanRedirect?: () => boolean;
}
