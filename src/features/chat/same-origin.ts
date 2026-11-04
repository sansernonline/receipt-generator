const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

function parseUrl(value: string): URL | null {
  return URL.canParse(value) ? new URL(value) : null;
}

function localOrigins(host: string | null): string[] {
  const url = host ? parseUrl(`http://${host}`) : null;
  if (!url || !LOCAL_HOSTS.has(url.hostname)) return [];
  return [...LOCAL_HOSTS].map((name) => `http://${name}${url.port ? `:${url.port}` : ""}`);
}

// route handlers have no built-in CSRF check; browsers always send Origin on POST (ARCH 5.1 · NFR-SEC-040)
// Host is only trusted for 127.0.0.1/localhost; a real domain behind the proxy must be listed in the env
export function isAllowedOrigin(request: Request, env: Record<string, string | undefined> = process.env): boolean {
  const origin = parseUrl(request.headers.get("origin") ?? "")?.origin;
  if (!origin) return false;
  const listed = (env.BILLGEN_ALLOWED_ORIGINS ?? "").split(",").map((entry) => entry.trim());
  return listed.includes(origin) || localOrigins(request.headers.get("host")).includes(origin);
}
