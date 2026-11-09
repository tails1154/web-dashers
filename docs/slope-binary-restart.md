# Slope investigation restart

Baseline: `73c960f` (Make native slope physics a per-level option).
The reset restores player.js, level.js, and level-editor.js exactly to that
commit. Later contact, geometry, death-suppression, and boost experiments are
removed. This is a historical baseline, not a claim of GD physics parity.

## Evidence

Inspected `/tmp/gdsubzero-inspect/libcocos2dcpp.so`, ELF32 i386, with objdump.
SHA-256: `09f539fbb6cd2cf40582c19d1628ecedc10e8b0afbc8887cac656a60a69e123a`.
This is the previously extracted SubZero library; comparisons to other GD
versions require confirming their corresponding routines separately.

`PlayerObject::getModifiedSlopeYVel` at `0x287e40`:

- Reads two doubles at object offsets 0x658 and 0x440 and subtracts them.
- At 0x287e6f, branches when that difference is at least the threshold.
- Below the threshold, multiplies the difference by 10 and clamps to 0.4.
- At/above the threshold, uses 1, then multiplies by float field 0x5f8.

Read-only constant decoding from the ELF rodata (virtual and file offsets
coincide for this section): 0xa0f890 = 0.10000000149011612,
0xa0f898 = 10, 0xa0f888 = 0.4000000059604645, 0xa0f818 = 1.
The discarded implementation grew the multiplier without this upper branch.
Field meanings and time units still need caller/write-site confirmation.

## Next investigation

## First implementation pass

The new profile now accumulates contact time using each physics substep's
duration (`subStepDelta / 60`), supplied by both gameplay and editor loops,
including dual players. The baseline used render-frame duration on every
substep, advancing the timer roughly four times too fast at 60 FPS. Legacy
retains the historical timer. Editor playtest also applies the level's stored
profile before starting, so the per-level choice is actually exercised.
No contact geometry or grounded-state changes are included in this pass.

## Remaining investigation

Contact clearance correction: the baseline helper used `normalY * side * r`,
where `side` is the solid vertex's normal side. That placed the player inward.
It now uses `-side * r / normalY` as the vertical offset, so the signed
perpendicular distance is one radius outside the triangle. The binary's
collidedWithSlope path at 0x29ab25–0x29ab64 divides a player rectangle extent
by cosine; mapping the precise extent and endpoint clamps remains necessary.
64 geometric cases (quarter turns, both mirrors, mini/full radius, two slope
ratios) passed outside-side and perpendicular-clearance assertions against
transformed triangles. These are geometry checks, not native runtime parity.

The new profile's boost modifier now reads `_slopeVelocity`, corresponding to
the signed float at 0x5f8 read at 0x287e81. The geometric speed is separately
stored at 0x5b8 (write at 0x29b2b4); the baseline used that geometric field in
the modifier. The multiplier uses the decoded threshold, floor, and constant
upper branch. An isolated execution of the actual method passed 42 cases
covering positive/negative/zero boost, threshold boundaries, long contact,
and legacy outputs. This verifies the modifier only; the values assigned to
the fields and their integration with collision and jump code remain open.

Trace slope contact flags into hitGround, updateJump, and postCollision;
confirm field identities and units before implementing changes. Reproduce
connected ascending/descending slopes and jumping in both gravity directions.
Static disassembly does not establish observed gameplay behavior.

## Local regression simulator

`tests/slope-simulator.cjs` executes the production `PlayerObject` collision
and jump methods in a Node VM, at the same four physics substeps used by the
game loop. It writes an SVG/JSON trace and can be rendered to a PNG for visual
inspection:

```sh
node tests/slope-simulator.cjs /tmp/webdashers-slope-simulation
convert -background '#101827' /tmp/webdashers-slope-simulation.svg \
  /tmp/webdashers-slope-simulation.png
```

The trace covers connected ascending and descending ramps, with and without a
cube jump, an inverted-slope head bonk, a ship falling into a ramp, a long-to-
short slope transition, and a deliberately large-step narrow-ramp tunnel test.
Each run records its death tick and position. Native assertions require jump
separation, prompt underside separation, ship survival on the non-colliding
uphill contact, smooth adjacent-slope transfer, and swept-triangle collision;
the legacy traces remain controls so their behavior is not silently changed.
The rendered image is a regression aid for the reconstructed behavior, not
proof that a browser implementation is identical to GD without an in-game
comparison.
