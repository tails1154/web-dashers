# Texture Packs

Web Dashers texture packs are small JSON files that replace existing Phaser textures. They are local-only: importing a pack changes the current browser's appearance and does not upload anything to the server.

## Installing a pack

1. Open the title-screen gear.
2. Select **Texture Packs** in the empty settings slot.
3. Choose a `.json` pack file.
4. Reload when prompted. The active pack is stored in browser local storage.

Use **Reset** in the same menu to return to the default textures, then reload.

## File format

The root object must include a non-empty `textures` object. Values must be `data:image/...` URLs, so a pack is self-contained and works without network access:

```json
{
    "name": "Blue Dashers",
    "version": 1,
    "textures": {
        "game_bg_01": "data:image/png;base64,...",
        "GJ_GameSheet03/GJ_optionsBtn_001.png": "data:image/png;base64,..."
    }
}
```

Keys without `/` replace a complete Phaser texture, such as `game_bg_01`. Keys with `/` replace one atlas frame and use the form `atlas-key/frame-name`, such as `GJ_GameSheet03/GJ_optionsBtn_001.png`.

Packs are limited to 8 MB and 100 texture entries. Images should be sized to match the original asset; atlas-frame replacements are drawn into the original frame rectangle. Unsupported or malformed entries are skipped safely, and the default assets remain available after a reset.

To create a data URL, read an image as a Data URL in an image editor or a small local tool. Do not include passwords, account data, remote URLs, or executable code in a pack.
