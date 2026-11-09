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

Trace slope contact flags into hitGround, updateJump, and postCollision;
confirm field identities and units before implementing changes. Reproduce
connected ascending/descending slopes and jumping in both gravity directions.
Static disassembly does not establish observed gameplay behavior.
