import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const webRoot = process.cwd();
const devConfig = readFileSync(path.join(webRoot, "vite.config.ts"), "utf8");
const browserConfig = readFileSync(path.join(webRoot, "vite.browser-test.config.ts"), "utf8");
const packageJson = readFileSync(path.join(webRoot, "package.json"), "utf8");

describe("browser test vite entry", () => {
  it("keeps the development server on 7777 and 7779", () => {
    expect(devConfig).toContain("port: 7777");
    expect(devConfig).toContain('target: "http://127.0.0.1:7779"');
    expect(devConfig).toContain('target: "ws://127.0.0.1:7779"');
    expect(devConfig).toContain("ws: true");
    expect(devConfig).not.toContain("7781");
    expect(devConfig).not.toContain("7789");
  });

  it("points the browser test server at 7781 and 7789", () => {
    expect(browserConfig).toContain("port: 7781");
    expect(browserConfig).toContain('target: "http://127.0.0.1:7789"');
    expect(browserConfig).toContain('target: "ws://127.0.0.1:7789"');
    expect(browserConfig).toContain("ws: true");
    expect(packageJson).toContain(
      '"dev:browser-test": "vite --config vite.browser-test.config.ts --port 7781"',
    );
    expect(packageJson).toContain('"dev": "vite"');
  });
});
