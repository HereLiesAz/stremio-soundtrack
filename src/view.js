// Web view of a soundtrack: dark, monochrome, one section per episode for series.

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const song = (s, i) => `
  <li><span class="n">${i + 1}</span><div><div class="t">${esc(s.title)}</div>
  ${s.artist ? `<div class="a">${esc(s.artist)}</div>` : ""}</div></li>`;

const group = (g) => `
  <section>${g.season != null ? `<h2><span>S${g.season} · E${g.episode}</span> ${esc(g.title)}</h2>` : ""}
  <ol>${g.songs.map(song).join("")}</ol></section>`;

export function renderView(data, ref, origin) {
  const body = !data
    ? `<p class="empty">No soundtrack found.</p>`
    : data.groups.length ? data.groups.map(group).join("") : `<p class="empty">No songs listed.</p>`;
  const whole = ref?.season != null ? `<a class="all" href="${origin}/view/series/${ref.id}">Whole series</a>` : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(data?.title ?? "Soundtrack")} · Soundtrack</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}
body{margin:0;background:#0a0a0a;color:#eee;font:16px/1.45 system-ui,sans-serif;padding:32px 16px}
main{max-width:720px;margin:auto}h1{font-weight:300;letter-spacing:.02em;margin:0 0 4px}
.sub{color:#777;margin-bottom:28px}.all{color:#aaa}
h2{font-weight:400;font-size:1rem;color:#bbb;margin:28px 0 8px;border-bottom:1px solid #222;padding-bottom:6px}
h2 span{color:#666;margin-right:8px}ol{list-style:none;margin:0;padding:0}
li{display:flex;gap:14px;padding:8px 0;border-bottom:1px solid #151515}
.n{color:#555;min-width:1.6em;text-align:right}.t{color:#f2f2f2}.a{color:#888;font-size:.9rem}
.empty{color:#777}footer{color:#444;font-size:.8rem;margin-top:40px}
</style></head><body><main>
<h1>${esc(data?.title ?? "Soundtrack")}</h1><div class="sub">In order of appearance. ${whole}</div>
${body}
<footer>Song data from IMDb.</footer></main></body></html>`;
}
