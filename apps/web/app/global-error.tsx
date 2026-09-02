'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          alignItems: 'center',
          background: '#f6f4ef',
          color: '#171512',
          display: 'flex',
          fontFamily: 'system-ui, sans-serif',
          justifyContent: 'center',
          margin: 0,
          minHeight: '100vh',
          padding: '24px',
        }}
      >
        <main role="alert" style={{ maxWidth: '520px', textAlign: 'center' }}>
          <p style={{ color: '#a42820', fontWeight: 800 }}>NUZENIO</p>
          <h1>Nuzenio needs a fresh start</h1>
          <p>
            We could not restore this screen. Your preferences and saved stories
            remain safe.
          </p>
          <button
            onClick={retry}
            style={{
              background: '#a42820',
              border: 0,
              borderRadius: '999px',
              color: 'white',
              cursor: 'pointer',
              font: 'inherit',
              fontWeight: 700,
              minHeight: '44px',
              padding: '0 20px',
            }}
            type="button"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
