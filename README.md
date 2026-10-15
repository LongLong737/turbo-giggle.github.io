# turbo-giggle.github.io
turbulent giggles can be found here

## Night Shift

Thirteen cameras. One long night.
 
https://longlong737.github.io/turbo-giggle.github.io/night-shift.html?v=path-tracing-9

Play directly in your browser on desktop or mobile. No download or installation needed.

Rendering uses Three.js 0.186.1 WebGPURenderer and TSL node materials, with automatic WebGL2 fallback. Vendored modules are served from the same site; no CDN is required.

The Graphics menu enables a WebGPU compute path tracer with triangle BVHs, four-bounce paths, soft shadows, reflections, textured materials, and progressive accumulation. Resolution adapts to GPU time. Dynamic TSL lighting remains available for compatibility and faster play.

## Jujutsu Shhnanigans

[Play Jujutsu Shhnanigans](https://longlong737.github.io/turbo-giggle.github.io/jujutsu-shenanigans.html)

A standalone, fan-made browser arena inspired by Jujutsu Shenanigans, featuring **Vessel**, **Honored One**, and **Restless Gambler**. Includes free-for-all, duels, survival, training, and sandbox modes; awakenings, domains, destructible props, and desktop, touch, and gamepad controls. The HTML filename stays unchanged so existing links continue to work.

Bots are **off by default**. Enable one to three opponents from the lobby, the in-game Bots button, or Settings. Every mode includes a regenerating practice dummy: its overhead indicator is green when ready and red while stunned, grabbed, or ragdolled.

Characters use six rigid R6 body parts with Roblox-style proportions. Combat separates ragdoll eligibility from blocking, uses aimed and bounded hitboxes, and keeps M1 advancement behind the victim for combo follow-ups. M1 hitstun is 0.75 seconds; regular ragdolls recover after landing. Jump during the third M1 and use the fourth while descending for an unblockable downslam. Damage dealt fills awakening after approximately 286 damage; damage received does not charge it.

Moves have per-character damage, cooldown, blocking, counter, and ragdoll rules. Held-target sequences cover grabs, barrages, kicks, and slams. Blue pulls one aimed target; projectiles check their paths. Opaque domain enclosures block movement and attacks across their boundaries. Infinite Void holds victims without dealing damage; Shrine slashes periodically; Gambler rolls for a 100-second jackpot (50 seconds on the fourth roll) with health regeneration. Procedural shapes provide steel balls, doors, fire arrows, energy orbs, slashes, and domain scenery.

Move and mechanics references: [controls and mechanics](https://jujutsushenaniganswiki.com/wiki/controls-mechanics/), [Vessel](https://jujutsushenaniganswiki.com/wiki/vessel/), [Honored One](https://jujutsushenaniganswiki.com/wiki/honored-one/), and [Restless Gambler](https://jujutsushenaniganswiki.com/wiki/restless-gambler/). Documented attributes follow the community wiki. Undocumented recovery lengths and procedural animation curves are estimates; exact footage, Roblox animation, and VFX parity has not been verified.

Rendering uses an embedded Three.js WebGL2 renderer with WebGL fallback, instanced scenery, pooled particles, and adaptive resolution. The game has no external runtime asset requests. This is a solo browser adaptation with optional local bots; it does not connect to Roblox or reproduce the complete original game. Open the in-game controls panel for the full key guide.

## D00RS: The Rarewell

[Play D00RS: The Rarewell](https://longlong737.github.io/turbo-giggle.github.io/stairwell.html)

D00RS: The Rarewell is a standalone first-person browser recreation of the DOORS Stairwell, with 100 switchback flights (Landings 100–200), concrete landings, side depots, Creak, Noise and its television, Meld, fire alarms and shelters, Stems, grinders, garage caches, and Cobbler’s exchange. Includes desktop, touch, and gamepad controls, equipment selection, an optional hazard-free explore mode, and a local best-landing record.

Uses the site’s existing vendored Three.js modules with WebGPU and WebGL2 fallback. Models, textures, and audio are generated locally; there are no external runtime asset requests. This solo fan recreation does not connect to Roblox. Exact original asset, map, animation, and behavior parity is not verified. Original DOORS is by LSPLASH. Gameplay references: [Stairwell mechanics](https://doorsroblox.wiki/floors/stairwell/) and [the original game](https://www.roblox.com/games/6516141723/DOORS).

Creak quietly stalks when unwatched, retreats from brief looks, and shows rising aggression through lowered arms. A hand reaching into view warns of a sneak attack; turning to face it earns Paparazzi. Noise retraces the player's recorded path, pauses normally, and fast-forwards when far behind. Destroy its own television or expose it to fire to remove it. Behavior references: [Stairwell entity mechanics](https://doorswiki.com/wiki/the-stairwell/) and [Creak's aggression and sneak attacks](https://doorsroblox.wiki/entities/creak/). Timing and generated animations remain estimates.

Chromebooks and other low-power devices default to Performance graphics with WebGL2, a smaller rendering resolution, fewer lights and particles, and a 30 FPS target. Graphics settings can increase detail.

The Rarewell now has weathered concrete, painted utility walls, framed depot entrances, structural beams, detailed stair nosings, and varied electrical, pipe, ventilation, and maintenance landings. Cabinets and salvage crates have collision while preserving the crossing route. Entity, television, equipment, and exchange models have more detail. The flashlight has a wider beam and longer reach; shared textures and batched scenery retain Performance graphics support.

## D00RS: The H0metell

[Play D00RS: The H0metell](https://longlong737.github.io/turbo-giggle.github.io/hometell.html)

A standalone first-person browser adaptation of the DOORS Hotel, featuring a generated 100-door run, varied room layouts, keys, searchable drawers, wardrobe hiding, equipment, entity encounters, library and electrical-room puzzles, and an optional Explore mode. Includes desktop and touch controls. The hotel pre-generates three rooms ahead, keeps four rooms behind the furthest opened door, and removes older rooms. Retained rooms preserve searched drawers, collected items, and solved puzzles; use the entrance door to revisit them.

Uses custom Blender models and animations for doors, wardrobes, drawers, Seek, and Figure, alongside community furniture and an animated shopkeeper. This solo fan adaptation does not connect to Roblox or reproduce every original feature, entity, or asset. Original DOORS is by LSPLASH.

Play directly in your browser without an account or login. The standalone HTML file embeds its scripts, styles, models, and animations; no external runtime asset requests are needed.
