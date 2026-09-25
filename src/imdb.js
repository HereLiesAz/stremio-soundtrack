// Soundtrack data from IMDb's public GraphQL endpoint (the one imdb.com itself uses).
// IMDb lists a title's songs in order of appearance. Its terms allow only limited,
// non-commercial use of this data; see README.

const ENDPOINT = "https://caching.graphql.imdb.com/";
const EPISODE_PAGE = 250;
const SONG_PAGE = 100;

const SONGS = `soundtrack(first: ${SONG_PAGE}) { edges { node { text comments { plainText } } } }`;

async function query(fetchImpl, graphql, variables) {
  const res = await fetchImpl(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", "x-imdb-client-name": "imdb-web-next" },
    body: JSON.stringify({ query: graphql, variables }),
  });
  if (!res.ok) throw new Error(`IMDb returned HTTP ${res.status}`);
  const body = await res.json();
  if (body.errors?.length) throw new Error(`IMDb: ${body.errors[0].message}`);
  return body.data;
}

/** One IMDb soundtrack entry → { title, artist, writers, notes }. */
export function parseSong(node) {
  const song = { title: node.text, artist: null, writers: null, notes: [] };
  for (const { plainText } of node.comments ?? []) {
    const text = plainText.trim();
    let m;
    if ((m = text.match(/^(?:written\s*(?:&|and)\s*)?performed by\s+(.+)$/i))) song.artist ??= m[1];
    else if ((m = text.match(/^written by\s+(.+)$/i))) song.writers ??= m[1];
    else song.notes.push(text);
  }
  return song;
}

const songsOf = (node) => (node.soundtrack?.edges ?? []).map((e) => parseSong(e.node));

/**
 * Soundtrack for a movie, a whole series (grouped by episode), or a single episode.
 * `id` is an IMDb id; for an episode pass the series id with season and episode.
 */
export async function imdbSoundtrack({ id, season, episode }, fetchImpl = fetch) {
  const head = await query(fetchImpl,
    `query ($id: ID!) { title(id: $id) { titleText { text } titleType { canHaveEpisodes } ${SONGS} } }`,
    { id });
  const title = head.title;
  if (!title) return null;

  if (!title.titleType?.canHaveEpisodes) {
    return { title: title.titleText.text, groups: [{ season: null, episode: null, title: title.titleText.text, songs: songsOf(title) }] };
  }

  const groups = [];
  let after = null;
  do {
    const page = await query(fetchImpl,
      `query ($id: ID!, $after: ID) { title(id: $id) { episodes { episodes(first: ${EPISODE_PAGE}, after: $after) {
         pageInfo { hasNextPage endCursor }
         edges { node { id titleText { text } series { episodeNumber { seasonNumber episodeNumber } } ${SONGS} } } } } } }`,
      { id, after });
    const eps = page.title.episodes.episodes;
    for (const { node } of eps.edges) {
      const n = node.series?.episodeNumber;
      if (!n) continue;
      if (season != null && (n.seasonNumber !== season || n.episodeNumber !== episode)) continue;
      groups.push({ season: n.seasonNumber, episode: n.episodeNumber, id: node.id, title: node.titleText.text, songs: songsOf(node) });
    }
    after = eps.pageInfo.hasNextPage ? eps.pageInfo.endCursor : null;
  } while (after);

  groups.sort((a, b) => a.season - b.season || a.episode - b.episode);
  return { title: title.titleText.text, groups: groups.filter((g) => g.songs.length) };
}
