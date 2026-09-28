import { describe, expect, it } from "vitest";
import {
  AVATAR_ACCEPT_ATTR,
  AVATAR_ACCEPTED_EXTENSIONS,
  AVATAR_ACCEPTED_MIME_TYPES,
  AVATAR_MAX_BYTES,
  fileExtension,
  resolveAvatarSrc,
  validateAvatarFile,
} from "./avatar-file";

/*
 * The rules here mirror what the upload transport really enforces (verified
 * live 2026-09-23 — see avatar-file.ts). They matter because the backend
 * answers a bad file with 500 INTERNAL_ERROR, which is useless to a user.
 */

function file(name: string, type: string, size = 1024): File {
  const f = new File([new Uint8Array(Math.min(size, 16))], name, { type });
  // `size` is derived from the content, so override it for size-boundary cases.
  Object.defineProperty(f, "size", { value: size });
  return f;
}

describe("avatar-file — the offered formats match the backend", () => {
  it("offers exactly the image formats the transport accepts", () => {
    expect([...AVATAR_ACCEPTED_EXTENSIONS]).toEqual(["png", "jpg", "jpeg", "gif", "webp"]);
    expect([...AVATAR_ACCEPTED_MIME_TYPES]).toEqual([
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
    ]);
  });

  it("builds the accept attribute from the same list", () => {
    expect(AVATAR_ACCEPT_ATTR).toBe("image/png,image/jpeg,image/gif,image/webp");
  });

  it("does not claim svg / bmp / ico, which the backend rejects with 500", () => {
    expect(AVATAR_ACCEPT_ATTR).not.toContain("svg");
    expect(AVATAR_ACCEPT_ATTR).not.toContain("bmp");
    expect(AVATAR_ACCEPT_ATTR).not.toContain("ico");
  });

  it("uses the verified 100 MB limit", () => {
    expect(AVATAR_MAX_BYTES).toBe(100 * 1024 * 1024);
  });
});

describe("avatar-file — fileExtension", () => {
  it("lower-cases the extension", () => {
    expect(fileExtension("Photo.PNG")).toBe("png");
  });

  it("returns empty for a name without a usable extension", () => {
    expect(fileExtension("avatar")).toBe("");
    expect(fileExtension("avatar.")).toBe("");
    expect(fileExtension(".png")).toBe("");
  });
});

describe("avatar-file — validateAvatarFile", () => {
  it("accepts every supported image format", () => {
    expect(validateAvatarFile(file("a.png", "image/png"))).toBeNull();
    expect(validateAvatarFile(file("a.jpg", "image/jpeg"))).toBeNull();
    expect(validateAvatarFile(file("a.jpeg", "image/jpeg"))).toBeNull();
    expect(validateAvatarFile(file("a.gif", "image/gif"))).toBeNull();
    expect(validateAvatarFile(file("a.webp", "image/webp"))).toBeNull();
  });

  it("accepts an upper-case extension", () => {
    expect(validateAvatarFile(file("AVATAR.PNG", "image/png"))).toBeNull();
  });

  it("accepts a supported extension when the browser reports no MIME type", () => {
    // Some platforms hand back "" for a perfectly good file; the extension is
    // what the backend actually looks at.
    expect(validateAvatarFile(file("a.png", ""))).toBeNull();
  });

  it("rejects an unsupported extension", () => {
    expect(validateAvatarFile(file("a.svg", "image/svg+xml"))).toBe(
      "仅支持 PNG、JPG、GIF、WebP 格式的图片",
    );
    expect(validateAvatarFile(file("a.bmp", "image/bmp"))).toBe(
      "仅支持 PNG、JPG、GIF、WebP 格式的图片",
    );
    expect(validateAvatarFile(file("a.pdf", "application/pdf"))).toBe(
      "仅支持 PNG、JPG、GIF、WebP 格式的图片",
    );
    expect(validateAvatarFile(file("avatar", "image/png"))).toBe(
      "仅支持 PNG、JPG、GIF、WebP 格式的图片",
    );
  });

  it("rejects an unsupported MIME type even when the extension looks fine", () => {
    expect(validateAvatarFile(file("a.png", "application/pdf"))).toBe(
      "仅支持 PNG、JPG、GIF、WebP 格式的图片",
    );
  });

  it("rejects an empty file before it reaches the backend", () => {
    expect(validateAvatarFile(file("a.png", "image/png", 0))).toBe("文件内容为空，请重新选择");
  });

  it("accepts exactly 100 MB and rejects one byte more", () => {
    expect(validateAvatarFile(file("a.png", "image/png", AVATAR_MAX_BYTES))).toBeNull();
    expect(validateAvatarFile(file("a.png", "image/png", AVATAR_MAX_BYTES + 1))).toBe(
      "图片不能超过 100 MB",
    );
  });

  it("checks the format before the size, so the reason stays useful", () => {
    expect(validateAvatarFile(file("a.svg", "image/svg+xml", AVATAR_MAX_BYTES * 2))).toBe(
      "仅支持 PNG、JPG、GIF、WebP 格式的图片",
    );
  });
});

describe("avatar-file — resolveAvatarSrc", () => {
  it("passes through the root-relative URL the backend returns", () => {
    expect(resolveAvatarSrc("/api/v1/admin/files/community/messages/x.png")).toBe(
      "/api/v1/admin/files/community/messages/x.png",
    );
  });

  it("treats empty, blank and non-string values as 'no avatar'", () => {
    expect(resolveAvatarSrc(null)).toBeNull();
    expect(resolveAvatarSrc(undefined)).toBeNull();
    expect(resolveAvatarSrc("")).toBeNull();
    expect(resolveAvatarSrc("   ")).toBeNull();
    expect(resolveAvatarSrc(12345)).toBeNull();
  });
});
