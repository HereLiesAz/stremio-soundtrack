import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { parseId } from "../src/index.js";
import { imdbSoundtrack, parseSong } from "../src/imdb.js";

const node = (text, ...comments) => ({ text, comments: comments.map((plainText) => ({ plainText })) });

/** Fake IMDb: a movie, and a series whose episodes arrive out of order across two pages. */
function fakeImdb() {
  return async (_url, init) => {
    const { query, variables } = JSON.parse(init.body);
    const reply = (data) => new Response(JSON.stringify({ data }));
    if (variables.id === "tt1") {
      return reply({ title: { titleText: { text: "Movie" }, titleType: { canHaveEpisodes: false },
        soundtrack: { edges: [{ node: node("Song A", "Performed by Band") }] } } });
    }
    if (!query.includes("episodes")) {
      return reply({ title: { titleText: { text: "Show" }, titleType: { canHaveEpisodes: true }, soundtrack: { edges: [] } } });
    }
    const ep = (s, e, songs) => ({ node: { id: `tt${s}${e}`, titleText: { text: `Ep ${s}.${e}` },
      series: { episodeNumber: { seasonNumber: s, episodeNumber: e } }, soundtrack: { edges: songs.map((t) => ({ node: node(t) })) } } });
    const first = !variables.after;
    return reply({ title: { episodes: { episodes: {
      pageInfo: { hasNextPage: first, endCursor: first ? "c1" : null },
      edges: first ? [ep(2, 1, ["S2E1 song"]), ep(1, 2, [])] : [ep(1, 1, ["First", "Second"])],
    } } } });
  };
}

test("parseId", () => {
  assert.deepEqual(parseId("tt123"), { id: "tt123" });
  assert.deepEqual(parseId("tt123%3A2%3A5"), { id: "tt123", season: 2, episode: 5 });
  assert.equal(parseId("kitsu:1"), null);
  assert.equal(parseId("tt1:x:2"), null);
});

test("parseSong splits artist, writers and notes", () => {
  assert.deepEqual(parseSong(node("Misirlou", "Written by Fred Wise", "Performed by Dick Dale", "Courtesy of Rhino")),
    { title: "Misirlou", artist: "Dick Dale", writers: "Fred Wise", notes: ["Courtesy of Rhino"] });
  assert.equal(parseSong(node("X", "Written and performed by Kyle Dixon")).artist, "Kyle Dixon");
});

test("series: every page, sorted by episode, empty episodes dropped", async () => {
  const data = await imdbSoundtrack({ id: "tt9" }, fakeImdb());
  assert.deepEqual(data.groups.map((g) => [g.season, g.episode, g.songs.map((s) => s.title)]),
    [[1, 1, ["First", "Second"]], [2, 1, ["S2E1 song"]]]);
});

test("worker: stream entry links to the view; data endpoint filters to the episode", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = fakeImdb();
  try {
    const get = (p) => worker.fetch(new Request(`https://addon.test${p}`), {}, { waitUntil() {} }).then((r) => r.json());
    const m = await get("/manifest.json");
    assert.equal(m.id, "community.soundtrack");
    assert.match(m.logo, /^https?:\/\/[^/]+\/logo\.png$/);
    const { streams } = await get("/stream/series/tt9%3A1%3A1.json");
    assert.equal(streams[0].title, "2 songs");
    assert.equal(streams[0].externalUrl, "https://addon.test/view/series/tt9%3A1%3A1");
    const ep = await get("/soundtrack/series/tt9:1:1.json");
    assert.deepEqual(ep.groups.map((g) => g.episode), [1]);
    assert.deepEqual((await get("/stream/series/tt9%3A1%3A2.json")).streams, []);
    assert.equal((await get("/soundtrack/movie/tt1.json")).groups[0].songs[0].artist, "Band");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("worker: serves the icon as a PNG", async () => {
  const res = await worker.fetch(new Request("https://addon.test/logo.png"), {}, { waitUntil() {} });
  assert.equal(res.headers.get("content-type"), "image/png");
  const bytes = new Uint8Array(await res.arrayBuffer());
  assert.deepEqual(Array.from(bytes.slice(1, 4)), [0x50, 0x4e, 0x47]); // "PNG"
});
