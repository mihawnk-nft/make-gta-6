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
  H honks the horn. Round 3 adds a full arsenal: 8 weapons on the wheel
  (fists, pistol, SMG, shotgun, rifle, sniper, RPG, molotov) — left click
  shoots, right click aims, Q cycles, 1–8 select, Tab opens the wheel,
  R reloads. Higher ranks unlock the heavier guns.
- **Missions (10, chained, 3 acts):** follow the yellow light beacon and the
  minimap star — Act 1 "Utang Senja" (pier run $400, steal a car to the east
  workshop $700, north-west delivery $1200), Act 2 "Jalan Panas" ($1800 /
  $2500 / $3400), Act 3 "Menuju Bebas" ($4500 / $6000 / $7500 / $10000).
  Every mission pays +100 RP on top of the cash.
- **Police, escalated:** at 3 stars the Air-1 helicopter shadows you from
  above; at 4–5 stars roadblocks close the avenues. Both stand down below
  3 stars.
- **Cheat codes (type them anywhere while playing):** DUITBANYAK +$5000,
  SEHATSELALU full health + armour, BEBASPOLISI wanted 0, SENJATALENGKAP
  every weapon + RPG in hand, MOBILMEWAH a supercar nearby. The full list
  is on the start and pause screens, and in the phone's Texts tab.
- **Luxury cars:** sports, muscle, limo and supercar sightings in traffic
  and parking — each with its own top speed, steering and value (the
  supercar does 38 and is worth $85,000). Limo and supercar need Rank 2.
- **Districts & standing:** seven named neighbourhoods (Pantai Sunset,
  Dermaga, Kota Tua, Pelabuhan, Pusat Kota, Marina, Bukit Timur), each with
  a WARY / NEUTRAL / FRIENDLY standing starting at 30. A blue-beacon side
  job in a district pays +$150, +25 RP and +20 standing there.
- **Crew:** Dex (Z) talks a cop down one star, Maya (X) repairs your car to
  100%, Rex (C) sends a getaway car — each with a cooldown and loyalty.
  Rex joins at Rank 2.
- **MaraPhone (P):** Jobs, Crew, Map, Bank, Garage and Texts in one place.
  The garage delivers your stolen cars back to your side.
- **Rank & RP:** Rank 1 Pemula (0 RP), Rank 2 Jalanan (300 RP), Rank 3
  Legenda Senja (800 RP). Ranks unlock weapons and luxury cars.
- **Radio (R):** Sunset FM, Turbo FM and Neon Nights, then off — each with
  its own generative WebAudio loop, shown in the HUD as "♪ …".
- **HUD & minimap:** cash, wanted stars, health + armour, mission card with
  act and number, clock, rank, district + standing, side job, radio, heli
  badge, weapon wheel, speed + car value and condition while driving, and a
  live 2D minimap (you, traffic, pedestrians, police, heli, roadblocks,
  mission target, side-job beacon). Click the minimap to drop a waypoint;
  a compass shows your heading.
- **Save:** cash, mission, health, armour, wanted, RP, district standing,
  side-job stats, weapon and your exact position persist in localStorage
  (3 slots from the pause menu) and restore after a reload. Esc pauses;
  "Mulai dari awal" wipes the save.
- **Sound:** all audio is synthesized with WebAudio (engine hum, siren,
  thud, horn, gunshots, explosions, radio loops, mission chime) — no audio
  files, no network requests.
- **Graphics (HD):** antialiasing, device pixel ratio up to 2, soft shadow
  mapping from the low golden-hour sun, ACES filmic tone mapping, richer
  materials — kept light enough to stay playable.

## Tech

- three.js 0.170.0, vendored as a single file under `game/vendor/`
  (loaded through an import map), ES modules under `game/src/`, one file
  per system: `main.js` (bootstrap + loop), `city.js`, `player.js`,
  `vehicles.js`, `traffic.js`, `pedestrians.js`, `driving.js`, `police.js`,
  `missions.js`, `combat.js`, `hud.js`, `audio.js`, `save.js`, `input.js`,
  plus `rng.js` / `config.js` utilities. Round 3 adds `rank.js`, `districts.js`,
  `sidejob.js`, `crew.js`, `cheats.js` and `phone.js`.
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
