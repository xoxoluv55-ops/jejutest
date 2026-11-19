#!/bin/bash
# Download BodyParts3D 4.0 (IS-A tree, OBJ) + part lists into this directory (~143 MB, CC BY 4.0, (c) DBCLS).
# Parallel range requests (the server is slow per connection); each part resumes on failure.
set -e
cd "$(dirname "$0")"
URL=https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST
for f in isa_element_parts.txt partof_element_parts.txt; do [ -f $f ] || curl -sSO $URL/$f; done
[ -f isa.zip ] && unzip -tq isa.zip >/dev/null 2>&1 && { echo "isa.zip ok"; exit 0; }
TOTAL=$(curl -sSI $URL/isa_BP3D_4.0_obj_99.zip | awk 'tolower($1)=="content-length:"{print $2+0}')
N=8; CH=$(( (TOTAL+N-1)/N ))
for k in $(seq 0 $((N-1))); do
  a=$((k*CH)); b=$((a+CH-1)); [ $b -ge $TOTAL ] && b=$((TOTAL-1))
  ( need=$((b-a+1)); rm -f part$k
    for i in $(seq 1 40); do
      have=$( [ -f part$k ] && stat -c %s part$k || echo 0 ); [ $have -ge $need ] && break
      curl -sS -r $((a+have))-$b --max-time 600 $URL/isa_BP3D_4.0_obj_99.zip >> part$k || true; sleep 1
    done ) &
done
wait
cat $(for k in $(seq 0 $((N-1))); do echo part$k; done) > isa.zip && rm -f part?
unzip -tq isa.zip && echo "isa.zip ok"
