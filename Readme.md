# Sharely

**Secure, peer-to-peer file sharing**

Sharely lets you send files directly between browsers in real time using Socket.io. No middleman—just drag, drop, and share!

## Features

- Real-time P2P file transfer
- Drag & drop or click-to-upload
- Accept or decline incoming files
- Fun random nicknames (e.g. HappyOtter, WittyPenguin) with emoji avatars
- Responsive, modern UI with dark theme

## Prerequisites

- Node.js (v14+)
- npm

## Getting Started

1. Clone this repo:
   ```bash
   git clone <your-repo-url>
   cd shareit
   ```
2. Install server dependencies:
   ```bash
   npm install
   ```
3. Install client dependencies:
   ```bash
   cd client
   npm install
   ```

## Running the App

### Development

Open two terminals:

- **Server** (project root):
  ```bash
  node server.js
  ```
- **Client** (client folder):
  ```bash
  cd client
  npm run dev
  ```

Visit `http://localhost:5173` in your browser.

### Production

1. Build the client:
   ```bash
   cd client
   npm run build
   ```
2. Start the server (root):
   ```bash
   npm start
   ```

The server will serve the optimized client at `http://localhost:3000`.

## License

This project is licensed under the MIT License. Feel free to use and modify!