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
appearance. IMDb permits only limited, non-commercial use of this data; run your own
instance for personal use rather than advertising a shared public one.

Tunefind and WhatSong sit behind bot challenges and can't be scraped from a Worker, and
general search results don't carry usable song lists. Tunefind offers an official API on
application; a Tunefind provider can be added alongside `src/imdb.js` once a key is
granted.

## Run and deploy

~~~sh
npm test                 # unit tests (node --test)
npx wrangler dev         # local, http://localhost:8787/manifest.json
npx wrangler deploy      # Cloudflare Workers
~~~

Install in Stremio with `https://<your-worker>/manifest.json`. Results are cached per
title for 24 hours.

See [RECOGNITION.md](RECOGNITION.md) for identifying the song that is playing right now.
