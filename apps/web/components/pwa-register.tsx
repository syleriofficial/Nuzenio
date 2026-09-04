'use client';

import { useEffect } from 'react';

export function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production')
      void navigator.serviceWorker.register('/service-worker.js', {
        updateViaCache: 'none',
      });
  }, []);
  return null;
}
