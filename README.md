# Sunset Shores — Make GTA 6 (gta6-01)

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/mihawnk-nft/make-gta-6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/mihawnk-nft/make-gta-6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
Built for the [Make GTA 6 bounty](https://make.fun/bounty/gta6-01) on make.fun.

An original open-world crime game that runs offline in a desktop browser from
static files under `game/`. No Rockstar names, characters, maps or assets —
everything (city, story, art, sound) is original.

## The game

You are **Mara Voss** in **Sunset Shores**, a fictional beachfront city at
golden hour. Start with $250, 100 health and 0 wanted stars.

- **On foot:** WASD (camera-relative), Shift to run, Space to jump, drag the
  mouse to orbit the camera, wheel to zoom. Mara is a low-poly figure with
  swinging limbs; buildings block her path.
- **Cars:** press E near a parked car — or a traffic car that stopped for you —
  to get in. W gas, S brake/reverse, A/D steer, E to get out (the car stays
  parked where you leave it). Stealing a car raises your wanted level.
- **Traffic & pedestrians:** 14 cars drive the right-hand lanes around the
  blocks; 18 pedestrians stroll the sidewalks.
- **Wanted & police:** 0–5 stars. Stealing a car or punching someone adds a
  star. Patrol cars chase you (top speed 24, below your 27, so escape is
  possible), ram your car for 8 damage a hit, flash red-blue lights, and call
  one backup per star (max 3). A chase lasting 30 seconds adds a star; 20
  seconds unseen drops one. Get cornered for 2.5 s or total your car and
  you're BUSTED: $100 fine, respawn on foot, missions continue.
- **Combat:** F punches (a pedestrian falls flat, then gets up elsewhere);
  H honks the horn.
- **Missions (3, chained):** follow the yellow light beacon and the minimap
  star — (1) run to the pier ($400), (2) steal a car and bring it to the
  east workshop ($700), (3) deliver it to the north-west drop-off ($1200).
- **HUD & minimap:** cash, wanted stars, health, mission banner, clock,
  speed + car condition while driving, and a live 2D minimap (you, traffic,
  pedestrians, police, mission target).
- **Save:** cash, mission, health, wanted and your exact position persist in
  localStorage and restore after a reload. Esc pauses; "Mulai dari awal"
  wipes the save.
- **Sound:** all audio is synthesized with WebAudio (engine hum, siren,
  thud, horn, mission chime) — no audio files, no network requests.

## Tech

- three.js 0.170.0, vendored as a single file under `game/vendor/`
  (loaded through an import map), ES modules under `game/src/`, one file
  per system: `main.js` (bootstrap + loop), `city.js`, `player.js`,
  `vehicles.js`, `traffic.js`, `pedestrians.js`, `driving.js`, `police.js`,
  `missions.js`, `combat.js`, `hud.js`, `audio.js`, `save.js`, `input.js`,
  plus `rng.js` / `config.js` utilities.
- The city is procedural and deterministic (seed 7): a 5×5 block grid with
  taller, denser buildings downtown, lit windows, street lamps, palms on
  the beachfront, sand + sea to the west, a warm sun, dusk fog and clouds.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

## Hand in

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, stdlib only) copies `game/` + `screenshots/` to the
output directory and writes `dossier.json` with the vendored make.fun
library. It is deterministic: two runs produce byte-identical output.

## License

MIT — see LICENSE.

---

<sub>Entered on [make.fun](https://make.fun/?ref=02e4etp3&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
