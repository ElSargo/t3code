import { describe, expect, it, vi } from "vitest";

import { deprioritizeChildProcess, fixPath } from "./os-jank";

describe("fixPath", () => {
  it("hydrates PATH on linux using the resolved login shell", () => {
    const env: NodeJS.ProcessEnv = {
      SHELL: "/bin/zsh",
      PATH: "/usr/bin",
    };
    const readPath = vi.fn(() => "/opt/homebrew/bin:/usr/bin");

    fixPath({
      env,
      platform: "linux",
      readPath,
    });

    expect(readPath).toHaveBeenCalledWith("/bin/zsh");
    expect(env.PATH).toBe("/opt/homebrew/bin:/usr/bin");
  });

  it("does nothing outside macOS and linux even when SHELL is set", () => {
    const env: NodeJS.ProcessEnv = {
      SHELL: "C:/Program Files/Git/bin/bash.exe",
      PATH: "C:\\Windows\\System32",
    };
    const readPath = vi.fn(() => "/usr/local/bin:/usr/bin");

    fixPath({
      env,
      platform: "win32",
      readPath,
    });

    expect(readPath).not.toHaveBeenCalled();
    expect(env.PATH).toBe("C:\\Windows\\System32");
  });
});

describe("deprioritizeChildProcess", () => {
  it("lowers CPU priority and requests idle IO priority on linux", () => {
    const setPriority = vi.fn();
    const spawnSync = vi.fn();

    deprioritizeChildProcess(4321, {
      platform: "linux",
      setPriority,
      spawnSync,
    });

    expect(setPriority).toHaveBeenCalledWith(4321, 19);
    expect(spawnSync).toHaveBeenCalledWith("ionice", ["-c", "3", "-p", "4321"], {
      stdio: "ignore",
    });
  });

  it("only lowers CPU priority outside linux", () => {
    const setPriority = vi.fn();
    const spawnSync = vi.fn();

    deprioritizeChildProcess(987, {
      platform: "darwin",
      setPriority,
      spawnSync,
    });

    expect(setPriority).toHaveBeenCalledWith(987, 19);
    expect(spawnSync).not.toHaveBeenCalled();
  });

  it("ignores invalid pids", () => {
    const setPriority = vi.fn();
    const spawnSync = vi.fn();

    deprioritizeChildProcess(undefined, {
      platform: "linux",
      setPriority,
      spawnSync,
    });
    deprioritizeChildProcess(0, {
      platform: "linux",
      setPriority,
      spawnSync,
    });

    expect(setPriority).not.toHaveBeenCalled();
    expect(spawnSync).not.toHaveBeenCalled();
  });

  it("swallows scheduler errors", () => {
    const setPriority = vi.fn(() => {
      throw new Error("setPriority failed");
    });
    const spawnSync = vi.fn(() => {
      throw new Error("ionice failed");
    });

    expect(() =>
      deprioritizeChildProcess(1234, {
        platform: "linux",
        setPriority,
        spawnSync,
      }),
    ).not.toThrow();
  });
});
