# Soundtrack — Stremio addon

Lists every song in a movie or series soundtrack, in order of appearance. Series are
grouped by episode.

In Stremio the addon adds a **🎵 Soundtrack** entry to a movie's or episode's streams;
selecting it opens a page with the songs. [illumera](https://github.com/HereLiesAz/illumera)
reads the same data directly and shows it natively on the details screen and in the player.

## Endpoints

~~~
/manifest.json                     addon manifest
/stream/{movie|series}/{id}.json   the Soundtrack entry (Stremio stream protocol)
/soundtrack/{movie|series}/{id}.json   soundtrack data as JSON
/view/{movie|series}/{id}          web page
/logo.png                          addon icon
~~~

`id` is an IMDb id: `tt0110912` (movie), `tt4574334` (whole series) or
`tt4574334:1:2` (season 1, episode 2).

~~~json
{
  "type": "series", "id": "tt4574334", "season": 1, "episode": 2,
  "title": "Stranger Things",
  "groups": [
    { "season": 1, "episode": 2, "id": "tt4593122", "title": "Chapter Two: The Weirdo on Maple Street",
      "songs": [ { "title": "…", "artist": "…", "writers": "…", "notes": ["…"] } ] }
  ]
}
~~~

## Data source

Songs come from IMDb's GraphQL endpoint, which lists soundtrack credits in order of
appearance. IMDb permits only limited, non-commercial use of this data. The public
instance is listed in Stremio's community addons anyway, so if IMDb blocks it, that is the
reason.

Tunefind and WhatSong sit behind bot challenges and can't be scraped from a Worker, and
general search results don't carry usable song lists. Tunefind's API application page is
gone, so illumera reads Tunefind on the device instead (its `TunefindSource`).

## Run and deploy

~~~sh
npm test                 # unit tests (node --test)
npx wrangler dev         # local, http://localhost:8787/manifest.json
npx wrangler deploy      # Cloudflare Workers
~~~

Install in Stremio with `https://<your-worker>/manifest.json`. Results are cached per
title for 24 hours.

## Icon

`assets/logo.svg` is the source. `assets/logo.png` (256×256) is rendered from it in
headless Chromium and embedded in `src/logo.js` as base64, which the Worker serves at
`/logo.png`. The manifest's `logo` is filled in from the host serving it.

## Publishing

Listed in Stremio's community addons with one request (the Stremio SDK's
`publishToCentral`), made after a deploy. The listing re-reads the manifest, so later
deploys update it:

~~~sh
curl -X POST https://api.strem.io/api/addonPublish -H 'Content-Type: application/json' \
  -d '{"transportUrl":"https://stremio-soundtrack.hereliesaz.workers.dev/manifest.json","transportName":"http"}'
~~~

See [RECOGNITION.md](RECOGNITION.md) for identifying the song that is playing right now.
