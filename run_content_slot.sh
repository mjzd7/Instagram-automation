#!/bin/bash
# Cycle through content themes in cyclic manner
# 7 themes, 28 slots per week (7 days × 4 slots)

# Define the theme categories in order
THEMES=("motivation" "business" "leadership" "success" "lifestyle" "entrepreneurship" "motivation")

# Calculate slot number based on day and time
day_of_week=$(date +%u)  # 1=Monday, 7=Sunday
hour=$(date +%H)

# Determine slot number (1-4)
case $hour in
    09) slot=1 ;;
    12) slot=2 ;;
    17) slot=3 ;;
    20) slot=4 ;;
    *) slot=1 ;;
esac

# Calculate theme index: cycle through 7 themes for each slot
# Slot 1-7: themes 0-6, Slot 8-14: themes 0-6, etc.
# Formula: ((day - 1) * 4 + slot - 1) % 7
total_slots=$(( (day_of_week - 1) * 4 + slot ))
theme_index=$(( (total_slots - 1) % 7 ))

category="${THEMES[$theme_index]}"

export CATEGORIES="$category"

# Run the content generation script
cd "$(dirname "$0")"
SKIP_POST=true npx tsx src/daily-quote.ts >> "$(dirname "$0")/content-slot.log" 2>&1
