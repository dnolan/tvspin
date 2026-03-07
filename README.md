# TV Spin Picker

Randomly picks who gets the next TV choice from a configured name list, while enforcing equal allotment.

## Configure names

1. Copy `.env.example` to `.env.local`
2. Set names as a comma-separated list:

```bash
NEXT_PUBLIC_TV_NAMES=Alex,Bailey,Casey,Jordan
```

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
- Spin history and remaining pool are persisted in browser `localStorage`.

This guarantees each name is selected exactly once per round before any repeats.
