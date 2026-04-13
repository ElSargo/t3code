import { describe, expect, it } from "vitest";

import {
  applyDesktopNavigationTarget,
  findDesktopNavigationTargetInArgv,
  parseDesktopNavigationTarget,
} from "./deepLink";

describe("parseDesktopNavigationTarget", () => {
  it("maps thread deep links to a hash route", () => {
    expect(
      parseDesktopNavigationTarget(
        "t3://thread/environment-123/thread-456",
        "t3",
      ),
    ).toEqual({
      hash: "#/environment-123/thread-456",
    });
  });

  it("accepts app deep links that already contain a hash route", () => {
    expect(parseDesktopNavigationTarget("t3://app#/environment-123/thread-456", "t3")).toEqual({
      hash: "#/environment-123/thread-456",
    });
  });

  it("accepts app deep links with query params", () => {
    expect(
      parseDesktopNavigationTarget(
        "t3://app?environmentId=environment-123&threadId=thread-456",
        "t3",
      ),
    ).toEqual({
      hash: "#/environment-123/thread-456",
    });
  });

  it("falls back to the root route when the app deep link has no route", () => {
    expect(parseDesktopNavigationTarget("t3://app", "t3")).toEqual({
      hash: "#/",
    });
  });

  it("rejects invalid schemes and malformed thread links", () => {
    expect(parseDesktopNavigationTarget("https://example.com", "t3")).toBeNull();
    expect(parseDesktopNavigationTarget("t3://thread/environment-only", "t3")).toBeNull();
  });
});

describe("findDesktopNavigationTargetInArgv", () => {
  it("returns the last matching deep link from argv", () => {
    expect(
      findDesktopNavigationTargetInArgv(
        [
          "/usr/bin/electron",
          "/repo/apps/desktop/dist-electron/main.js",
          "--inspect",
          "t3://thread/environment-123/thread-123",
          "t3://thread/environment-456/thread-456",
        ],
        "t3",
      ),
    ).toEqual({
      hash: "#/environment-456/thread-456",
    });
  });

  it("returns null when argv has no deep link", () => {
    expect(findDesktopNavigationTargetInArgv(["/usr/bin/electron"], "t3")).toBeNull();
  });
});

describe("applyDesktopNavigationTarget", () => {
  it("adds the route hash to production and development base urls", () => {
    const target = { hash: "#/environment-123/thread-456" };

    expect(applyDesktopNavigationTarget("t3://app", target)).toBe(
      "t3://app/#/environment-123/thread-456",
    );
    expect(applyDesktopNavigationTarget("http://127.0.0.1:3773", target)).toBe(
      "http://127.0.0.1:3773/#/environment-123/thread-456",
    );
  });
});
