// Finds free, openly licensed photos from the phone: Openverse and Wikimedia Commons.
// Only licenses that allow commercial reuse and modification: CC0, Public Domain, CC BY, CC BY-SA.
import { fetchT } from "./research.js";

const BAD_TITLE = /\b(map|logo|flag|coat of arms|seal|signature|icon|diagram|svg|chart|graph|locator|emblem|banner|poster|screenshot|text|document|scan|page)\b/i;
const UNSAFE_TITLE = /\b(hoes?|sexy|nude|naked|bikini|lingerie|porn|xxx|drunk|weed|gun|guns|weapon|blood|dead|corpse|nazi|fuck|shit|bitch|ass)\b/i;
const OK_LICENSE = /(cc0|public domain|^pd|pdm|cc[ -]by(?![ -]?nc)(?![ -]?nd))/i;
// Money from other countries looks wrong in a US-focused finance video ("£10 notes" for "money").
const FOREIGN_MONEY = /\b(pounds?|sterling|£|euros?|€|rupees?|yen|yuan|renminbi|pesos?|rubles?|roubles?|lira|francs?|krona|krone|kronor|rand|naira|shillings?|dinars?|dirhams?|baht|ringgit|rupiah|hryvnia|zloty|forint|bank of england|reserve bank of india)\b/i;
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
// What a photo shows, in words, for judging it by meaning: its title and tags without file names,
// camera codes or catalogue numbers ("Old House of Keys - geograph.org.uk - 1817310.jpg" -> "Old House of Keys").
export function describe(c) {
  return `${c.title || ""} ${c.tags || ""}`.replace(/\.(jpe?g|png|webp|tiff?|gif)\b/gi, " ").replace(/\b(geograph\.org\.uk|flickr|wikimedia|commons)\b/gi, " ")
    .replace(/\((cropped|edited|retouched|\d+)\)/gi, " ").replace(/\b(img|dsc|dscn|dscf|p|pict|photo)[-_ ]?\d{3,}\b/gi, " ").replace(/\b\d{5,}\b/g, " ")
    .replace(/[_|]+/g, " ").replace(/(^|\s)[-–—]+(?=\s|$)/g, " ").replace(/\s+/g, " ").trim();
}
// A photo shows what the line is about when its meaning is this close to the line or the topic (cosine,
// all-MiniLM-L6-v2). Measured on real searches (docs/quality-log.md, v52): photos of the subject itself score
// 0.47–0.86 (Federal Reserve banks, Warren Buffett, credit cards); unrelated ones 0.00–0.34 (city skylines for
// the Fed, a phone with stock charts for a line about a library book). A search for the line's own subject
// ("suburban house" for a mortgage) needs a little less (houses score 0.29–0.32 there); a clear match (STRONG)
// is worth showing even where an illustration would otherwise be chosen.
export const RELEVANT = 0.36, RELEVANT_OWN = 0.3, STRONG = 0.52;
const sameTitle = (t) => String(t || "").toLowerCase().replace(/\.(jpe?g|png|webp)$/, "").replace(/\([^)]*\)/g, "").replace(/[^a-z0-9]+/g, " ").trim();   // "(cropped)" is the same photo

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
      about: `${r.title || ""} ${(r.tags || []).map((t) => t.name).join(" ")}`, tags: (r.tags || []).slice(0, 8).map((t) => t.name).join(", "),
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

// Best photo first. Foreign banknotes and coins go last (used only if nothing else turns up). Then the photos
// that show what the line means (sems, from the meaning model) or, without it, whose title and tags name the
// subject; then portrait and large images, which crop best into 9:16.
export function rank(candidates, query, sems = null) {
  candidates.forEach((c, i) => {
    c.fit = fit(c.about || c.title, query); c.foreign = FOREIGN_MONEY.test(`${c.title} ${c.about || ""}`) && !FOREIGN_MONEY.test(query);
    if (sems) c.sem = sems[i];
  });
  const by = (c) => (sems ? Math.round(c.sem * 50) / 50 : c.fit);
  return candidates.sort((a, b) => (Number(a.foreign) - Number(b.foreign)) || (by(b) - by(a)) || (b.fit - a.fit) || (Number(b.height >= b.width) - Number(a.height >= a.width)) || (Math.min(b.width, 2400) - Math.min(a.width, 2400)));
}

export class MediaFinder {
  // judge (optional): async (meaning, texts) -> how close each text is to the meaning (0..1), or null.
  constructor(generic, judge = null) { this.generic = generic; this.used = new Set(); this.usedTitles = new Set(); this.judge = judge; }

  // Tries the line's own subject first, then the topic's general visuals. The result says whether the
  // photo actually fits what the line is about (relevant), so the app can use an illustration instead.
  // With a meaning ({ line, topic, own }: own when the query is the line's own subject), photos are judged by
  // what they show, not by their words: "Perth City Skyline" matches a search for "city skyline", not a line
  // about the Federal Reserve.
  async find(query, meaning = null) {
    for (const [k, q] of [query, ...this.generic.filter((g) => g !== query)].slice(0, 3).entries()) {
      const asset = await this.findImage(q, meaning).catch(() => null);
      if (asset) return { ...asset, query: q, relevant: asset.sem != null ? asset.sem >= (k === 0 && meaning?.own ? RELEVANT_OWN : RELEVANT) : k === 0 && asset.fit >= 0.5 };
    }
    return null;
  }

  async findImage(query, meaning = null) {
    const lists = await Promise.allSettled([searchOpenverse(query), searchCommons(query)]);
    const candidates = lists.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    const sems = meaning && this.judge && candidates.length ? await this.judge(meaning, candidates.map(describe)).catch(() => null) : null;
    rank(candidates, query, sems);
    let attempts = 0;
    for (const c of candidates) {
      // The same photo is often listed twice under different addresses: never show it twice in a video.
      if (this.used.has(c.url) || this.usedTitles.has(sameTitle(c.title)) || (c.width && c.width < 640)) continue;
      if (++attempts > 4) break;
      this.used.add(c.url); this.usedTitles.add(sameTitle(c.title));
      try { return { bitmap: await loadBitmap(c.url), credit: c.credit, title: c.title, fit: c.fit, sem: c.sem ?? null }; } catch { /* try the next one */ }
    }
    return null;
  }
}
