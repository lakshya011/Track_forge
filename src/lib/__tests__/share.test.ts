import { describe, expect, it, vi } from "vitest";
import { defaultTeamId, TEAM_IDS } from "../poster/teams";
import { buildShareUrl, canShareFiles, posterShareText, shareImage, shareQuery, shareTargets, shortUrl } from "../share";

const pages = { href: "https://lakshya011.github.io/Track_forge/?name=OLD&poster=engraved#x" };

describe("share links", () => {
  it("keeps the base path and replaces the whole search", () => {
    const url = buildShareUrl({ name: "LEWIS", seed: 42 }, { style: "cartographic", ratio: "1:1", team: null }, pages);
    expect(url).toBe("https://lakshya011.github.io/Track_forge/?name=LEWIS&seed=42&poster=cartographic&ratio=1%3A1");
  });

  it("omits defaults so the plain link stays short", () => {
    expect(buildShareUrl({ name: "LEWIS", seed: 0 }, {}, { href: "http://localhost:3000/" })).toBe("http://localhost:3000/?name=LEWIS");
    const q = shareQuery({ name: "LEWIS", seed: 0 }, { style: "sector", ratio: "2:3", team: defaultTeamId("LEWIS", 0) });
    expect(q.toString()).toBe("name=LEWIS");
  });

  it("writes a chosen team, the story ratio and an explicit length", () => {
    const def = defaultTeamId("ANNA", 7);
    const other = TEAM_IDS.find((t) => t !== def)!;
    const q = shareQuery({ name: "ANNA", seed: 7 }, { style: "teamcar", ratio: "9:16", team: other, len: "be-1925" });
    expect(Object.fromEntries(q)).toEqual({ name: "ANNA", seed: "7", len: "be-1925", poster: "teamcar", ratio: "9:16", team: other });
  });

  it("returns an empty link without a location (server render)", () => {
    expect(buildShareUrl({ name: "X", seed: 0 }, {}, undefined)).toBe("");
  });

  it("shortens a link for print", () => {
    expect(shortUrl("https://lakshya011.github.io/Track_forge/?name=LEWIS")).toBe("lakshya011.github.io/Track_forge");
    expect(shortUrl("http://localhost:3000/?name=A")).toBe("localhost:3000");
    expect(shortUrl("not a url")).toBe("not a url");
  });

  it("builds the poster line and the fallback intents", () => {
    const url = "https://lakshya011.github.io/Track_forge/?name=LEWIS";
    const text = posterShareText(url);
    expect(text).toBe(`I turned my name into a Grand Prix circuit. Try yours: ${url}`);
    const t = shareTargets(text, url);
    expect(t.whatsapp).toBe(`https://wa.me/?text=${encodeURIComponent(text)}`);
    expect(t.x).toContain(`url=${encodeURIComponent(url)}`);
    expect(t.x).toContain(encodeURIComponent("I turned my name into a Grand Prix circuit. Try yours:"));
    // A message without the link gets it appended for WhatsApp.
    expect(shareTargets("Beat it.", url).whatsapp).toBe(`https://wa.me/?text=${encodeURIComponent(`Beat it. ${url}`)}`);
  });
});

describe("share sheet", () => {
  const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
  const req = { blob, filename: "lewis.png", title: "LEWIS", text: "Try yours:", url: "https://x.y/?name=LEWIS" };

  it("falls back to the menu when files cannot be shared", async () => {
    expect(canShareFiles(undefined)).toBe(false);
    expect(canShareFiles({ share: vi.fn(), canShare: () => false } as unknown as Navigator)).toBe(false);
    expect(await shareImage(req, { share: vi.fn() } as unknown as Navigator)).toBe("menu");
    expect(await shareImage(req, { share: vi.fn(), canShare: () => false } as unknown as Navigator)).toBe("menu");
  });

  it("passes a PNG file with the link inside the text", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const nav = { share, canShare: () => true } as unknown as Navigator;
    expect(await shareImage(req, nav)).toBe("shared");
    const data = share.mock.calls[0][0];
    expect(data.files).toHaveLength(1);
    expect(data.files[0]).toBeInstanceOf(File);
    expect(data.files[0].name).toBe("lewis.png");
    expect(data.files[0].type).toBe("image/png");
    expect(data.text).toBe("Try yours: https://x.y/?name=LEWIS");
    expect(data.title).toBe("LEWIS");
    expect(data.url).toBeUndefined();
  });

  it("treats a closed sheet as aborted and anything else as a menu case", async () => {
    const abort = { share: vi.fn().mockRejectedValue(new DOMException("closed", "AbortError")), canShare: () => true } as unknown as Navigator;
    expect(await shareImage(req, abort)).toBe("aborted");
    const broken = { share: vi.fn().mockRejectedValue(new TypeError("no")), canShare: () => true } as unknown as Navigator;
    expect(await shareImage(req, broken)).toBe("menu");
  });
});
