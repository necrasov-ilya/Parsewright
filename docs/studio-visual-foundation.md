# Studio visual foundation

The desktop studio now starts with a quiet animated launch screen built around the Parsewright mark. The mark is drawn on canvas as a line reveal, then softly filled with the accent color before the working shell fades in. The motion should feel calm and precise rather than promotional.

The current asset layout is:

```text
apps/studio/frontend/src/assets/parsewright-logo-mark.svg
apps/studio/frontend/src/assets/parsewright-logo-full.svg
apps/studio/frontend/src/assets/parsewrightLogoMark.ts
```

The mark SVG is used for compact UI surfaces and the launch animation. The full logo is reserved for future branding surfaces such as the empty state, sidebar header, about dialog, installer art, and documentation imagery.

The visual system uses a dark, low-contrast surface stack with a magenta product accent:

```text
surface: #141413
surface elevated: #1c1c1b
surface muted: #20201f
surface soft: #242423
text: #f2eee7
muted text: #aaa39a
border: #343433
accent: #d13b72
accent soft: rgba(209, 59, 114, 0.2)
accent ring: rgba(209, 59, 114, 0.18)
```

Typography is system-first with Inter preferred when available. The UI should stay compact, calm, and tool-like: 6-8px radii, small readable labels, restrained shadows, and accent used for state and primary actions rather than decoration.

The launch screen should remain short. It is a product transition, not a loading excuse. If startup work becomes longer later, the app should show a real status message after the intro rather than stretching the logo animation.
