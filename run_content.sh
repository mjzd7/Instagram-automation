#!/bin/bash
# Determine day of week (1=Monday, 7=Sunday)
day_of_week=$(date +%u)

# Map day to category for content theme
case $day_of_week in
    1) # Monday
        CATEGORIES="motivation"
        ;;
    2) # Tuesday
        CATEGORIES="business"
        ;;
    3) # Wednesday
        CATEGORIES="leadership"
        ;;
    4) # Thursday
        CATEGORIES="business"
        ;;
    5) # Friday
        CATEGORIES="success"
        ;;
    6) # Saturday
        CATEGORIES="leadership"
        ;;
    7) # Sunday
        CATEGORIES="motivation"
        ;;
esac

export CATEGORIES

# Run the content generation script
cd "$(dirname "$0")"
SKIP_POST=true npx tsx src/daily-quote.ts >> "$(dirname "$0")/content.log" 2>&1
