#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=_level-common.sh
source "$SCRIPT_DIR/_level-common.sh"

DEFAULT_SERVER_URL="https://tails1154.com:9782/cgi-bin/gd/server.py"
DRY_RUN=0
case "${1:-}" in
    "") ;;
    --dry-run) DRY_RUN=1 ;;
    --help|-h) usage; exit 0 ;;
    *) usage >&2; exit 2 ;;
esac

require_repository
require_network_tools

printf '\nAdd a visible main level from the server\n'
printf 'The server level is copied locally, registered as a main level, and can then be deleted remotely.\n\n'

server_url=$(ask_default "Server endpoint" "${WD_SERVER_URL:-$DEFAULT_SERVER_URL}")
[[ "$server_url" =~ ^https?:// ]] || die "server endpoint must start with http:// or https://"
server_id=$(ask_required "Numeric server level ID")
[[ "$server_id" =~ ^[0-9]+$ ]] || die "server level ID must be numeric"

record_file=$(mktemp "${TMPDIR:-/tmp}/web-dashers-level.XXXXXX.json")
level_source=$(mktemp "${TMPDIR:-/tmp}/web-dashers-level.XXXXXX.txt")
cleanup() {
    rm -f -- "$record_file" "$level_source"
}
trap cleanup EXIT

printf 'Downloading server level %s...\n' "$server_id"
if ! curl --fail --silent --show-error --location --max-time 30 --get \
    --data-urlencode "action=get" --data-urlencode "id=$server_id" \
    "$server_url" -o "$record_file"; then
    die "could not download server level $server_id"
fi

server_level_name=$(json_field "$record_file" name)
server_author=$(json_field "$record_file" author)
server_song_name=$(json_field "$record_file" song)
server_requested_stars=$(json_field "$record_file" requested_stars)
[[ -n "$server_level_name" ]] || server_level_name="Server Level $server_id"
[[ -n "$server_author" ]] || server_author="RobTop"
[[ -n "$server_song_name" ]] || server_song_name="ServerSong"
if ! [[ "$server_requested_stars" =~ ^[0-9]+$ ]]; then
    server_requested_stars=0
fi

python3 - "$record_file" "$level_source" <<'PY'
import json
import sys
from pathlib import Path

with open(sys.argv[1], encoding="utf-8") as source:
    data = json.load(source)
level_string = data.get("level_string", "")
if not isinstance(level_string, str) or not level_string.strip():
    raise SystemExit("server response did not contain level_string")
Path(sys.argv[2]).write_text(level_string.strip() + "\n")
PY

display_name=$(ask_default "Display name" "$server_level_name")
default_internal=$(slugify "$display_name")
internal_key=$(ask_default "Internal key" "$default_internal")
validate_identifier "$internal_key"
level_number=$(ask_default "Local level number" "$(next_level_number)")
[[ "$level_number" =~ ^[0-9]+$ ]] || die "level number must be numeric"
(( level_number > 0 )) || die "level number must be greater than zero"
author=$(ask_default "Level creator" "$server_author")
song_author=$(ask_required "Song creator")
default_song_key=$(printf '%s' "$server_song_name" | tr -cd '[:alnum:]_-')
[[ -n "$default_song_key" ]] || default_song_key="ServerSong"
song_key=$(ask_default "Song asset key (without .mp3)" "$default_song_key")
validate_asset_key "$song_key"
star_reward=$(ask_integer "Stars awarded on first completion" "$server_requested_stars")
(( star_reward <= 30 )) || die "star reward cannot exceed 30"
song_source=$(ask_optional_file "Path to the song .mp3 file")

printf '\nSummary\n'
printf '  Server ID: %s\n' "$server_id"
printf '  %s (%s)\n' "$display_name" "level_$level_number"
printf '  Creator: %s\n' "$author"
printf '  Server song label: %s\n' "$server_song_name"
printf '  Local song asset: %s.mp3\n' "$song_key"
printf '  Stars: %s\n' "$star_reward"
if [[ -n "$song_source" ]]; then
    printf '  Song source: %s\n' "$song_source"
else
    printf '  Song source: reuse assets/music/%s.mp3\n' "$song_key"
fi

if (( DRY_RUN )); then
    printf '\nDry run: no local files changed and the server level was not deleted.\n'
    exit 0
fi
ask_yes_no "Import this level locally" || { printf 'Cancelled; server level was not deleted.\n'; exit 0; }

install_level "$level_source" "$level_number" "$song_source" "$song_key" "$internal_key" "$display_name" "$author" "$song_author" "0" "" "$star_reward"
printf '\nImported %s locally.\n' "$display_name"

if ! ask_yes_no "Delete server level $server_id now"; then
    printf 'Server level retained.\n'
    exit 0
fi

printf 'The server requires your authenticated wd_session cookie to delete an owned level.\n'
IFS= read -r -s -p "wd_session cookie value (not saved): " session_cookie || true
printf '\n'
if [[ -z "$session_cookie" ]]; then
    printf 'No session cookie supplied; server level retained.\n'
    exit 0
fi

delete_response=$(mktemp "${TMPDIR:-/tmp}/web-dashers-delete.XXXXXX.json")
trap 'rm -f -- "$record_file" "$level_source" "$delete_response"' EXIT
if ! curl --fail --silent --show-error --location --max-time 30 \
    -X POST --cookie "wd_session=$session_cookie" \
    "$server_url?action=delete&id=$server_id" -o "$delete_response"; then
    printf 'Server deletion failed; the imported local copy was kept.\n' >&2
    exit 1
fi
if ! python3 - "$delete_response" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as source:
    data = json.load(source)
if data.get("ok") is not True:
    raise SystemExit(data.get("error", "server did not confirm deletion"))
PY
then
    printf 'Server did not confirm deletion; the imported local copy was kept.\n' >&2
    exit 1
fi
printf 'Deleted server level %s after importing it locally.\n' "$server_id"
