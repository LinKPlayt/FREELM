// Finds free, openly licensed photos from the phone: Openverse and Wikimedia Commons.
// Only licenses that allow commercial reuse and modification: CC0, Public Domain, CC BY, CC BY-SA.
import { fetchT } from "./research.js";

const BAD_TITLE = /\b(map|logo|flag|coat of arms|seal|signature|icon|diagram|svg|chart|graph|locator|emblem|banner|poster|screenshot|text|document|scan|page)\b/i;
const UNSAFE_TITLE = /\b(hoes?|sexy|nude|naked|bikini|lingerie|porn|xxx|drunk|weed|gun|guns|weapon|blood|dead|corpse|nazi|fuck|shit|bitch|ass)\b/i;
const OK_LICENSE = /(cc0|public domain|^pd|pdm|cc[ -]by(?![ -]?nc)(?![ -]?nd))/i;
const STOP = new Set(["the", "and", "for", "with", "photo", "image", "stock"]);

const keywords = (q) => (q.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length > 2 && !STOP.has(w));
function relevant(title, query) {
  const words = keywords(query), t = title.toLowerCase();
  if (!words.length) return true;
  return words.filter((w) => t.includes(w) || t.includes(w.replace(/s$/, ""))).length >= Math.min(2, words.length);
}
// How well a photo's title and tags fit the search: the share of search words they contain (0..1).
function fit(text, query) {
  const words = keywords(query), t = (text || "").toLowerCase();
  if (!words.length) return 0;
  return words.filter((w) => t.includes(w) || t.includes(w.replace(/s$/, ""))).length / words.length;
}
const strip = (s) => (s || "").replace(/<[^>]+>/g, "").trim();

async function searchOpenverse(query) {
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&license=cc0,pdm,by,by-sa&page_size=12&mature=false`;
  const res = await fetchT(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || []).filter((r) => r.id && !BAD_TITLE.test(r.title || "") && !UNSAFE_TITLE.test(r.title || "")).map((r) => {
    const lic = ["cc0", "pdm"].includes(r.license) ? "CC0 / Public Domain" : `CC ${(r.license || "").toUpperCase()} ${r.license_version || ""}`.trim();
    return {
      // Openverse's own image proxy serves the file with the headers a web page needs.
      url: `https://api.openverse.org/v1/images/${r.id}/thumb/?full_size=true`,
      width: r.width || 0, height: r.height || 0, title: r.title || query,
      about: `${r.title || ""} ${(r.tags || []).map((t) => t.name).join(" ")}`,
      credit: `"${r.title || "Untitled"}" by ${r.creator || "unknown"} (${lic}) ${r.foreign_landing_url || ""}`,
    };
  });
}

async function searchCommons(query) {
  const p = new URLSearchParams({
    action: "query", format: "json", origin: "*", generator: "search", gsrsearch: `${query} filetype:bitmap`, gsrnamespace: "6",
    gsrlimit: "12", prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiextmetadatafilter: "LicenseShortName|Artist", iiurlwidth: "1280",
  });
  const res = await fetchT("https://commons.wikimedia.org/w/api.php?" + p);
  if (!res.ok) return [];
  const pages = Object.values((await res.json()).query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
  const out = [];
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info || !["image/jpeg", "image/png", "image/webp"].includes(info.mime)) continue;
    const lic = strip(info.extmetadata?.LicenseShortName?.value);
    const title = page.title.replace(/^File:/, "");
    if (!OK_LICENSE.test(lic) || BAD_TITLE.test(title) || UNSAFE_TITLE.test(title) || !relevant(title, query)) continue;
    let artist = strip(info.extmetadata?.Artist?.value).replace(/\s+/g, " ").trim();
    if (!artist || /unknown author|not provided/i.test(artist)) artist = "unknown author";
    artist = artist.slice(0, 80);
    out.push({
      url: info.thumburl || info.url, width: info.thumbwidth || info.width || 0, height: info.thumbheight || info.height || 0, title,
      credit: `"${title}" by ${artist} (${lic}, Wikimedia Commons) ${info.descriptionurl || ""}`,
    });
  }
  return out;
}

async function loadBitmap(url) {
  const res = await fetchT(url, 20000);
  if (!res.ok) throw new Error(String(res.status));
  const blob = await res.blob();
  if (blob.size > 25e6) throw new Error("too large");
  const bmp = await createImageBitmap(blob);
  if (Math.min(bmp.width, bmp.height) < 360) { bmp.close?.(); throw new Error("too small"); }
  return bmp;
}

export class MediaFinder {
  constructor(generic) { this.generic = generic; this.used = new Set(); }

  // Tries the line's own subject first, then the topic's general visuals. The result says whether the
  // photo actually fits what the line is about (relevant), so the app can use an illustration instead.
  async find(query) {
    for (const [k, q] of [query, ...this.generic.filter((g) => g !== query)].slice(0, 3).entries()) {
      const asset = await this.findImage(q).catch(() => null);
      if (asset) return { ...asset, query: q, relevant: k === 0 && asset.fit >= 0.5 };
    }
    return null;
  }

  async findImage(query) {
    const lists = await Promise.allSettled([searchOpenverse(query), searchCommons(query)]);
    const candidates = lists.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    // Photos whose title/tags name the subject first; then portrait and large images, which crop best into 9:16.
    for (const c of candidates) c.fit = fit(c.about || c.title, query);
    candidates.sort((a, b) => (b.fit - a.fit) || (Number(b.height >= b.width) - Number(a.height >= a.width)) || (Math.min(b.width, 2400) - Math.min(a.width, 2400)));
    let attempts = 0;
    for (const c of candidates) {
      if (this.used.has(c.url) || (c.width && c.width < 640)) continue;
      if (++attempts > 4) break;
      this.used.add(c.url);
      try { return { bitmap: await loadBitmap(c.url), credit: c.credit, title: c.title, fit: c.fit }; } catch { /* try the next one */ }
    }
    return null;
  }
}
