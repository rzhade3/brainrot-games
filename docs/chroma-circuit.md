# Chroma Circuit specification

Chroma Circuit is a short browser puzzle about clearing a pixel mosaic with color-matched shooters. Loom Games’ Pixel Flow establishes the reference loop of tap-to-launch, finite ammo, a capacity-limited conveyor, and five waiting slots for shooters that return with ammo. [App Store](https://apps.apple.com/us/app/pixel-flow/id6751056652) · [Google Play](https://play.google.com/store/apps/details?id=com.loomgames.pixelflow)

## Rules

- Launch the front shooter from any of five supply lanes or relaunch a shooter from any of five waiting slots. Each lane previews up to two upcoming shooters. Launching from supply advances the lane immediately. Relaunching from a waiting slot frees it immediately.
- The conveyor carries up to four shooters at a time. Shooters make one clockwise lap from the gate at the bottom of the mosaic. A short launch interval keeps riders apart at the gate.
- Each shooter scans the row or column it passes from that side. Empty cells are transparent. The first remaining tile blocks the shot unless its color matches. A hit clears that tile and uses one round.
- A shooter leaves immediately when it runs out of ammo. A shooter that finishes a lap with ammo parks in the first open waiting slot. If all five slots are occupied when it returns, the round ends. Once the belt has enough ammo of every color to clear the remaining tiles, shooters stay on the belt and circle at triple speed until the mosaic is clear.
- Clear every tile to win. If the belt is empty and no available shooter can hit any exposed tile, the round ends when the supply is empty. Restart resets the current mosaic and all its shooters.

## Levels and controls

- Six original mosaics use exposure, returning shooters, and supply queues of varying depth. The first level guides the player through matching and relaunching. Every level has a verified winning sequence and exactly enough ammo of each color to clear its tiles.
- Click, tap, or press Enter or Space on a focused shooter to launch it. On-screen counters show conveyor and waiting slot occupancy. All six mosaics are available from the level picker. Clears are tracked per mosaic and persist locally.
- The arcade catalog links to `/games/chroma-circuit/`. The game stacks the mosaic, waiting slots, and supply on one screen. The level button opens the Mosaics picker and pauses the belt while players choose a board. The Symbols toggle adds matching shapes to tiles and shooters and starts off by default.

The play order is Red Panda, Cherry Sundae, Moon Observatory, Mushroom Cottage, Koi Pond, and Snail Terrarium. Each playable 26 × 26 grid uses shaded blocks, a clear silhouette, and small color details, drawing on the presentation of the [official cat screenshot](https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/8b/c0/2a/8bc02a6f-a1c5-2ee4-9b59-d975a1efb05d/Image_3.jpg/720x0w.png) and the [frog wizard board](https://pixelflowlevel.com/uploads/comments/20260216_69928701c02e6.jpg).
