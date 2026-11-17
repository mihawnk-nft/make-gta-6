# SUNSET SHORES — Make GTA 6

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/mihawnk-nft/make-gta-6/rank.svg)](https://make.fun/c/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/mihawnk-nft/make-gta-6/reward.svg)](https://make.fun/c/gta6-01)

An original open-world crime game for the [make.fun GTA 6 bounty](https://make.fun/c/gta6-01), built from scratch in three.js. Explore the sun-soaked city of **Sunset Shores** on foot and by car, steal cars, outrun the police, and run missions for the crew — all offline, in a desktop browser, from static files.

## What is in the game

- A living city: streets, traffic, pedestrians, day sky, beachfront and downtown
- On foot and by car: walk, run, jump, steal any parked car (or a traffic car that stopped for you) and drive it — gas, brake, reverse, steering, a chase camera, speed and condition on the HUD
- Wanted system: the police respond, chase and ram; patrol cars multiply with the heat, their light bars flash; stars fall one at a time after 20 clean seconds — get cornered or wreck the car and it is BUSTED (fine, respawn, missions continue)
- Missions and a story: a short campaign with objectives, rewards and progression, with a glowing beacon marking the target in the world
- Combat: punch with F — knock a pedestrian down, dent a car, or earn a star for hitting a cop
- A HUD with a live minimap, a start screen and a save (localStorage)
- Sound and music: procedural WebAudio effects and a synthwave loop, all generated in code

Everything is original: the city, characters, vehicles, names, story, art, sound and music. Nothing from Rockstar Games or any commercial game.

## Play it

Serve `game/` with any static server and open `index.html` in desktop Chrome:

```sh
node serve.ts
# open http://localhost:8080
```

Controls: **WASD** move / drive, **Shift** run, **Space** jump, **E** enter / steal car, **F** punch, **H** horn, **Mouse** camera, **Esc** pause. No network request is made by the game.

## Entry

Built for the make.fun competition `gta6-01`. `main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` with the vendored `vendor/makefun-game.ts` library. The game is plain static files under `game/`; three.js is vendored as a minified build under `game/vendor/`.

License: MIT.
