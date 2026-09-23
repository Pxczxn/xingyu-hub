import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiTokenSecretPanel } from "./ApiTokenSecretPanel";

/*
 * The one-time secret panel (Phase 2A-2b) — the security-critical surface.
 *
 * The value used here is an obvious fake, never a real credential.
 */

const FAKE_SECRET = "xy_FAKE_0000000000000000000000000000000000000000000000000000000000";

let writeText: ReturnType<typeof vi.fn>;

function stubClipboard(impl?: () => Promise<void>) {
  writeText = vi.fn(impl ?? (async () => {}));
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  stubClipboard();
});

afterEach(() => {
  vi.restoreAllMocks();
  // @ts-expect-error – drop the stub so later suites see the jsdom default.
  delete navigator.clipboard;
});

describe("ApiTokenSecretPanel — display", () => {
  it("shows the token name and the FULL secret (never truncated)", () => {
    render(<ApiTokenSecretPanel name="CI 同步" secret={FAKE_SECRET} onDismiss={() => {}} />);

    expect(screen.getByTestId("api-token-secret-name")).toHaveTextContent("CI 同步");
    // The whole value must be present so it can be selected and copied by hand.
    expect(screen.getByTestId("api-token-secret-value")).toHaveTextContent(FAKE_SECRET);
  });

  it("tells the user the token is shown only once", () => {
    render(<ApiTokenSecretPanel name="CI" secret={FAKE_SECRET} onDismiss={() => {}} />);

    expect(screen.getByText(/仅显示一次/)).toBeInTheDocument();
  });

  it("keeps the secret out of any browser storage", () => {
    render(<ApiTokenSecretPanel name="CI" secret={FAKE_SECRET} onDismiss={() => {}} />);

    expect(JSON.stringify(localStorage)).not.toContain(FAKE_SECRET);
    expect(JSON.stringify(sessionStorage)).not.toContain(FAKE_SECRET);
  });
});

describe("ApiTokenSecretPanel — copy", () => {
  it("copies the exact secret and confirms it", async () => {
    render(<ApiTokenSecretPanel name="CI" secret={FAKE_SECRET} onDismiss={() => {}} />);

    await userEvent.click(screen.getByTestId("api-token-copy"));

    expect(writeText).toHaveBeenCalledWith(FAKE_SECRET);
    expect(screen.getByTestId("api-token-copy-status")).toHaveTextContent("已复制");
  });

  it("surfaces a clipboard failure instead of pretending it worked", async () => {
    stubClipboard(async () => {
      throw new Error("denied");
    });
    render(<ApiTokenSecretPanel name="CI" secret={FAKE_SECRET} onDismiss={() => {}} />);

    await userEvent.click(screen.getByTestId("api-token-copy"));

    expect(screen.getByTestId("api-token-copy-status")).toHaveTextContent("复制失败");
  });

  it("still copies the real value while the secret is visually masked", async () => {
    render(<ApiTokenSecretPanel name="CI" secret={FAKE_SECRET} onDismiss={() => {}} />);

    await userEvent.click(screen.getByTestId("api-token-toggle-visibility"));
    expect(screen.getByTestId("api-token-secret-value")).not.toHaveTextContent(FAKE_SECRET);

    await userEvent.click(screen.getByTestId("api-token-copy"));
    expect(writeText).toHaveBeenCalledWith(FAKE_SECRET);
  });
});

describe("ApiTokenSecretPanel — dismiss", () => {
  it("reports the dismiss so the parent can drop the secret", async () => {
    const onDismiss = vi.fn();
    render(<ApiTokenSecretPanel name="CI" secret={FAKE_SECRET} onDismiss={onDismiss} />);

    await userEvent.click(screen.getByTestId("api-token-dismiss"));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
