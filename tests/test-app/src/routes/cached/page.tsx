// SSR page with CacheConfig — served dynamically but with cache headers
export const cache = {
  maxAge: 3600,
  sMaxAge: 7200,
  staleWhileRevalidate: 300,
};

export default function Cached() {
  return (
    <div>
      <h1>Cached Page</h1>
      <p>This page is SSR but has cache headers.</p>
      <p>Rendered at: {new Date().toISOString()}</p>
    </div>
  );
}
