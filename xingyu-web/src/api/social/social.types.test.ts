import { describe, expect, it } from "vitest";
import { toFollowUsers } from "./social.types";

/*
 * The follow endpoints return PageResultView<T>, which is the single most
 * likely thing to get wrong — reading it as a bare array silently yields
 * `undefined` and blanks the page. These pin that contract down.
 */
describe("toFollowUsers", () => {
  it("unwraps the PageResult envelope", () => {
    const page = {
      items: [{ userId: "u1", username: "alice" }],
      nextCursor: null,
      total: 1,
    };
    expect(toFollowUsers(page)).toEqual([{ userId: "u1", username: "alice" }]);
  });

  it("returns an empty array for an empty envelope, not the envelope itself", () => {
    expect(toFollowUsers({ items: [], nextCursor: null, total: 0 })).toEqual([]);
  });

  it("tolerates a bare array in case the backend ever simplifies", () => {
    const list = [{ userId: "u1", username: "alice" }];
    expect(toFollowUsers(list)).toEqual(list);
  });

  it("treats null / undefined / malformed input as empty rather than throwing", () => {
    expect(toFollowUsers(null)).toEqual([]);
    expect(toFollowUsers(undefined)).toEqual([]);
    // @ts-expect-error deliberately malformed: items is not an array
    expect(toFollowUsers({ items: "nope" })).toEqual([]);
  });
});
