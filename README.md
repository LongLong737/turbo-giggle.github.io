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
