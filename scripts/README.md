# Level registration scripts

These interactive Bash scripts register local main levels in the same format as
`assets/scripts/game/allLevels.js` and copy their assets into the repository.
Run them from the repository root or from any directory:

```bash
bash scripts/add-main-level.sh
bash scripts/add-hidden-main-level.sh
bash scripts/add-main-level-from-server.sh
```

Each script validates the level number, internal key, song key, source files,
duplicate entries, and destination collisions. It prints a summary and asks for
confirmation before changing anything. Use `--dry-run` to exercise all prompts
and validation without writing files:

```bash
bash scripts/add-hidden-main-level.sh --dry-run
bash scripts/add-main-level-from-server.sh --dry-run
```

The hidden-level script stores `hidden: true` and the normalized vault code in
the level metadata. The game’s vault loader reads that metadata, so new hidden
levels do not require another hardcoded branch in `game-scene.js`. Hidden-level
codes are case-insensitive in the vault and must contain only letters, numbers,
spaces, `_`, or `-`.

The scripts require Bash and Python 3. They never overwrite an existing level
or song asset; leave the song source blank to reuse an existing
`assets/music/<song-key>.mp3` file.

The server-import script asks for a numeric server ID, downloads its level
content, and registers it locally. After a successful import it separately asks
whether to delete the remote copy. Remote deletion requires the owner’s
`wd_session` cookie; the cookie is read silently, used once, and never saved.
