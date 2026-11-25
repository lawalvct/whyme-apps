# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Testing WHY ME screens

**In a browser, at phone size (quickest, and what Claude uses).** Start the API, then:

```bash
pnpm exec expo start --port 8081
```

Open http://localhost:8081 and set the browser to a phone size (375×812). In Claude Code's browser
pane this is the `mobile-web` server in `.claude/launch.json`. Details:

- The API is called at `http://localhost:8000/api` unless `EXPO_PUBLIC_API_URL` is set, and the API's
  `CORS_ALLOWED_ORIGINS` includes `http://localhost:8081`.
- `metro.config.js` makes the page cross-origin isolated, which expo-sqlite needs in a browser.
- Web-only stand-ins (`*.web.ts`): the sign-in token lives in sessionStorage
  (`src/lib/token-store.web.ts`) and small settings in localStorage (`src/lib/device-storage.web.ts`).
- What the browser can't show: camera and photo picker as on a phone, push notifications, the
  Android back button, keyboard behaviour, and the real keychain. Check those on a phone.

**On a real phone (Expo Go, same Wi-Fi, no cable).** This is how the app should be judged.

1. On the PC, find its Wi-Fi address (`ipconfig`, "IPv4 Address" under Wi-Fi) and put it in
   `apps/mobile/.env.local` (git ignores it):
   `EXPO_PUBLIC_API_URL=http://<pc-address>:8000/api`.
2. Start the API so the phone can reach it: launch config `api-lan`, or
   `php whyme-api/artisan serve --host=0.0.0.0 --port=8000` from the repo root.
3. Start Expo: launch config `mobile-web`, or `pnpm exec expo start --port 8081` here. Restart it
   after changing `.env.local`.
4. Let the phone in through Windows Firewall (you do this; it is a security setting). On a home or
   office Wi-Fi you trust: Settings → Network & internet → Wi-Fi → your network → Network profile
   type → **Private**, then allow ports 8000 and 8081 on Private networks only, from an
   administrator PowerShell:
   `New-NetFirewallRule -DisplayName "WHY ME dev API 8000" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow -Profile Private`
   and the same with `8081` / "WHY ME dev Expo 8081". Never allow them on a Public network.
   Remove them later with `Remove-NetFirewallRule -DisplayName "WHY ME dev*"`.
5. On the phone: install **Expo Go** (it must support Expo SDK 58), join the same Wi-Fi, then open
   `exp://<pc-address>:8081` (Android: Expo Go → "Enter URL manually"; iPhone: scan the QR code
   that `expo start` prints in a terminal with the Camera, and allow Expo Go to find devices on the
   local network).
6. Quick check from the phone's browser first: `http://<pc-address>:8000/api/v1/health` should
   answer. If it doesn't, the firewall or the Wi-Fi (some guest and office networks keep devices
   apart) is blocking it.

Sign in with the local test accounts from `whyme-api/database/seeders/DemoCatalogueSeeder.php`. A phone is a new device, so the
API asks for a code: locally it is written to `whyme-api/storage/logs/laravel.log` (no SMS is sent),
or use the local bypass code in `whyme-api/.env` (`OTP_BYPASS_CODE`, local only). Photos load from the
PC because development builds swap `localhost` in photo links for the address above
(`src/lib/api.ts`, `mediaUrl`). When the PC can't share its network, the alternative is a staging API
and `expo start --tunnel`.

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **src/app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **example** directory and create a blank **src/app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
