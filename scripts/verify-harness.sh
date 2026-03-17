#!/usr/bin/env bash
# verify-harness.sh — Verify that the development harness is consistent and complete.
set -euo pipefail

PASS=0
FAIL=0
WARN=0

pass() { ((PASS++)); echo "  [PASS] $1"; }
fail() { ((FAIL++)); echo "  [FAIL] $1" >&2; }
warn() { ((WARN++)); echo "  [WARN] $1"; }
section() { echo ""; echo "== $1 =="; }

section "Module path existence"
if [[ -f ARCHITECTURE.md ]]; then
  in_table=false
  while IFS= read -r line; do
    if [[ "$line" =~ ^\|.*\|$ ]]; then
      if [[ "$line" =~ ^[[:space:]]*\|[-[:space:]|]+\|$ ]]; then
        in_table=true
        continue
      fi
      if $in_table; then
        # Prefer Path column (3rd field). Fallback to 2nd for older table layouts.
        path=$(echo "$line" | awk -F'|' '{print $3}')
        if [[ -z "${path//[[:space:]]/}" ]]; then
          path=$(echo "$line" | awk -F'|' '{print $2}')
        fi
        path=$(echo "$path" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | tr -d '`' | sed 's|/$||')
        if [[ "$path" == "Path" || "$path" == "Module" || "$path" == "Directory" || -z "$path" ]]; then
          continue
        fi
        if [[ -e "$path" ]]; then
          pass "Path exists: $path"
        else
          fail "Path missing: $path"
        fi
      fi
    else
      in_table=false
    fi
  done < ARCHITECTURE.md
else
  warn "ARCHITECTURE.md not found — skipping module path check"
fi

section "Command consistency"
agent_files=("CLAUDE.md" "AGENTS.md" ".github/copilot-instructions.md")
extract_commands() {
  local file="$1"
  grep -E '^\s*(pnpm |npm |npx |yarn |make |go |cargo |python |pip |composer |php )' "$file" 2>/dev/null | sed 's/^[[:space:]]*//' | sort -u || true
}

ref_file="${agent_files[0]}"
if [[ -f "$ref_file" ]]; then
  ref_cmds=$(extract_commands "$ref_file")
  for af in "${agent_files[@]:1}"; do
    if [[ -f "$af" ]]; then
      other_cmds=$(extract_commands "$af")
      if [[ "$ref_cmds" == "$other_cmds" ]]; then
        pass "Commands consistent: $ref_file <-> $af"
      else
        fail "Command mismatch: $ref_file <-> $af"
      fi
    else
      warn "Agent file not found: $af"
    fi
  done
else
  warn "Reference agent file not found: $ref_file"
fi

section "Required sections"
required_sections=("Commands" "Architecture" "Always" "Never" "Harness")
for af in "${agent_files[@]}"; do
  if [[ -f "$af" ]]; then
    for req in "${required_sections[@]}"; do
      if grep -qi "$req" "$af"; then
        pass "$af contains section: $req"
      else
        fail "$af missing section: $req"
      fi
    done
  fi
done

section "ADR structure"
if [[ -d docs/adr ]]; then
  for adr_file in docs/adr/*.md; do
    [[ -e "$adr_file" ]] || continue
    basename=$(basename "$adr_file")
    if [[ "$basename" == "template.md" ]]; then
      pass "ADR template present: $basename"
      continue
    fi
    if [[ "$basename" =~ ^[0-9]{3,}-[a-z0-9]([a-z0-9-]*[a-z0-9])?\.md$ ]]; then
      pass "ADR naming OK: $basename"
    else
      fail "ADR naming invalid: $basename"
    fi
  done
else
  warn "docs/adr/ not found — skipping ADR check"
fi

section "EVOLVE markers"
evolve_count=0
while IFS= read -r match; do
  ((evolve_count++))
  warn "EVOLVE marker: $match"
done < <(grep -rn '<!-- EVOLVE:' --include='*.md' . 2>/dev/null || true)
if [[ $evolve_count -eq 0 ]]; then
  pass "No EVOLVE markers found"
fi

echo ""
echo "========================================"
echo "Passed:   $PASS"
echo "Failed:   $FAIL"
echo "Warnings: $WARN"
echo "========================================"

if [[ $FAIL -gt 0 ]]; then
  echo "Verification FAILED."
  exit 1
else
  echo "Verification PASSED."
  exit 0
fi
