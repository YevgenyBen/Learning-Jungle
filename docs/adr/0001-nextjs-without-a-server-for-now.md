# Next.js, without using its server for now

We build the app with Next.js (App Router) and TypeScript even though it needs no server today: Games run entirely in the browser, and the app stays compatible with static export. We chose Next.js over a static-only setup because login and saved progress may come later, and the app will probably be hosted on Firebase; how and where persistent data would live is deliberately left open until then.
