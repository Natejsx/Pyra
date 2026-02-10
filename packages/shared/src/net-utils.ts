import os from 'node:os';
import net from 'node:net';

export interface ResolvedUrls {
  local: string;
  network: string[];
}

/**
 * Resolve local and network URLs for the dev server.
 * Only resolves network addresses when host is 0.0.0.0 or ::.
 */
export function resolveUrls(opts: {
  protocol: 'http' | 'https';
  host: string;
  port: number;
}): ResolvedUrls {
  const { protocol, host, port } = opts;

  const isDefaultPort =
    (protocol === 'http' && port === 80) ||
    (protocol === 'https' && port === 443);
  const portSuffix = isDefaultPort ? '' : `:${port}`;

  const displayHost = host === '0.0.0.0' || host === '::' ? 'localhost' : host;
  const local = `${protocol}://${displayHost}${portSuffix}/`;

  const network: string[] = [];

  if (host === '0.0.0.0' || host === '::') {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.internal) continue;
        if (iface.family !== 'IPv4') continue;
        network.push(`${protocol}://${iface.address}${portSuffix}/`);
      }
    }
  }

  return { local, network };
}

/**
 * Find an available port starting from `startPort`.
 * Tries incrementing ports up to `maxAttempts` times.
 */
export function findAvailablePort(
  startPort: number,
  maxAttempts = 20,
): Promise<number> {
  return new Promise((resolve, reject) => {
    let attempt = 0;

    function tryPort(port: number): void {
      if (attempt >= maxAttempts) {
        reject(new Error(`No available port found (tried ${startPort}-${startPort + maxAttempts - 1})`));
        return;
      }

      attempt++;
      const server = net.createServer();

      server.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          tryPort(port + 1);
        } else {
          reject(err);
        }
      });

      server.once('listening', () => {
        server.close(() => resolve(port));
      });

      server.listen(port);
    }

    tryPort(startPort);
  });
}
