#!/bin/bash
# Real CPU of the T3 Code window process and graphics process. Usage: test/cpu.sh [samples] [label]
# Only valid while the screen is unlocked and the window is drawn; it says INVALID otherwise.
n=${1:-8}; label=${2:-run}
gpu=$(pgrep -f "T3 Code \(Nightly\) Helper --type=gpu-process" | head -1)
ren=$(pgrep -f "T3 Code \(Nightly\) Helper \(Renderer\)" | head -1)
locked=$(swift -e 'import CoreGraphics; import Foundation; let d = CGSessionCopyCurrentDictionary() as? [String: Any]; print((d?["CGSSessionScreenIsLocked"] as? Int) ?? 0)' 2>/dev/null)
if [ "$locked" = "1" ]; then echo "$label: INVALID, the screen is locked"; exit 2; fi
out=$(top -l $((n+1)) -s 3 -pid "$ren" -pid "$gpu" -stats pid,cpu | awk -v r="$ren" -v g="$gpu" '$1==r{rs[++ri]=$2} $1==g{gs[++gi]=$2} END{for(i=2;i<=ri;i++){a+=rs[i]} for(i=2;i<=gi;i++){b+=gs[i]} printf "window %.1f%%  graphics %.1f%%  (%d samples of 3 s)%s", a/(ri-1), b/(gi-1), ri-1, (b/(gi-1)<0.5 ? "  INVALID, the window is not drawn" : "")}')
echo "$label: $out"
