# YKN TV Android

Native Android WebView version for YKN TV.

## What It Does

- Shows an English sponsor popup once per app session.
- Pressing OK opens the same sponsor redirect URLs used by the website.
- Uses the same main schedule priority as the website:
  1. GitHub raw `tv-events.dat`
  2. Bot API fallback `https://api.ykn.my.id/api/sports/events`
  3. Esportex multi-sport iframe schedule `https://api.esportex.site/api/streams`
- Loads TV channel tabs from the same website sources:
  - `https://raw.githubusercontent.com/movietrailersxxi-pixel/web/main/assets/tv-sports.dat`
  - `https://raw.githubusercontent.com/movietrailersxxi-pixel/web/main/assets/tv-hiburan.dat`
- Uses a large guarded WebView player on top and schedule/server buttons below.
- Adds a bottom footer with `Developed by YKN Team`, Join Community, and Support buttons.
- Support popup includes Saweria, BagiBagi, and Ko-fi links.
- Blocks popup windows and known ad redirect hosts from the embedded iframe player.

## Build

Open this `android-ykn-tv` folder in Android Studio, let Gradle sync, then run the `app` configuration.

The current machine has Java available, but no Gradle/Android SDK command was found from the terminal, so final APK build should be run from Android Studio.
