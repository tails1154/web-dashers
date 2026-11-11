#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=_level-common.sh
source "$SCRIPT_DIR/_level-common.sh"

case "${1:-}" in
    "") ;;
    --dry-run) DRY_RUN=1 ;;
    --help|-h) usage; exit 0 ;;
    *) usage >&2; exit 2 ;;
esac

DRY_RUN=${DRY_RUN:-0}
require_repository

printf '\nAdd a visible main level\n'
printf 'The level is inserted before the disabled-level section in allLevels.js.\n\n'

display_name=$(ask_required "Display name")
default_internal=$(slugify "$display_name")
internal_key=$(ask_default "Internal key" "$default_internal")
validate_identifier "$internal_key"
level_number=$(ask_default "Level number" "$(next_level_number)")
[[ "$level_number" =~ ^[0-9]+$ ]] || die "level number must be numeric"
(( level_number > 0 )) || die "level number must be greater than zero"
author=$(ask_default "Level creator" "RobTop")
song_author=$(ask_required "Song creator")
song_key=$(ask_required "Song asset key (without .mp3)")
validate_asset_key "$song_key"
star_reward=$(ask_integer "Stars awarded on first completion" "0")
(( star_reward <= 30 )) || die "star reward cannot exceed 30"
level_source=$(ask_existing_file "Path to the level .txt file")
song_source=$(ask_optional_file "Path to the song .mp3 file")

printf '\nSummary\n'
printf '  %s (%s)\n' "$display_name" "level_$level_number"
printf '  Creator: %s\n' "$author"
printf '  Song: %s by %s\n' "$song_key" "$song_author"
printf '  Stars: %s\n' "$star_reward"
printf '  Level source: %s\n' "$level_source"
if [[ -n "$song_source" ]]; then
    printf '  Song source: %s\n' "$song_source"
else
    printf '  Song source: reuse assets/music/%s.mp3\n' "$song_key"
fi

if (( DRY_RUN )); then
    printf '\nDry run: no files were changed.\n'
    exit 0
fi
ask_yes_no "Write this level" || { printf 'Cancelled.\n'; exit 0; }

install_level "$level_source" "$level_number" "$song_source" "$song_key" "$internal_key" "$display_name" "$author" "$song_author" "0" "" "$star_reward"
printf '\nAdded %s.\n' "$display_name"
