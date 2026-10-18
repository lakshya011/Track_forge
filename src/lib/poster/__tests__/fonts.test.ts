import { describe, expect, it } from "vitest";
import { coversLatin, displayFontStyle, fontFaceCss, parseFontSrcUrl, parseFontWeight, pickLatinFaces } from "../fonts";

describe("poster fonts", () => {
  it("parses src urls and weights", () => {
    expect(parseFontSrcUrl('url("/_next/static/media/a.woff2") format("woff2")')).toBe("/_next/static/media/a.woff2");
    expect(parseFontSrcUrl("url(/x/b.woff2) format('woff2'), url(c.woff)")).toBe("/x/b.woff2");
    expect(parseFontSrcUrl("local('Foo')")).toBeNull();
    expect(parseFontWeight("700")).toBe(700);
    expect(parseFontWeight("600 800")).toBe(600);
    expect(parseFontWeight("normal")).toBe(400);
  });
  it("knows which unicode ranges cover Latin letters", () => {
    expect(coversLatin("")).toBe(true);
    expect(coversLatin("U+0000-00FF, U+0131, U+2000-206F")).toBe(true);
    expect(coversLatin("U+0102-0103, U+1EA0-1EF9, U+20AB")).toBe(false);
    expect(coversLatin("U+0100-02BA")).toBe(false);
  });
  it("picks the Latin face per weight, preferring the preloaded subset", () => {
    const faces = [
      { weight: 700, src: "url(/m/viet-700.woff2)", unicodeRange: "U+0102-0103, U+1EA0-1EF9" },
      { weight: 700, src: "url(/m/latin-700-s.p.x.woff2)", unicodeRange: "U+0000-00FF" },
      { weight: 800, src: "url(/m/ext-800.woff2)", unicodeRange: "U+0100-02BA" },
      { weight: 800, src: "url(/m/latin-800.woff2)", unicodeRange: "U+0000-00FF, U+2000-206F" },
      { weight: 500, src: "url(/m/latin-500.woff2)", unicodeRange: "" },
    ];
    const picked = pickLatinFaces(faces);
    expect([...picked.entries()]).toEqual([
      [700, "http://localhost/m/latin-700-s.p.x.woff2"],
      [800, "http://localhost/m/latin-800.woff2"],
    ]);
    const relative = pickLatinFaces([{ weight: 700, src: 'url("../media/a.woff2")', unicodeRange: "", base: "http://x.test/_next/static/chunks/app.css" }]);
    expect(relative.get(700)).toBe("http://x.test/_next/static/media/a.woff2");
  });
  it("builds an embeddable @font-face rule", () => {
    const css = fontFaceCss("TrackForgeDisplay", 800, "AAAA");
    expect(css).toContain("font-family:'TrackForgeDisplay'");
    expect(css).toContain("font-weight:800");
    expect(css).toContain("data:font/woff2;base64,AAAA");
  });
  it("falls back to an empty block without a document", async () => {
    await expect(displayFontStyle()).resolves.toBe("");
  });
});
