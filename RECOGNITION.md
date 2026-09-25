# Identifying the song playing right now

Soundtrack credits say which songs a title uses and in what order, but not when each
plays. Marking the current song needs either timestamps or live recognition.

## Options

**1. Audio fingerprinting of the player's own output (recommended)**
illumera controls its ExoPlayer instance, so it can copy decoded PCM with a Media3
`TeeAudioProcessor`: no microphone, no permission, clean audio. When the user opens the
soundtrack list, take ~10 s and send it to a recognition service; show the match at the
top and the rest in order of appearance.

| Service | Notes |
|---|---|
| ShazamKit (Android SDK) | Large catalogue, strong on popular music. Needs an Apple developer account for the token. |
| ACRCloud | Built for broadcast/TV monitoring, handles music under dialogue relatively well. Paid after a trial. |
| AudD | Simple HTTP API. Paid per request after a small free allowance. |

Constraints: music under dialogue and score matches less reliably; each lookup costs time
and (past free tiers) money; the audio clip goes to a third party, so it should only be
sent on request, never continuously.

**2. Match against the credit list**
Recognition results can be checked against the title's credits: a match that is in the
list is trusted, and it anchors the position in the running order.

**3. Learned timestamps**
Each successful recognition yields (title, playback position, song). Stored centrally,
those accumulate into timestamps, after which the current song can be shown without any
recognition call. Requires a small store (e.g. Workers KV) and consent to share
positions.

**4. Estimate from running order**
Guess from playback position and the order of the credits. Free, no audio leaves the
device, but frequently wrong; songs are not evenly spaced.

## Suggested path

Start with 1 using ShazamKit or ACRCloud behind an on-demand button, cross-checked by 2.
Add 3 later if lookups prove valuable, to cut repeat recognition calls.
