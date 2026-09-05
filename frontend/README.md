# AgentEscrow Frontend

Next.js frontend for AgentEscrow - a bonded manifest register for
agent-to-agent verified data delivery on GenLayer.

## Setup

1. Install dependencies:

**Using bun:**
```bash
bun install
```

**Using npm:**
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Configure environment variables:
   - `NEXT_PUBLIC_CONTRACT_ADDRESS` - AgentEscrow contract address
   - `NEXT_PUBLIC_STUDIO_URL` - GenLayer Studio URL (default: https://studio.genlayer.com/api)

## Development

**Using bun:**
```bash
bun dev
```

**Using npm:**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Build

**Using bun:**
```bash
bun run build
bun start
```

**Using npm:**
```bash
npm run build
npm start
```

## Tech Stack

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS v4** - Styling, with a custom "Bonded Manifest Register" theme
- **genlayer-js** - GenLayer blockchain SDK
- **TanStack Query (React Query)** - Data fetching and caching
- **Radix UI** - Accessible component primitives
- **shadcn/ui** - Pre-built UI components

## Wallet Management

The app connects via MetaMask to GenLayer's Bradbury testnet.

## Features

- **File a Manifest**: Escrow a bond for a named worker agent to fetch and
  declare a fact from an authorized port (an allowlisted neutral source).
- **The Register**: A live ledger of every manifest filed - open, submitted,
  cleared, held, or withdrawn - with the validators' reasoning shown inline
  for resolved manifests.
- **File a Declaration**: The assigned worker reports the value they found.
- **Inspect & Clear**: Anyone can trigger adjudication once a declaration is
  filed; GenLayer validators independently re-check the source and clear or
  hold the bond accordingly.
