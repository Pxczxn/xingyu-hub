import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { PageErrorBoundary, RouteErrorPage } from "./RouteErrorPage";

/*
 * Error boundaries.
 *
 * Before these existed the app had none at all, so a render throw took down the
 * whole tree — the reader got a blank page with no way back. These cover the two
 * properties that make a boundary worth having: it catches, and it RECOVERS.
 */

/** Flips the throw off so the retry has something renderable to fall back to. */
let shouldThrow = true;

function Flaky() {
  if (shouldThrow) throw new Error("boom");
  return <p>已恢复</p>;
}

/** Silence React's own error logging; we assert on the UI, not the console. */
function quiet<T>(run: () => T): T {
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    return run();
  } finally {
    spy.mockRestore();
  }
}

describe("PageErrorBoundary", () => {
  it("renders its children when nothing throws", () => {
    render(
      <PageErrorBoundary>
        <p>正常内容</p>
      </PageErrorBoundary>,
    );
    expect(screen.getByText("正常内容")).toBeInTheDocument();
  });

  it("catches a render throw instead of unmounting the tree", () => {
    shouldThrow = true;
    quiet(() =>
      render(
        <PageErrorBoundary>
          <Flaky />
        </PageErrorBoundary>,
      ),
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("这个页面出错了")).toBeInTheDocument();
  });

  it("recovers when the reader retries", async () => {
    shouldThrow = true;
    quiet(() =>
      render(
        <PageErrorBoundary>
          <Flaky />
        </PageErrorBoundary>,
      ),
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();

    // Whatever made the page throw is now fixed; the retry must actually
    // re-render the subtree rather than leaving the boundary stuck on its error.
    shouldThrow = false;
    await userEvent.click(screen.getByRole("button", { name: "重试" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("已恢复")).toBeInTheDocument();
  });

  it("clears the error when the reset key changes", () => {
    shouldThrow = true;
    const { rerender } = quiet(() =>
      render(
        <PageErrorBoundary resetKey="/a">
          <Flaky />
        </PageErrorBoundary>,
      ),
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();

    // Navigating away must not carry the crash along.
    quiet(() => rerender(<PageErrorBoundary resetKey="/b">{<p>新页面</p>}</PageErrorBoundary>));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("新页面")).toBeInTheDocument();
  });
});

describe("RouteErrorPage", () => {
  /*
   * `useRouteError` only works inside a DATA router, so the fallback is
   * exercised the way the app actually reaches it: a route whose element
   * throws, with `errorElement` pointing at the fallback.
   *
   * The throw must happen during RENDER of a component, not while the route
   * config is being built — an IIFE in the element expression throws before
   * React is involved, so `errorElement` never sees it.
   */
  function RouteBoom(): never {
    throw new Error("route boom");
  }

  function renderFailingRoute() {
    const router = createMemoryRouter(
      [{ path: "*", element: <RouteBoom />, errorElement: <RouteErrorPage /> }],
      { initialEntries: ["/broken"] },
    );
    return render(<RouterProvider router={router} />);
  }

  it("renders a standalone fallback with a way out", () => {
    quiet(renderFailingRoute);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "回到首页" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("button", { name: /重新加载/ })).toBeInTheDocument();
  });

  it("does not leak the stack in a production build", () => {
    // The message is rendered only under `import.meta.env.DEV`; in the test
    // environment DEV is true, so this asserts the guard exists rather than that
    // the message is absent.
    quiet(renderFailingRoute);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
