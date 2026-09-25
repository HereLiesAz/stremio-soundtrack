// Stremio addon (Cloudflare Worker): lists the songs in a movie's or series' soundtrack.
//
//   /manifest.json                      Stremio addon manifest
//   /stream/:type/:id.json              one "Soundtrack" entry that opens the web view
//   /soundtrack/:type/:id.json          the data, for clients with a native view (illumera)
//   /view/:type/:id                     web view (series: grouped by episode)
//   /logo.png                           addon icon (assets/logo.svg)
//
// ids: movie "tt0110912"; series "tt4574334"; episode "tt4574334:1:2".

import { imdbSoundtrack } from "./imdb.js";
import { renderView } from "./view.js";
import { LOGO_PNG_BASE64 } from "./logo.js";

const CACHE_SECONDS = 24 * 60 * 60;

export const manifest = {
  id: "community.soundtrack",
  version: "0.2.0",
  name: "Soundtrack",
  description: "Every song in a movie or series, grouped by episode and in order of appearance.",
  resources: ["stream"],
  types: ["movie", "series"],
  idPrefixes: ["tt"],
  catalogs: [],
  behaviorHints: { configurable: false },
};

/** "tt4574334:1:2" → { id, season, episode }; plain ids have no season/episode. */
export function parseId(raw) {
  const [id, season, episode] = decodeURIComponent(raw).split(":");
  if (!/^tt\d+$/.test(id)) return null;
  if (season === undefined) return { id };
  const s = Number(season), e = Number(episode);
  return Number.isInteger(s) && Number.isInteger(e) ? { id, season: s, episode: e } : null;
}

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*", "cache-control": `public, max-age=${CACHE_SECONDS}` },
});

async function soundtrackFor(ref, ctx) {
  // Cache per title (not per episode) so a whole series is fetched from IMDb once.
  const cache = globalThis.caches?.default;
  const key = new Request(`https://soundtrack.cache/${ref.id}`);
  let data = cache && await cache.match(key).then((r) => r?.json());
  if (!data) {
    data = await imdbSoundtrack({ id: ref.id });
    if (data && cache) ctx?.waitUntil(cache.put(key, json(data)));
  }
  if (!data || ref.season == null) return data;
  return { ...data, groups: data.groups.filter((g) => g.season === ref.season && g.episode === ref.episode) };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "");
    if (request.method === "OPTIONS") return new Response(null, { headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" } });

    // Stremio needs an absolute logo URL, so it's filled in from the host serving the manifest.
    if (path === "" || path === "/manifest.json") return json({ ...manifest, logo: `${url.origin}/logo.png` });
    if (path === "/logo.png") {
      const bytes = Uint8Array.from(atob(LOGO_PNG_BASE64), (c) => c.charCodeAt(0));
      return new Response(bytes, { headers: { "content-type": "image/png", "access-control-allow-origin": "*", "cache-control": `public, max-age=${CACHE_SECONDS}` } });
    }

    let m = path.match(/^\/(stream|soundtrack)\/(movie|series)\/([^/]+)\.json$/);
    if (m) {
      const [, kind, type, raw] = m;
      const ref = parseId(raw);
      if (!ref) return json(kind === "stream" ? { streams: [] } : { error: "Unsupported id" }, kind === "stream" ? 200 : 400);
      let data;
      try {
        data = await soundtrackFor(ref, ctx);
      } catch (e) {
        return kind === "stream" ? json({ streams: [] }) : json({ error: e.message }, 502);
      }
      if (kind === "soundtrack") return data ? json({ type, ...ref, ...data }) : json({ error: "Not found" }, 404);
      const count = data?.groups.reduce((n, g) => n + g.songs.length, 0) ?? 0;
      if (!count) return json({ streams: [] });
      return json({ streams: [{
        name: "🎵 Soundtrack",
        title: `${count} song${count === 1 ? "" : "s"}`,
        externalUrl: `${url.origin}/view/${type}/${encodeURIComponent(decodeURIComponent(raw))}`,
        behaviorHints: { notWebReady: true },
      }] });
    }

    m = path.match(/^\/view\/(movie|series)\/([^/]+)$/);
    if (m) {
      const ref = parseId(m[2]);
      const data = ref && await soundtrackFor(ref, ctx).catch(() => null);
      return new Response(renderView(data, ref, url.origin), {
        status: data ? 200 : 404,
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": `public, max-age=${CACHE_SECONDS}` },
      });
    }

    return json({ error: "Not found" }, 404);
  },
};
