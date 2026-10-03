import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { NotificationToastProvider } from "./NotificationToastProvider";
import { NotificationToaster } from "./NotificationToaster";
import { useNotificationToasts } from "./notification-toast.context";
import {
  NOTIFICATION_TOAST_EXIT_MS,
  NOTIFICATION_TOAST_MAX,
  toastCategoryVisual,
  type NotificationToastInput,
} from "./notification-toast.types";

/*
 * The floating notification stack.
 *
 * These cover the four things a toast stack actually has to get right, and that
 * a screenshot cannot show: the stack is bounded, dismissal really removes the
 * node (not just hides it), a click target navigates, and the whole thing
 * degrades to a no-op instead of throwing when no provider is mounted.
 */

function Harness({ inputs }: { inputs: NotificationToastInput[] }) {
  const { push, dismissAll } = useNotificationToasts();
  return (
    <>
      <button
        type="button"
        onClick={() => {
          for (const input of inputs) push(input);
        }}
      >
        全部推送
      </button>
      <button type="button" onClick={dismissAll}>
        全部关闭
      </button>
      <NotificationToaster />
    </>
  );
}

function renderStack(inputs: NotificationToastInput[]) {
  return render(
    <MemoryRouter>
      <NotificationToastProvider>
        <Harness inputs={inputs} />
      </NotificationToastProvider>
    </MemoryRouter>,
  );
}

const one = (overrides: Partial<NotificationToastInput> = {}): NotificationToastInput => ({
  category: "FOLLOW",
  title: "有人关注了你",
  body: "series_probe 关注了你",
  ...overrides,
});

describe("toastCategoryVisual", () => {
  it("maps the known categories", () => {
    expect(toastCategoryVisual("FOLLOW").label).toBe("关注");
    expect(toastCategoryVisual("MESSAGE").label).toBe("私信");
  });

  it("tolerates case and surrounding whitespace from the backend", () => {
    expect(toastCategoryVisual(" follow ").label).toBe("关注");
    expect(toastCategoryVisual("Like").label).toBe("点赞");
  });

  it("falls back instead of dropping an unknown category", () => {
    // The backend's only producer today is FOLLOW, so an unknown value is the
    // likely case, not an edge case. It must render, not disappear.
    expect(toastCategoryVisual("SOMETHING_NEW").label).toBe("通知");
    expect(toastCategoryVisual("").label).toBe("通知");
  });
});

describe("NotificationToaster", () => {
  it("renders nothing until something is pushed", () => {
    renderStack([one()]);
    expect(screen.queryByText("有人关注了你")).not.toBeInTheDocument();
  });

  it("raises a toast with its title and body", async () => {
    renderStack([one()]);
    await userEvent.click(screen.getByRole("button", { name: "全部推送" }));

    expect(await screen.findByText("有人关注了你")).toBeInTheDocument();
    expect(screen.getByText("series_probe 关注了你")).toBeInTheDocument();
  });

  it("announces the category to screen readers, not only by colour", async () => {
    renderStack([one()]);
    await userEvent.click(screen.getByRole("button", { name: "全部推送" }));

    // The glyph is decorative; the label is the accessible carrier of "关注".
    expect(await screen.findByText("关注：")).toBeInTheDocument();
  });

  it("caps the stack and evicts the oldest toast", async () => {
    const inputs = Array.from({ length: NOTIFICATION_TOAST_MAX + 2 }, (_, index) =>
      one({ title: `通知 ${index + 1}` }),
    );
    renderStack(inputs);
    await userEvent.click(screen.getByRole("button", { name: "全部推送" }));

    // The two oldest are gone; the newest is present.
    expect(screen.queryByText("通知 1")).not.toBeInTheDocument();
    expect(screen.queryByText("通知 2")).not.toBeInTheDocument();
    expect(screen.getByText("通知 3")).toBeInTheDocument();
    expect(screen.getByText(`通知 ${NOTIFICATION_TOAST_MAX + 2}`)).toBeInTheDocument();
  });

  it("removes the toast once dismissed", async () => {
    renderStack([one()]);
    await userEvent.click(screen.getByRole("button", { name: "全部推送" }));
    await screen.findByText("有人关注了你");

    await userEvent.click(screen.getByRole("button", { name: "全部关闭" }));

    await waitFor(() => expect(screen.queryByText("有人关注了你")).not.toBeInTheDocument(), {
      timeout: NOTIFICATION_TOAST_EXIT_MS + 1_500,
    });
  });

  /*
   * NOTE on what is NOT asserted here: the exit TRANSITION.
   *
   * Radix keeps a closing toast mounted only while `getComputedStyle` reports a
   * running animation. jsdom reports none, so `Presence` unmounts the node
   * immediately and the 300ms slide-out never runs in this environment — the
   * assertion above is about removal, not about animation.
   *
   * The animation itself is verified in a real browser instead (the screenshot
   * pass), and the provider's NOTIFICATION_TOAST_EXIT_MS delay is what keeps the
   * node alive for it in production. Faking `getComputedStyle` here would only
   * test the mock.
   */

  it("navigates when the toast carries a destination", async () => {
    renderStack([one({ category: "MESSAGE", title: "收到一条新私信", href: "/messages/c-1" })]);
    await userEvent.click(screen.getByRole("button", { name: "全部推送" }));

    const link = await screen.findByRole("link", { name: /收到一条新私信/ });
    expect(link).toHaveAttribute("href", "/messages/c-1");
  });

  it("is not a link when there is nowhere to go", async () => {
    renderStack([one()]);
    await userEvent.click(screen.getByRole("button", { name: "全部推送" }));
    await screen.findByText("有人关注了你");

    expect(screen.queryByRole("link", { name: /有人关注了你/ })).not.toBeInTheDocument();
  });

  it("exposes a close control per toast", async () => {
    renderStack([one()]);
    await userEvent.click(screen.getByRole("button", { name: "全部推送" }));
    await screen.findByText("有人关注了你");

    const close = screen.getByRole("button", { name: "关闭通知" });
    await userEvent.click(close);
    await waitFor(() => expect(screen.queryByText("有人关注了你")).not.toBeInTheDocument(), {
      timeout: NOTIFICATION_TOAST_EXIT_MS + 1_500,
    });
  });
});

describe("useNotificationToasts without a provider", () => {
  it("degrades to a no-op instead of throwing", async () => {
    // A surface rendered outside the shell must not crash when a background
    // event arrives — the toast is a decoration, the event already happened.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <MemoryRouter>
        <Harness inputs={[one()]} />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole("button", { name: "全部推送" }));

    expect(screen.queryByText("有人关注了你")).not.toBeInTheDocument();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
