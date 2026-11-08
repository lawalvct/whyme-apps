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

**On a real phone without a cable.** Install Expo Go, run `pnpm exec expo start`, and scan the QR code
(same Wi-Fi as the PC, or add `--tunnel`). Set `EXPO_PUBLIC_API_URL` in `.env` to your PC's LAN address,
e.g. `http://192.168.1.20:8000/api`, and start the API with `php artisan serve --host=0.0.0.0`.

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
