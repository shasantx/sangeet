# Sangeet for Android

This lightweight Android launcher opens `https://sangeet.shasant.xyz` in Chrome's Trusted Web Activity when the domain is verified, and falls back to a Chrome Custom Tab otherwise. It keeps Google sign-in in the browser and uses the same Sangeet account, library, and device handoff as the website.

## Get an installable APK

Every push to `main` that changes `android/` starts **Build Android app**. A successful run publishes a GitHub release with `sangeet-android.apk`; the landing page's Android buttons use the latest release download. The run also keeps a 14-day Actions artifact. On the phone, open the release download and install the APK. Android may ask you to allow installs from your browser or file manager.

The artifact is a debug-signed, installable build for personal use. Google Play distribution needs a release signing key and a separate release build.

## Verify full-screen app links

The app uses the domain association flow. A Custom Tab still works without verification; Chrome keeps its toolbar visible in that case. To open without browser chrome, publish `/.well-known/assetlinks.json` with the Android package name `xyz.shasant.sangeet` and SHA-256 fingerprint for the stable release signing certificate. Keep that signing key in GitHub Actions secrets and reuse it for every release.

## Connected devices

Apply `supabase/migrations/20261101020000_connected_devices.sql` in the Supabase SQL Editor once. Then deploy the website. Sign into Sangeet on each device using the same Google account; the player’s device button lists online devices and lets you hand off supported streamed tracks. Local files remain on the device that selected them.
