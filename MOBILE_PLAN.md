# Tradie App - Mobile Application Development Plan

## Executive Summary

Build a React Native mobile app (iOS & Android) using Expo that consumes the existing Next.js backend APIs. The mobile app will be the **primary interface** for on-site work, focusing on job management, time tracking, photo capture, and quick invoicing - all optimized for mobile-first workflows.

**Target Users:** Tradies working on-site who need quick access to job info, time tracking, photo capture, and client communication.

---

## ✅ Technology Stack

### Core Framework
- **React Native with Expo (Managed Workflow)**
  - Already initialized in `apps/mobile/`
  - Expo SDK 51.x (latest stable)
  - Expo Router for file-based navigation
  - **Why Expo?** Over-the-air updates, easier native module management, faster development, no Xcode/Android Studio needed for most development

### Development Tools
- **IDE: Visual Studio Code** ✓ (Same as web!)
  - React Native Tools extension
  - Expo Tools extension
  - TypeScript support (strict mode)
  - Same ESLint/Prettier config as web

### Key Libraries (Already in package.json)
```json
{
  "@clerk/clerk-expo": "^1.0.0",          // Authentication (shares session with web)
  "@tanstack/react-query": "^5.0.0",      // API calls & caching
  "zustand": "^4.5.0",                    // Global state management
  "react-native-paper": "^5.12.0",        // UI components (Material Design)
  "expo-router": "~3.5.0",                // File-based navigation
  "expo-camera": "~15.0.0",               // Photo capture for jobs
  "expo-image-picker": "~15.0.0",         // Gallery access
  "expo-document-picker": "~12.0.0",      // Document uploads
  "expo-secure-store": "~13.0.0"          // Secure token storage
}
```

### Testing Strategy
1. **Development Testing**: Expo Go app (instant testing on physical devices)
2. **Unit Testing**: Jest + React Native Testing Library
3. **E2E Testing** (optional): Detox for critical flows
4. **Preview Builds**: EAS Build for beta testing
5. **Production**: TestFlight (iOS) / Internal Testing (Android)

---

## 📱 Mobile-First Feature Prioritization

### Phase 1: Core Job Management (Weeks 1-3) - **HIGH PRIORITY**

#### 1.1 Authentication & Organization Selection
- Login with Clerk (email/password)
- Biometric login (FaceID/TouchID) for subsequent logins
- Organization switcher (if user is member of multiple orgs)
- Remember last selected organization

**API Endpoints:**
- `POST /api/auth/*` (Clerk handles this)
- `GET /api/organizations` (list user's organizations)

#### 1.2 Today's Jobs Dashboard
- List of jobs assigned to logged-in user
- Filter options:
  - Today
  - This Week
  - All
- Quick status indicators:
  - 🟡 Scheduled
  - 🔵 In Progress
  - 🟢 Completed
- Pull-to-refresh
- Search by client name or job number
- Tap job card to open details

**API Endpoints:**
- `GET /api/jobs?assignedToMe=true`
- `GET /api/jobs?startDate=2025-01-01&endDate=2025-01-31`

#### 1.3 Job Detail Screen
**Display:**
- Job number, title, description
- Client info with quick actions:
  - 📞 Call (direct dial)
  - 💬 SMS (open SMS app or in-app SMS)
  - 📧 Email
- Site address with "Open in Maps" button
- Site access notes
- Status badge & priority indicator
- Scheduled date/time
- Quoted amount

**Action Buttons:**
- ⏱️ Start Timer (if not started)
- ⏸️ Pause Timer (if running)
- 📸 Add Photos
- 📝 Add Notes
- 🔧 Add Materials
- ✅ Complete Job

**Tabs/Sections:**
- Overview (main info)
- Time Logs (list of time entries)
- Materials (list of materials added)
- Photos (gallery grid)
- Notes (chronological timeline)

**API Endpoints:**
- `GET /api/jobs/[id]`
- `GET /api/jobs/[id]/time-logs`
- `GET /api/jobs/[id]/materials`
- `GET /api/jobs/[id]/photos`
- `GET /api/jobs/[id]/notes`

#### 1.4 Time Tracking (CRITICAL!)
**Features:**
- Big "Start Timer" button on job detail screen
- Live timer display (updates every second)
- Pause/Resume
- Manual time entry form (for forgot to start timer cases)
- Break duration tracking
- Hourly rate display (pulled from user's organization_member record)
- Auto-calculate labor cost
- Notes field
- Submit for approval

**Timer Behavior:**
- Keeps running even if app is in background
- Push notification when timer exceeds 8 hours (prevent forgot to stop)
- Save timer state to local storage (persist across app restarts)

**API Endpoints:**
- `POST /api/jobs/[id]/start-timer`
- `POST /api/jobs/[id]/stop-timer`
- `GET /api/jobs/[id]/active-timer`
- `POST /api/jobs/[id]/time-logs` (manual entry)

#### 1.5 Photo Capture
**Features:**
- Camera button on job detail screen
- Take photo with device camera
- Or pick from gallery
- Categorize:
  - Before
  - During
  - After
  - Issue
  - Completion
- Add caption/description
- Photos upload immediately (background upload)
- Gallery view (grid of thumbnails)
- Tap thumbnail for full-screen view with swipe

**API Endpoints:**
- `POST /api/jobs/[id]/photos` (upload)
- `DELETE /api/jobs/[id]/photos/[photoId]`

#### 1.6 Job Notes
**Features:**
- Quick note button
- Text input (or voice-to-text with expo-speech)
- Categorize:
  - General
  - Issue
  - Client Request
  - Internal
- Timestamp and user attribution
- View note timeline (chronological)

**API Endpoints:**
- `POST /api/jobs/[id]/notes`
- `DELETE /api/jobs/[id]/notes/[noteId]`

---

### Phase 2: Materials & Expenses (Weeks 4-5) - **MEDIUM PRIORITY**

#### 2.1 Add Materials to Job
**Features:**
- "Add Material" button on job detail
- Form fields:
  - Material type: Product / Part / Hire Equipment
  - Description
  - Supplier name
  - Quantity
  - Unit price
  - Total cost (auto-calculated)
- Upload receipt photo (camera or gallery)
- Status indicator: Pending Approval
- View list of materials added to job
- Edit/delete pending materials

**API Endpoints:**
- `POST /api/jobs/[id]/materials`
- `PUT /api/jobs/[id]/materials/[materialId]`
- `DELETE /api/jobs/[id]/materials/[materialId]`

#### 2.2 Expense Submission
**Features:**
- My Expenses screen (in bottom tabs)
- "Add Expense" button
- Form fields:
  - Category: Fuel / Materials / Tools / Vehicle / Meals / Other
  - Description
  - Amount (auto-calculate GST)
  - Date
  - Allocate to job (optional dropdown)
- Upload receipt photo (required)
- Status: Pending / Approved / Rejected
- View my expense history
- Filter by status, date range

**API Endpoints:**
- `GET /api/expenses?userId=me`
- `POST /api/expenses`
- `PUT /api/expenses/[id]`

---

### Phase 3: Client Communication (Week 6) - **MEDIUM PRIORITY**

#### 3.1 Quick SMS from Job
**Features:**
- SMS button on job detail screen
- Quick message templates:
  - "On my way"
  - "Running 15 min late"
  - "Job completed"
  - "Issue discovered: [description]"
- Custom message option
- View SMS history for this client
- Uses organization's SMS credits

**API Endpoints:**
- `POST /api/sms/send`
- `GET /api/sms/conversations/[id]/messages`

#### 3.2 Client Directory
**Features:**
- Clients tab in bottom navigation
- Search by name
- Sort: A-Z / Recent
- Client card shows:
  - Name
  - Phone/email
  - Last job date
  - Total jobs
- Quick actions:
  - Call
  - SMS
  - Email
- Tap card for client detail

**API Endpoints:**
- `GET /api/clients`
- `GET /api/clients/[id]`
- `GET /api/clients/[id]/jobs`

---

### Phase 4: Calendar & Appointments (Week 7) - **MEDIUM PRIORITY**

#### 4.1 Calendar View
**Features:**
- Calendar tab in bottom navigation
- View options:
  - Day (timeline view with hours)
  - Week (7 columns)
  - Month (grid)
- Color-coded by status:
  - Scheduled: Yellow
  - In Progress: Blue
  - Completed: Green
- Tap event to open job detail
- Today button (quick jump)

**API Endpoints:**
- `GET /api/appointments`
- `GET /api/jobs?startDate=X&endDate=Y`

#### 4.2 Job Navigation
**Features:**
- "Today" view shows:
  - List of jobs for today
  - Map with pins for each job site
  - Optimized route (future)
- Tap "Navigate" to open Google Maps with directions

**API Endpoints:**
- `GET /api/jobs?date=today&assignedToMe=true`

---

### Phase 5: Quick Invoicing (Week 8) - **LOW PRIORITY** (Desktop is primary for invoicing)

#### 5.1 Quick Invoice from Completed Job
**Features:**
- "Create Invoice" button on completed job
- Auto-populate:
  - Client details
  - Time logs (approved only) as line items
  - Materials (approved only) as line items
- Simple line item editor (add/edit/delete)
- Preview PDF (WebView or react-native-pdf)
- Send options:
  - Email
  - SMS with link
  - Both
- Mark as sent

**API Endpoints:**
- `POST /api/invoices` (create from job)
- `GET /api/invoices/[id]/pdf`
- `POST /api/invoices/[id]/send-email`
- `POST /api/invoices/[id]/send-sms`

---

### Phase 6: Approvals (Admin/Owner only) (Week 9) - **LOW PRIORITY**

#### 6.1 Approval Queue
**Features:**
- "Approvals" section in More menu (if user is owner/admin)
- Tabs:
  - Timesheets (pending time logs)
  - Expenses (pending expenses)
  - Materials (pending materials)
- Each item shows:
  - User name
  - Job/description
  - Amount/hours
  - Date
- Tap to view details
- Approve/Reject buttons
- Rejection requires reason
- Bulk approve option

**API Endpoints:**
- `GET /api/approvals/time-logs`
- `GET /api/approvals/materials`
- `GET /api/expenses?status=pending`
- `POST /api/jobs/[id]/time-logs/[logId]/approve`
- `POST /api/jobs/[id]/time-logs/[logId]/reject`

---

### Phase 7: Reports (Read-only) (Week 10) - **LOW PRIORITY**

#### 7.1 View Reports
**Features:**
- Reports section in More menu
- Available reports:
  - Revenue (chart + summary)
  - Time Tracking (hours by user/job)
  - My Performance (if employee)
  - Team Performance (if admin)
- Simple chart display (react-native-chart-kit)
- Export CSV (opens share sheet)

**API Endpoints:**
- `GET /api/reports/revenue`
- `GET /api/reports/time-tracking`
- `GET /api/reports/team-performance`

---

## 🏗️ Mobile App Architecture

### API Communication Layer

```typescript
// services/api.ts
import { useAuth } from '@clerk/clerk-expo'

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://tradie-app-web.vercel.app/api'

export const createApiClient = (getToken: () => Promise<string | null>) => {
  const request = async (endpoint: string, options: RequestInit = {}) => {
    const token = await getToken()

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`)
    }

    return response.json()
  }

  return {
    get: (endpoint: string) => request(endpoint),
    post: (endpoint: string, data: any) => request(endpoint, { method: 'POST', body: JSON.stringify(data) }),
    put: (endpoint: string, data: any) => request(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (endpoint: string) => request(endpoint, { method: 'DELETE' }),
  }
}
```

### State Management Layers

1. **Server State** (React Query)
   - API data caching
   - Background refetching
   - Optimistic updates
   - Automatic retry on failure

2. **Global State** (Zustand)
   - Current user session
   - Selected organization
   - App settings (theme, language)

3. **Local State** (useState/useReducer)
   - Component-specific UI state
   - Form inputs
   - Modal visibility

4. **Persistent State** (expo-secure-store + AsyncStorage)
   - Auth tokens (secure-store)
   - Offline data cache (AsyncStorage)
   - User preferences (AsyncStorage)

### Navigation Structure (Expo Router)

```
apps/mobile/app/
├── _layout.tsx                 # Root layout with providers
├── index.tsx                   # Splash/redirect
│
├── (auth)/                     # Auth stack (no bottom tabs)
│   ├── _layout.tsx
│   ├── sign-in.tsx
│   └── sign-up.tsx
│
├── (tabs)/                     # Bottom tab navigator (main app)
│   ├── _layout.tsx            # Tab bar config
│   ├── index.tsx              # Home: Today's Jobs
│   ├── calendar.tsx           # Calendar view
│   ├── clients.tsx            # Client list
│   ├── expenses.tsx           # My expenses
│   └── more.tsx               # More menu (profile, settings, reports, logout)
│
├── jobs/                       # Job screens (stack)
│   ├── [id].tsx               # Job detail
│   ├── [id]/time.tsx          # Time tracking screen
│   ├── [id]/photos.tsx        # Photo gallery
│   ├── [id]/materials.tsx     # Materials list
│   └── [id]/notes.tsx         # Notes list
│
├── clients/
│   └── [id].tsx               # Client detail
│
├── invoices/
│   ├── [id].tsx               # Invoice detail
│   └── [id]/preview.tsx       # PDF preview
│
└── settings/
    ├── index.tsx              # Settings home
    ├── profile.tsx            # Edit profile
    └── organization.tsx       # Switch organization
```

### React Query Setup

```typescript
// app/_layout.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,        // 5 minutes
      cacheTime: 1000 * 60 * 30,       // 30 minutes
      retry: 3,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
})

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={...}>
      <QueryClientProvider client={queryClient}>
        <Stack />
      </QueryClientProvider>
    </ClerkProvider>
  )
}
```

### Example: Fetching Jobs

```typescript
// hooks/useJobs.ts
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-expo'
import { createApiClient } from '@/services/api'

export const useJobs = (filters?: { assignedToMe?: boolean, date?: string }) => {
  const { getToken } = useAuth()

  return useQuery({
    queryKey: ['jobs', filters],
    queryFn: async () => {
      const api = createApiClient(getToken)
      const params = new URLSearchParams()
      if (filters?.assignedToMe) params.append('assignedToMe', 'true')
      if (filters?.date) params.append('date', filters.date)

      return api.get(`/jobs?${params}`)
    },
  })
}

// In component:
const { data: jobs, isLoading, refetch } = useJobs({ assignedToMe: true, date: 'today' })
```

---

## 🎨 UI/UX Design System

### Bottom Tab Navigation

```typescript
// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2563eb', // blue-600
        tabBarInactiveTintColor: '#6b7280', // gray-500
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Jobs',
          tabBarIcon: ({ color }) => <Ionicons name="hammer" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color }) => <Ionicons name="calendar" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: 'Clients',
          tabBarIcon: ({ color }) => <Ionicons name="people" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: 'Expenses',
          tabBarIcon: ({ color }) => <Ionicons name="card" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color }) => <Ionicons name="menu" size={24} color={color} />,
        }}
      />
    </Tabs>
  )
}
```

### Component Library: React Native Paper

```typescript
import { Button, Card, TextInput, FAB } from 'react-native-paper'

// Example: Job Card
export const JobCard = ({ job, onPress }) => (
  <Card style={{ margin: 8 }} onPress={onPress}>
    <Card.Title
      title={job.title}
      subtitle={job.client.name}
      left={(props) => <Avatar.Icon {...props} icon="hammer" />}
      right={(props) => <Chip>{job.status}</Chip>}
    />
    <Card.Content>
      <Text>{job.site_address}</Text>
      <Text>{format(job.scheduled_date, 'PPp')}</Text>
    </Card.Content>
    <Card.Actions>
      <Button mode="outlined">View</Button>
      {job.status === 'scheduled' && (
        <Button mode="contained" icon="play">Start</Button>
      )}
    </Card.Actions>
  </Card>
)
```

### Design Tokens

```typescript
// constants/Colors.ts
export const Colors = {
  primary: '#2563eb',      // blue-600
  secondary: '#8b5cf6',    // purple-600
  success: '#10b981',      // green-500
  warning: '#f59e0b',      // amber-500
  danger: '#ef4444',       // red-500
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    500: '#6b7280',
    900: '#111827',
  },
}

// constants/Sizes.ts
export const Sizes = {
  touchTarget: 44,         // Minimum touch target (iOS HIG)
  padding: 16,
  borderRadius: 8,
  iconSize: 24,
}
```

### Loading States

```typescript
// Use Skeleton screens, not spinners
import { Skeleton } from '@rneui/themed'

export const JobCardSkeleton = () => (
  <View style={{ padding: 16 }}>
    <Skeleton width="80%" height={20} />
    <Skeleton width="60%" height={16} style={{ marginTop: 8 }} />
    <Skeleton width="100%" height={40} style={{ marginTop: 16 }} />
  </View>
)
```

---

## 🧪 Testing Strategy

### 1. Development Testing (Expo Go)

**Setup:**
```bash
cd apps/mobile
npm start
```

**Options:**
1. **iOS Simulator** (Mac only):
   - Press `i` in terminal
   - Or: Xcode → Open Developer Tool → Simulator

2. **Android Emulator**:
   - Press `a` in terminal
   - Or: Android Studio → AVD Manager

3. **Physical Device** (Recommended!):
   - Install Expo Go app (iOS/Android)
   - Scan QR code from terminal
   - Instant reload on save

**Benefits:**
- ✅ Fastest feedback loop
- ✅ Test on real devices
- ✅ Share with team (they scan QR)
- ✅ No build process needed

### 2. Unit Testing (Jest)

```bash
# Install testing dependencies
npm install -D jest @testing-library/react-native @testing-library/jest-native

# Run tests
npm test
npm test -- --watch        # Watch mode
npm test -- --coverage     # Coverage report
```

**Example Test:**
```typescript
// components/__tests__/JobCard.test.tsx
import { render, fireEvent } from '@testing-library/react-native'
import { JobCard } from '../JobCard'

describe('JobCard', () => {
  const mockJob = {
    id: '1',
    title: 'Fix pipes',
    client: { name: 'John Smith' },
    status: 'scheduled',
  }

  it('renders job title and client name', () => {
    const { getByText } = render(<JobCard job={mockJob} />)

    expect(getByText('Fix pipes')).toBeTruthy()
    expect(getByText('John Smith')).toBeTruthy()
  })

  it('calls onPress when tapped', () => {
    const onPress = jest.fn()
    const { getByText } = render(<JobCard job={mockJob} onPress={onPress} />)

    fireEvent.press(getByText('View'))
    expect(onPress).toHaveBeenCalled()
  })
})
```

### 3. Preview Builds (EAS Build)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Configure
eas build:configure

# Build preview (internal testing)
eas build --platform ios --profile preview
eas build --platform android --profile preview
```

**eas.json:**
```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "production": {
      "distribution": "store"
    }
  }
}
```

### 4. Beta Testing

**iOS (TestFlight):**
1. Build production version: `eas build --platform ios --profile production`
2. Submit to TestFlight: `eas submit --platform ios`
3. Add beta testers in App Store Connect
4. TestFlight sends invitation emails

**Android (Internal Testing):**
1. Build production APK/AAB: `eas build --platform android --profile production`
2. Submit to Google Play: `eas submit --platform android`
3. Add testers to internal testing track
4. Testers get Play Store link

---

## 🚀 Development Workflow

### Daily Workflow

```bash
# Start dev server
cd apps/mobile
npm start

# Development options:
# - Press 'i' for iOS simulator
# - Press 'a' for Android emulator
# - Scan QR on physical device with Expo Go

# Make changes in VS Code
# - Save file → App reloads instantly
# - Shake device → Open dev menu
# - Press 'r' → Reload
# - Press 'j' → Open debugger
```

### VS Code Extensions (Install These!)

1. **React Native Tools** (Microsoft)
   - IntelliSense, debugging, Expo integration

2. **Expo Tools** (Expo)
   - Snippets, commands, auto-completion

3. **ESLint** (Microsoft)
   - Linting (shares config with web)

4. **Prettier** (Prettier)
   - Code formatting

5. **Error Lens** (Alexander)
   - Inline error display

6. **TypeScript Error Translator** (Matt Pocock)
   - Human-readable TS errors

### Debugging

**Console Logging:**
```typescript
console.log('Job data:', job)  // Shows in terminal where npm start is running
```

**React Native Debugger:**
```bash
# Shake device → "Debug Remote JS"
# Opens Chrome DevTools
```

**VS Code Debugger:**
```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Attach to Expo",
      "request": "attach",
      "type": "reactnative",
      "cwd": "${workspaceFolder}/apps/mobile"
    }
  ]
}
```

---

## 📦 Deployment Process

### Development Sharing (Instant)
```bash
npm start
# Share URL with team
# Team installs Expo Go → Scans QR → Tests instantly
```

### Preview Builds (Beta Testing)
```bash
# iOS
eas build --platform ios --profile preview
# Generates .ipa → Upload to TestFlight → Share with testers

# Android
eas build --platform android --profile preview
# Generates .apk → Upload to Play Console Internal Testing → Share link
```

### Production Release
```bash
# iOS (App Store)
eas build --platform ios --profile production
eas submit --platform ios

# Android (Google Play)
eas build --platform android --profile production
eas submit --platform android
```

### Over-the-Air Updates (Post-Launch)
```bash
# Push updates without app store review
eas update --branch production

# Users get updates on next app open
# Works for JS/React code changes (not native code)
```

---

## 📂 File Structure

```
tradie-app/
├── apps/
│   ├── mobile/                           # React Native Expo app
│   │   ├── app/                          # Expo Router (file-based)
│   │   │   ├── _layout.tsx              # Root layout with providers
│   │   │   ├── index.tsx                # Splash/redirect
│   │   │   ├── (auth)/                  # Auth stack
│   │   │   │   ├── _layout.tsx
│   │   │   │   ├── sign-in.tsx
│   │   │   │   └── sign-up.tsx
│   │   │   ├── (tabs)/                  # Main bottom tabs
│   │   │   │   ├── _layout.tsx
│   │   │   │   ├── index.tsx           # Today's Jobs
│   │   │   │   ├── calendar.tsx
│   │   │   │   ├── clients.tsx
│   │   │   │   ├── expenses.tsx
│   │   │   │   └── more.tsx
│   │   │   ├── jobs/
│   │   │   │   ├── [id].tsx            # Job detail
│   │   │   │   └── [id]/
│   │   │   │       ├── time.tsx
│   │   │   │       ├── photos.tsx
│   │   │   │       ├── materials.tsx
│   │   │   │       └── notes.tsx
│   │   │   ├── clients/
│   │   │   │   └── [id].tsx            # Client detail
│   │   │   └── settings/
│   │   │       ├── index.tsx
│   │   │       ├── profile.tsx
│   │   │       └── organization.tsx
│   │   │
│   │   ├── components/                   # Reusable components
│   │   │   ├── JobCard.tsx
│   │   │   ├── TimeTracker.tsx
│   │   │   ├── PhotoPicker.tsx
│   │   │   ├── ClientCard.tsx
│   │   │   ├── MaterialForm.tsx
│   │   │   ├── ExpenseForm.tsx
│   │   │   └── __tests__/               # Component tests
│   │   │
│   │   ├── hooks/                        # Custom hooks
│   │   │   ├── useJobs.ts               # React Query hook for jobs
│   │   │   ├── useClients.ts
│   │   │   ├── useTimeTracker.ts
│   │   │   ├── useAuth.ts
│   │   │   └── useApi.ts
│   │   │
│   │   ├── services/                     # API client
│   │   │   ├── api.ts                   # Base API client
│   │   │   ├── jobs.ts                  # Job API methods
│   │   │   ├── clients.ts
│   │   │   ├── auth.ts
│   │   │   └── upload.ts                # File upload helper
│   │   │
│   │   ├── store/                        # Zustand stores
│   │   │   ├── authStore.ts             # Auth state
│   │   │   ├── appStore.ts              # App settings
│   │   │   └── timerStore.ts            # Timer state
│   │   │
│   │   ├── types/                        # TypeScript types
│   │   │   ├── api.ts                   # API response types
│   │   │   ├── models.ts                # Data model types
│   │   │   └── navigation.ts            # Navigation types
│   │   │
│   │   ├── utils/                        # Utility functions
│   │   │   ├── format.ts                # Date/currency formatting
│   │   │   ├── validation.ts            # Form validation
│   │   │   └── permissions.ts           # Permission checking
│   │   │
│   │   ├── constants/                    # Constants
│   │   │   ├── Colors.ts
│   │   │   ├── Sizes.ts
│   │   │   └── Config.ts
│   │   │
│   │   ├── assets/                       # Images, icons, fonts
│   │   │   ├── images/
│   │   │   ├── icons/
│   │   │   └── fonts/
│   │   │
│   │   ├── app.json                      # Expo config
│   │   ├── eas.json                      # EAS Build config
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── jest.config.js                # Jest config
│   │   └── .env.example                  # Environment variables
│   │
│   └── web/                               # Next.js (already built)
│
├── packages/
│   ├── shared-types/                      # NEW: Shared types between mobile/web
│   │   ├── src/
│   │   │   ├── api.ts                    # API types
│   │   │   ├── models.ts                 # Model types
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── shared-utils/                      # NEW: Shared utilities
│       ├── src/
│       │   ├── validation.ts             # Zod schemas
│       │   ├── formatting.ts             # Date/currency
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
```

---

## 📋 Implementation Timeline (10 Weeks)

### Week 1: Foundation & Authentication
- ✅ Set up Expo app structure
- ✅ Configure Clerk authentication
- ✅ Create API client service
- ✅ Build bottom tab navigation
- ✅ Theme setup (colors, fonts)
- ✅ Basic layouts and screens

### Week 2: Jobs - List & Detail
- Build Today's Jobs dashboard
- Job list with filters (Today/Week/All)
- Job detail screen with all info
- Client info with quick actions (call/SMS/map)
- Pull-to-refresh
- Search functionality

### Week 3: Time Tracking
- Timer UI component
- Start/stop/pause timer
- Live timer display
- Background timer (keeps running when app backgrounded)
- Manual time entry form
- Submit for approval
- View time log history

### Week 4: Photo Capture
- Integrate expo-camera
- Camera screen with capture button
- Photo categorization (Before/During/After/Issue)
- Caption input
- Upload to API
- Gallery grid view
- Full-screen photo viewer with swipe

### Week 5: Materials & Expenses
- Material entry form
- Expense entry form
- Receipt photo upload
- List views (pending/approved)
- Edit/delete pending items
- Category dropdowns

### Week 6: Notes & Client Communication
- Notes form with categories
- Note timeline view
- SMS quick messages
- SMS custom message
- Client list screen
- Client detail screen
- Call/SMS/Email integrations

### Week 7: Calendar
- Calendar library integration (react-native-calendars)
- Day view (timeline)
- Week view (7 columns)
- Month view (grid)
- Event color coding
- Tap to open job
- "Today" button

### Week 8: Quick Invoicing
- Invoice form
- Auto-populate from job
- Line item editor (add/edit/delete)
- PDF preview (WebView)
- Send via email/SMS
- Mark as sent

### Week 9: Approvals (Admin)
- Approval queue lists
- Timesheet approval
- Expense approval
- Material approval
- Bulk approve
- Rejection with reason

### Week 10: Reports & Polish
- Revenue report view
- Time tracking report view
- Team performance view
- Chart display (react-native-chart-kit)
- CSV export
- Performance optimization
- Bug fixes
- Beta testing prep

---

## 🎯 Success Metrics

### Development KPIs
- **Test Coverage**: >70% for business logic
- **Build Time**: <10 minutes for preview builds
- **App Size**: <50MB (optimize images, code splitting)
- **Crash-Free Rate**: >99.5%

### Performance KPIs
- **App Launch**: <2 seconds (cold start)
- **Job List Load**: <1 second
- **Photo Upload**: <5 seconds
- **Timer Accuracy**: ±1 second

### User Experience KPIs
- **Daily Active Users**: 80%+ of team members
- **Time Tracking Adoption**: 90%+ of jobs
- **Photo Capture**: Average 3+ photos per job
- **User Retention**: >80% after 30 days

---

## 🛡️ Security Best Practices

### 1. Token Storage
```typescript
// Use expo-secure-store for tokens (encrypted keychain)
import * as SecureStore from 'expo-secure-store'

await SecureStore.setItemAsync('userToken', token)
const token = await SecureStore.getItemAsync('userToken')
```

**Never use AsyncStorage for tokens!** (Unencrypted)

### 2. API Communication
- Always HTTPS (Vercel provides this)
- JWT tokens in Authorization header
- Validate tokens on backend (already implemented)
- Refresh tokens automatically

### 3. Photo/File Uploads
- Upload directly to Vercel Blob (presigned URLs)
- Validate file types and sizes
- Compress images before upload (expo-image-manipulator)

### 4. Permissions
```typescript
// Request permissions at point of use
import * as ImagePicker from 'expo-image-picker'

const { status } = await ImagePicker.requestCameraPermissionsAsync()
if (status !== 'granted') {
  alert('Camera permission is required to take photos')
}
```

### 5. Offline Support
- Cache sensitive data encrypted
- Clear cache on logout
- Sync queue encrypted

---

## 💡 Pro Tips

1. **Test on Real Devices Early**
   - Simulators don't catch everything (camera, GPS, performance)

2. **Use Expo Go for Rapid Iteration**
   - Don't build until beta testing phase
   - Instant reload saves hours per day

3. **Optimize Images**
   - Use WebP format
   - Compress before upload
   - Use appropriate dimensions (don't upload 4K photos)

4. **Handle Offline Gracefully**
   - Show clear offline indicators
   - Queue operations when offline
   - Sync automatically when online

5. **Follow Platform Conventions**
   - iOS: Swipe back gesture, action sheets
   - Android: Hardware back button, FAB

6. **Keep API Responses Small**
   - Mobile networks are slower
   - Paginate large lists
   - Use thumbnails for images

7. **Battery Optimization**
   - Stop timer when job completed
   - Limit background location updates
   - Throttle API polling

8. **Accessibility**
   - Use accessible={true}
   - Provide accessibilityLabel
   - Test with VoiceOver/TalkBack

---

## 📚 Learning Resources

### Official Documentation
- **Expo**: https://docs.expo.dev/
- **React Native**: https://reactnative.dev/
- **React Query**: https://tanstack.com/query/latest
- **Clerk Expo**: https://clerk.com/docs/quickstarts/expo
- **React Native Paper**: https://callstack.github.io/react-native-paper/

### Video Tutorials
- **Expo YouTube**: https://www.youtube.com/@expo
- **William Candillon**: React Native animations
- **Traversy Media**: React Native crash courses

### Communities
- **Expo Discord**: https://chat.expo.dev/
- **React Native Discord**: https://discord.gg/react-native
- **Stack Overflow**: #react-native tag

---

## 🚦 Getting Started Checklist

### Prerequisites
- ✅ Node.js 18+ installed
- ✅ Git installed
- ✅ VS Code installed
- ✅ Physical iOS/Android device (for testing)

### Setup Steps
1. ☐ Install Expo Go app on phone (iOS/Android)
2. ☐ Install VS Code extensions (listed above)
3. ☐ Create Expo account (free): https://expo.dev/signup
4. ☐ Install EAS CLI: `npm install -g eas-cli`
5. ☐ Navigate to mobile app: `cd apps/mobile`
6. ☐ Install dependencies: `npm install`
7. ☐ Start dev server: `npm start`
8. ☐ Scan QR code with Expo Go
9. ☐ Start coding! Edit `app/index.tsx` and see changes instantly

### First Task: Hello World
```typescript
// app/index.tsx
import { Text, View } from 'react-native'

export default function Index() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>
        Welcome to Tradie App Mobile! 🚀
      </Text>
    </View>
  )
}
```
Save → See changes on device instantly!

---

## Summary

**Platform:** React Native + Expo (managed workflow)
**IDE:** VS Code (same as web!)
**Testing:** Expo Go (instant testing on your phone) + Jest
**Deployment:** EAS Build → TestFlight/Play Store
**Timeline:** 10 weeks for full-featured MVP
**Infrastructure:** Reuses all existing Next.js APIs ✅

**The Magic:**
- Write code in VS Code
- Save file
- See changes on your phone instantly
- No Xcode/Android Studio needed (for most development)
- Share with team by sending them a QR code

**Ready to build!** 🎉
