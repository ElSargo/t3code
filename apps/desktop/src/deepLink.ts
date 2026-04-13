export interface DesktopNavigationTarget {
  readonly hash: string;
}

function normalizeRouteHash(hash: string): string | null {
  const trimmed = hash.trim();
  if (trimmed.length === 0) {
    return "#/";
  }

  if (!trimmed.startsWith("#")) {
    return trimmed.startsWith("/") ? `#${trimmed}` : `#/${trimmed}`;
  }

  return trimmed.startsWith("#/") ? trimmed : `#/${trimmed.slice(1)}`;
}

function buildThreadHash(environmentId: string, threadId: string): string | null {
  const normalizedEnvironmentId = environmentId.trim();
  const normalizedThreadId = threadId.trim();
  if (normalizedEnvironmentId.length === 0 || normalizedThreadId.length === 0) {
    return null;
  }

  return `#/${encodeURIComponent(normalizedEnvironmentId)}/${encodeURIComponent(normalizedThreadId)}`;
}

export function parseDesktopNavigationTarget(
  rawUrl: string,
  scheme: string,
): DesktopNavigationTarget | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  if (parsed.protocol !== `${scheme}:`) {
    return null;
  }

  if (parsed.hostname === "thread") {
    const [environmentId, threadId] = parsed.pathname
      .split("/")
      .filter((segment) => segment.length > 0)
      .map((segment) => decodeURIComponent(segment));
    const hash = buildThreadHash(environmentId ?? "", threadId ?? "");
    return hash ? { hash } : null;
  }

  if (parsed.hostname === "app" || parsed.hostname.length === 0) {
    const environmentId = parsed.searchParams.get("environmentId")?.trim() ?? "";
    const threadId = parsed.searchParams.get("threadId")?.trim() ?? "";
    const threadHash =
      environmentId.length > 0 || threadId.length > 0
        ? buildThreadHash(environmentId, threadId)
        : null;
    const hash = threadHash ?? normalizeRouteHash(parsed.hash);
    return hash ? { hash } : null;
  }

  return null;
}

export function findDesktopNavigationTargetInArgv(
  argv: readonly string[],
  scheme: string,
): DesktopNavigationTarget | null {
  for (let index = argv.length - 1; index >= 0; index -= 1) {
    const candidate = argv[index];
    if (typeof candidate !== "string" || candidate.length === 0) {
      continue;
    }

    const target = parseDesktopNavigationTarget(candidate, scheme);
    if (target) {
      return target;
    }
  }

  return null;
}

export function applyDesktopNavigationTarget(
  baseUrl: string,
  target: DesktopNavigationTarget | null,
): string {
  if (!target) {
    return baseUrl;
  }

  const parsed = new URL(baseUrl);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:" && parsed.pathname.length === 0) {
    parsed.pathname = "/";
  }
  parsed.hash = target.hash.slice(1);
  return parsed.toString();
}
