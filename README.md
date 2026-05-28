# Mundial 2026 - Quinielas Deportivas Mobile App

## 🚀 Quick Start

```bash
cd /home/ubuntu/mundial-2026/react_native_space
yarn expo start
```

Then:
- Press `w` to open in web browser
- Scan QR code with Expo Go app (iOS/Android) to test on device
- Press `a` for Android emulator
- Press `i` for iOS simulator

## 🔐 Test Credentials

### Admin Account
- Username: `admin`
- Password: `admin123`

### User Accounts
- `user1` / `user123` (Balance: $500.00)
- `user2` / `user123` (Balance: $250.00)
- `user3` / `user123` (Balance: $100.00)

## 📱 Features

### For Users
- ✅ Login/Register with secure authentication
- ✅ View active matchdays and betting opportunities
- ✅ View betting history (quinielas)
- ✅ Edit profile information
- ✅ Real-time balance updates
- 🕑 Place bets on matchdays (coming soon)
- 🕑 Grupos betting (coming soon)
- 🕑 Wallet management (coming soon)

### For Admins
- ✅ Dashboard with system statistics
- ✅ View total users, tournaments, pool amounts
- 🕑 Manage tournaments (coming soon)
- 🕑 Update match scores (coming soon)
- 🕑 Approve/reject transactions (coming soon)
- 🕑 User management (coming soon)

## 🎨 Design

- **Dark Theme**: Premium glassmorphism design
- **Gradient Accents**: Blue (#003580 → #0052CC)
- **Platform Native**: Follows iOS HIG and Material Design
- **Responsive**: Works on iOS, Android, and Web
- **Animations**: Haptic feedback, smooth transitions

## 🔧 Tech Stack

- React Native + Expo 52
- TypeScript (strict mode)
- Expo Router (file-based navigation)
- Zustand (auth state)
- React Query (server state)
- Axios (API client)
- Expo Linear Gradient
- Expo Haptics

## 📡 Backend

Backend API is running at: `https://16eb630b07.preview.abacusai.app`

API Documentation (Swagger): `https://16eb630b07.preview.abacusai.app/api-docs`

## 🏗️ Project Structure

```
app/
├── auth/          # Login, Register screens
├── user/          # User tabs (Home, Quinielas, Grupos, Wallet, Perfil)
└── admin/         # Admin tabs (Dashboard, Torneos, Partidos, etc.)

components/
├── ui/            # Reusable components (Button, Input, Card, etc.)
└── layout/        # Layout components (Header)

services/          # API client
store/             # Zustand stores
constants/         # Theme, API config
```

## 🐛 Troubleshooting

**Metro bundler errors?**
```bash
yarn expo start --clear
```

**Can't connect from phone?**
- Make sure both devices are on the same network
- Backend is accessible at preview URL (no localhost needed)

**TypeScript errors?**
All TypeScript checks pass. Minor version warnings from expo-doctor can be ignored (newer versions installed).

## 📝 Notes

- Session persists across app restarts (stored in AsyncStorage)
- Auth tokens auto-refresh
- Pull-to-refresh on all data screens
- Offline-first ready (React Query cache)
- Placeholder screens show "Próximamente" message
