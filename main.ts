// SUNSET SHORES — my own open-world crime game for make.fun gta6-01,
// written from scratch in this session. You play Mara Voss, a newcomer
// in a sun-soaked coastal city: walk the avenues, steal cars, outrun the
// patrol cars, and run missions for the crew — all offline, in a desktop
// browser, from the static files under game/ (three.js is vendored as one
// minified build under game/vendor/). This program is only the hand-in:
// it copies game/ and screenshots/ from beside this file into the output
// directory and writes /output/dossier.json with the vendored make.fun
// library, so the sealed scorer and the AI judge can read the entry.
//
// Run it locally to check the hand-in (Node 22, standard library only):
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the game itself with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The playable game: plain static files, no build step, no network.
mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });

// The screenshots: 3 or 4 real renders of the game, first by name is cover.
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The dossier the judge reads, built with the kit's own library. The caps
// below mirror the scorer's gate: at most 4 screenshots of 256 KiB each,
// game/ at most 993 files and 48 MiB in all, paths at most 1000 bytes,
// dossier text at most 160 KiB.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
