# writeLoop Mobile

React Native + Expo based mobile app scaffold for writeLoop.

## What is included

- Home screen with writeLoop branding and difficulty cards
- Login screen wired to the existing backend auth API
- Practice flow for `A / B / C`
- Daily prompt fetch
- Answer input and feedback request
- My page screen with today's status and common mistakes

## Local run

1. Start the backend locally.

```bash
cd C:\WriteLoop
docker compose up -d writeloop-redis writeloop-backend
```

2. Set the API base URL for Expo if needed.

```bash
copy .env.example .env.local
```

Recommended local value on Android emulator:

```bash
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2
```

This repo's Docker setup exposes Nginx on port `80`, not the backend container on host `8080`.
So the mobile app should call the host through Nginx.

For production builds, set:

```bash
EXPO_PUBLIC_API_BASE_URL=https://api.writeloop.kr
```

3. Start the mobile app.

```bash
cd C:\WriteLoop\apps\mobile
npm run android
```

From the monorepo root you can also use:

```bash
npm run mobile:rn:android
```

If you open the app on a physical phone with Expo Go and it hangs on `Loading from 192.168...`,
restart Expo in tunnel mode instead of LAN mode:

```bash
cd C:\WriteLoop\apps\mobile
npm run start:tunnel
```

From the monorepo root:

```bash
npm run mobile:rn:start:tunnel
```

For Android Studio debug runs on the Android emulator, use the dev-client Metro server:

```bash
cd C:\WriteLoop\apps\mobile
npm run start:android-studio
```

## Run in Android Studio

The native Android project is in:

```bash
C:\WriteLoop\apps\mobile\android
```

1. Open Android Studio.
2. Choose `Open`.
3. Select `C:\WriteLoop\apps\mobile\android`.
4. Wait for Gradle sync to finish.
5. Start Metro in another terminal with `npm run start:android-studio`.
6. Start an emulator from `Device Manager`.
7. Choose the `app` configuration and press `Run`.

If you want to verify the native project builds before opening Android Studio:

```bash
cd C:\WriteLoop\apps\mobile\android
gradlew.bat assembleDebug
```

## Release signing

Create `android/keystore.properties` from `android/keystore.properties.example` and point it to your upload keystore.
The Android release build reads these values from either that file or the matching environment variables:

- `WRITELOOP_UPLOAD_STORE_FILE`
- `WRITELOOP_UPLOAD_STORE_PASSWORD`
- `WRITELOOP_UPLOAD_KEY_ALIAS`
- `WRITELOOP_UPLOAD_KEY_PASSWORD`

If you only want to smoke-test the release pipeline locally, you can temporarily allow debug signing:

```bash
cd C:\WriteLoop\apps\mobile\android
gradlew.bat assembleRelease -Pwriteloop.allowDebugSigningForRelease=true
```

## Checks

```bash
npm run typecheck
npm run lint
```
