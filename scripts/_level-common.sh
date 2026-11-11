#!/usr/bin/env bash
set -euo pipefail

# Shared helpers for the interactive level-registration scripts. This file is
# intended to be sourced, not executed directly.
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    printf 'Source this file from add-main-level.sh or add-hidden-main-level.sh.\n' >&2
    exit 1
fi

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd -- "$SCRIPT_DIR/.." && pwd)
ALL_LEVELS_FILE="$REPO_ROOT/assets/scripts/game/allLevels.js"
LEVELS_DIR="$REPO_ROOT/assets/levels"
MUSIC_DIR="$REPO_ROOT/assets/music"

die() {
    printf 'Error: %s\n' "$*" >&2
    exit 1
}

require_repository() {
    [[ -f "$ALL_LEVELS_FILE" ]] || die "cannot find $ALL_LEVELS_FILE"
    [[ -d "$LEVELS_DIR" ]] || die "cannot find $LEVELS_DIR"
    [[ -d "$MUSIC_DIR" ]] || die "cannot find $MUSIC_DIR"
    command -v python3 >/dev/null 2>&1 || die "python3 is required"
}

require_network_tools() {
    command -v curl >/dev/null 2>&1 || die "curl is required for server imports"
}

json_field() {
    local json_file="$1"
    local field="$2"
    python3 - "$json_file" "$field" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as source:
    data = json.load(source)
value = data.get(sys.argv[2], "")
if value is None:
    value = ""
print(value if isinstance(value, str) else str(value))
PY
}

usage() {
    printf 'Usage: %s [--dry-run]\n' "$(basename "$0")"
    printf '\nThe default mode asks questions and writes only after confirmation.\n'
}

resolve_path() {
    local value="$1"
    if [[ "$value" == /* ]]; then
        printf '%s\n' "$value"
    else
        printf '%s/%s\n' "$PWD" "$value"
    fi
}

ask_required() {
    local prompt="$1"
    local value
    while true; do
        IFS= read -r -p "$prompt: " value || return 1
        if [[ -n "$value" ]]; then
            printf '%s\n' "$value"
            return 0
        fi
        printf 'A value is required.\n' >&2
    done
}

ask_default() {
    local prompt="$1"
    local default_value="$2"
    local value
    IFS= read -r -p "$prompt [$default_value]: " value || return 1
    printf '%s\n' "${value:-$default_value}"
}

ask_integer() {
    local prompt="$1"
    local default_value="$2"
    local value
    while true; do
        value=$(ask_default "$prompt" "$default_value") || return 1
        if [[ "$value" =~ ^[0-9]+$ ]] && (( value >= 0 )); then
            printf '%s\n' "$value"
            return 0
        fi
        printf 'Enter a whole number.\n' >&2
    done
}

ask_existing_file() {
    local prompt="$1"
    local input path
    while true; do
        IFS= read -r -p "$prompt: " input || return 1
        path=$(resolve_path "$input")
        if [[ -f "$path" ]]; then
            printf '%s\n' "$path"
            return 0
        fi
        printf 'File not found: %s\n' "$path" >&2
    done
}

ask_existing_file_from_value() {
    local input="$1"
    local path
    path=$(resolve_path "$input")
    if [[ ! -f "$path" ]]; then
        printf 'File not found: %s\n' "$path" >&2
        return 1
    fi
    printf '%s\n' "$path"
}

ask_optional_file() {
    local prompt="$1"
    local input
    IFS= read -r -p "$prompt (blank to reuse an existing asset): " input || return 1
    if [[ -z "$input" ]]; then
        printf '\n'
    else
        ask_existing_file_from_value "$input"
    fi
}

ask_yes_no() {
    local prompt="$1"
    local answer
    IFS= read -r -p "$prompt [y/N]: " answer || return 1
    [[ "$answer" =~ ^([Yy]|[Yy][Ee][Ss])$ ]]
}

slugify() {
    printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/_/g; s/^_+//; s/_+$//'
}

validate_identifier() {
    local value="$1"
    [[ "$value" =~ ^[a-z][a-z0-9_]*$ ]] || die "internal key must match [a-z][a-z0-9_]*: $value"
}

validate_asset_key() {
    local value="$1"
    [[ "$value" =~ ^[A-Za-z0-9_-]+$ ]] || die "song asset key must contain only letters, numbers, _ or -: $value"
}

next_level_number() {
    python3 - "$LEVELS_DIR" <<'PY'
import pathlib
import sys

used = set()
for path in pathlib.Path(sys.argv[1]).glob("*.txt"):
    if path.stem.isdigit():
        used.add(int(path.stem))

for number in range(30, 3000):
    if number not in used:
        print(number)
        break
else:
    raise SystemExit("no unused local level number between 30 and 2999")
PY
}

append_level_entry() {
    local internal_key="$1"
    local display_name="$2"
    local level_number="$3"
    local author="$4"
    local song_author="$5"
    local song_key="$6"
    local hidden="$7"
    local vault_code="$8"
    local star_reward="$9"

    LEVEL_INTERNAL="$internal_key" \
    LEVEL_NAME="$display_name" \
    LEVEL_NUMBER="$level_number" \
    LEVEL_AUTHOR="$author" \
    LEVEL_SONG_AUTHOR="$song_author" \
    LEVEL_SONG_KEY="$song_key" \
    LEVEL_HIDDEN="$hidden" \
    LEVEL_VAULT_CODE="$vault_code" \
    LEVEL_STAR_REWARD="$star_reward" \
    python3 - "$ALL_LEVELS_FILE" <<'PY'
import json
import os
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text()
internal = os.environ["LEVEL_INTERNAL"]
name = os.environ["LEVEL_NAME"]
number = os.environ["LEVEL_NUMBER"]
author = os.environ["LEVEL_AUTHOR"]
song_author = os.environ["LEVEL_SONG_AUTHOR"]
song_key = os.environ["LEVEL_SONG_KEY"]
hidden = os.environ["LEVEL_HIDDEN"] == "1"
vault_code = os.environ["LEVEL_VAULT_CODE"]
star_reward = int(os.environ["LEVEL_STAR_REWARD"] or "0")

level_id = f"level_{number}"
if re.search(rf"[\"']{re.escape(level_id)}[\"']", text):
    raise SystemExit(f"{level_id} already appears in allLevels.js")
if re.search(rf"[\"']{re.escape(internal)}[\"']", text):
    raise SystemExit(f"{internal} already appears in allLevels.js")
if hidden and re.search(rf"vaultCode\s*:\s*[\"']{re.escape(vault_code)}[\"']", text, re.IGNORECASE):
    raise SystemExit(f"vault code already appears in allLevels.js: {vault_code}")

metadata = []
if hidden:
    metadata.extend(["hidden: true", f"vaultCode: {json.dumps(vault_code)}"])
if star_reward:
    metadata.append(f"starReward: {star_reward}")

lines = [
    "    [",
    f"        {json.dumps(internal)},",
    f"        {json.dumps(name)},",
    f"        {json.dumps(level_id)},",
    f"        [{json.dumps(author)}, {json.dumps(song_author)}],",
    f"        {json.dumps(song_key)}",
]
if metadata:
    lines[-1] += ","
    lines.append(f"        {{{', '.join(metadata)}}}")
lines.append("    ],")
entry = "\n".join(lines) + "\n"

marker = re.search(r"\n\s*/\*\s*\n", text)
if not marker:
    raise SystemExit("could not find the disabled-level marker in allLevels.js")
insert_at = marker.start() + 1
path.write_text(text[:insert_at] + entry + text[insert_at:])
PY
}

install_level() {
    local level_source="$1"
    local level_number="$2"
    local song_source="$3"
    local song_key="$4"
    local internal_key="$5"
    local display_name="$6"
    local author="$7"
    local song_author="$8"
    local hidden="$9"
    local vault_code="${10}"
    local star_reward="${11}"
    local level_destination="$LEVELS_DIR/$level_number.txt"
    local song_destination="$MUSIC_DIR/$song_key.mp3"
    local backup
    local copied_level=0
    local copied_song=0

    [[ ! -e "$level_destination" ]] || die "level asset already exists: $level_destination"
    if [[ -n "$song_source" ]]; then
        [[ ! -e "$song_destination" ]] || die "song asset already exists; leave its source blank to reuse it: $song_destination"
    else
        [[ -f "$song_destination" ]] || die "song asset is missing: $song_destination"
    fi

    backup=$(mktemp "${TMPDIR:-/tmp}/allLevels.XXXXXX")
    cp -- "$ALL_LEVELS_FILE" "$backup"

    rollback() {
        cp -- "$backup" "$ALL_LEVELS_FILE"
        (( copied_level )) && rm -f -- "$level_destination"
        (( copied_song )) && rm -f -- "$song_destination"
        rm -f -- "$backup"
    }

    if ! cp -- "$level_source" "$level_destination"; then
        rollback
        die "could not copy the level asset"
    fi
    copied_level=1

    if [[ -n "$song_source" ]]; then
        if ! cp -- "$song_source" "$song_destination"; then
            rollback
            die "could not copy the song asset"
        fi
        copied_song=1
    fi

    if ! append_level_entry "$internal_key" "$display_name" "$level_number" "$author" "$song_author" "$song_key" "$hidden" "$vault_code" "$star_reward"; then
        rollback
        die "could not register the level in allLevels.js"
    fi
    rm -f -- "$backup"
}
