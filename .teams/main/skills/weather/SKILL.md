---
name: weather
description: "Get current weather conditions and forecasts for any location via wttr.in. Use when the user asks about weather, temperature, rain, or forecasts. Parameters: location (city name or airport code)."
homepage: https://wttr.in/:help
metadata: { "niuma": { "emoji": "☔" } }
---

# Weather Skill

Get current weather and short-term forecasts for any city.

## Commands

### Current weather (one-line summary)
```bash
curl "wttr.in/{location}?format=3"
```

### 3-day forecast
```bash
curl "wttr.in/{location}"
```

### JSON output
```bash
curl "wttr.in/{location}?format=j1"
```

## When to Use

- "What's the weather in Tokyo?"
- "Will it rain tomorrow in London?"
- "Temperature in {location}"

## When NOT to Use

- Historical weather data → use weather archives
- Severe weather alerts → check official sources
