# TV Spin Picker

Randomly picks who gets the next TV choice from a configured name list, while enforcing equal allotment.

## Configure names

1. Copy `.env.example` to `.env.local`
2. Set names as a comma-separated list:

```bash
NEXT_PUBLIC_TV_NAMES=Alex,Bailey,Casey,Jordan
```

## Configure Firebase

Create a Firebase project and a Firestore database, then add your web app credentials in
`.env.local`.

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_TV_GAME_ID=default
```

`NEXT_PUBLIC_TV_GAME_ID` identifies which shared "game" a deployment reads and writes — all signed-in
users on the same game ID share one spin history and pool. It's optional and defaults to `default`.
Give your test/preview deployment a different game ID than production (e.g. `test`) so the two never
share state.

In Firebase Console, enable authentication:

1. Go to `Authentication` -> `Sign-in method`
2. Enable `Google` provider

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Fairness behavior

- Names are picked randomly from a **remaining pool**.
- Once a person is picked, they are removed from the remaining pool.
- When all names have been picked, the pool resets and a new round starts.
- Spin history and remaining pool are persisted to Firebase Firestore in a shared document at `tvspin/{gameId}` (see `NEXT_PUBLIC_TV_GAME_ID`), so any signed-in user on the same game sees and updates the same session.

This guarantees each name is selected exactly once per round before any repeats.

## Watch log

Signed-in users can log what was watched each day (as many entries per day as needed), with an
optional season and episode. The show field type-aheads against shows already logged; new titles are added automatically.
The "picked by" field defaults to that day's spin winner. Every configured name gets a 1–5 star rating
on each entry, and anyone signed in can set or clear any of them (click the selected star again to
clear).

Data lives in subcollections of the shared game doc:

- `tvspin/{gameId}/watches/{watchId}` — date, show, season/episode, chooser, and a `ratings` map
- `tvspin/{gameId}/shows/{showId}` — the type-ahead catalogue

These need the subcollection rule in `firestore.rules`, so redeploy rules after updating:

```bash
firebase deploy --only firestore:rules
```
