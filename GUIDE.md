# Apex CRM — Complete Build Guide

## What you're building
A clean, corporate-grade CRM with 5 sections:
- **Dashboard** — live stats + recent activity overview
- **Contacts** — add, search, and delete clients
- **Pipeline** — 4-stage deal board (Lead → Qualified → Proposal → Won)
- **Tasks** — checkable to-dos with due dates
- **Notes** — timestamped activity log

All data persists in `localStorage` — nothing is lost on refresh.

---

## Project file structure

```
apex-crm/
├── public/
│   └── index.html          ← HTML shell + Google Fonts
├── src/
│   ├── index.js            ← React entry point
│   ├── index.css           ← Global styles + CSS variables
│   ├── App.jsx             ← Layout: sidebar + topbar + routing
│   ├── data/
│   │   └── seed.js         ← Sample data for first load
│   ├── hooks/
│   │   └── useStore.js     ← All state + localStorage logic
│   └── components/
│       ├── UI.jsx          ← Shared: Avatar, Badge, Card, etc.
│       ├── Modal.jsx       ← Reusable modal + form inputs
│       ├── Dashboard.jsx   ← Dashboard view
│       ├── Contacts.jsx    ← Contacts view
│       ├── Pipeline.jsx    ← Pipeline / deals view
│       ├── Tasks.jsx       ← Tasks view
│       └── Notes.jsx       ← Notes / activity log view
└── package.json
```

---

## Step-by-step setup

### Step 1 — Prerequisites
Make sure you have **Node.js** installed (v16 or higher):
```bash
node -v   # should print v16 or higher
npm -v    # should print 8 or higher
```
Download Node.js from: https://nodejs.org

---

### Step 2 — Create the project folder
```bash
mkdir apex-crm
cd apex-crm
```

---

### Step 3 — Copy all files
Copy each file from this package into the matching path in your `apex-crm/` folder. Make sure to preserve the folder structure exactly:
```
apex-crm/public/index.html
apex-crm/src/index.js
apex-crm/src/index.css
apex-crm/src/App.jsx
apex-crm/src/data/seed.js
apex-crm/src/hooks/useStore.js
apex-crm/src/components/UI.jsx
apex-crm/src/components/Modal.jsx
apex-crm/src/components/Dashboard.jsx
apex-crm/src/components/Contacts.jsx
apex-crm/src/components/Pipeline.jsx
apex-crm/src/components/Tasks.jsx
apex-crm/src/components/Notes.jsx
apex-crm/package.json
```

---

### Step 4 — Install dependencies
```bash
npm install
```
This will install React and Create React App. It takes about 1–2 minutes.

---

### Step 5 — Run the app
```bash
npm start
```
The browser will open automatically at **http://localhost:3000**

---

### Step 6 — Build for production (when ready to deploy)
```bash
npm run build
```
This creates a `build/` folder with a fully optimized app ready to upload to any host (Netlify, Vercel, GitHub Pages, etc.).

---

## How each file works

### `package.json`
Tells npm what packages to install. The three dependencies are `react`, `react-dom`, and `react-scripts` (Create React App).

### `public/index.html`
The HTML shell. React injects your app into the `<div id="root">`. Also loads Inter font from Google Fonts.

### `src/index.css`
CSS variables define all colors (`--bg`, `--card-bg`, `--accent`, etc.). Changing `--accent` from `#185FA5` to any color instantly rebrands the whole app.

### `src/data/seed.js`
Sample contacts, deals, tasks, and notes shown on first load. After first use, real data from `localStorage` takes over.

### `src/hooks/useStore.js`
The brain of the app. Stores all state and saves every change to `localStorage`. Exposes:
- `contacts`, `deals`, `tasks`, `notes` — the data arrays
- `addContact()`, `addDeal()`, `addTask()`, `addNote()` — create records
- `toggleTask()` — flip done/undone
- `deleteContact()`, `deleteDeal()`, `deleteTask()`, `deleteNote()` — remove records
- `stats` — live counts for the dashboard

### `src/components/UI.jsx`
Shared building blocks used across every view:
- `<Avatar>` — colored initials circle
- `<Badge>` — colored status pill
- `<Card>` — white rounded container
- `<SectionTitle>` — uppercase label
- `<IconBtn>` — hover-aware icon button

### `src/components/Modal.jsx`
Reusable modal dialog with `<FormGroup>`, `<Input>`, `<Select>`, `<Textarea>`. Press Escape or click outside to close.

### `src/App.jsx`
The main layout: sidebar navigation + top search bar + content area. Uses React state to track which view is active. The sidebar shows a blue badge on Tasks when there are pending tasks.

---

## Customization guide

### Change the brand name
In `App.jsx`, find:
```jsx
Apex <span>CRM</span>
```
Replace "Apex" with your client's company name.

### Change the accent color
In `index.css`, find:
```css
--accent: #185FA5;
```
Change the hex to any color. All buttons, highlights, and active states update automatically.

### Add a new pipeline stage
In `Pipeline.jsx`, find:
```js
const STAGES = ["Lead", "Qualified", "Proposal", "Won"];
```
Add your new stage to the array. Then add a matching color in `STAGE_COLORS`.

### Add a new contact field
1. Add the field to the `blank()` function in `Contacts.jsx`
2. Add a `<FormGroup>` + `<Input>` in the modal JSX
3. Display it in the contact row

### Reset all data (start fresh)
Open browser DevTools → Application → Local Storage → delete all `crm_*` keys. Refresh the page.

---

## Why this is better than a spreadsheet or off-the-shelf CRM

| Feature | Spreadsheet | Salesforce / HubSpot | This CRM |
|---|---|---|---|
| Setup time | Minutes | Days / weeks | 5 minutes |
| Learning curve | Low | Very high | None |
| Monthly cost | Free | $25–$300/user | Free |
| Custom fields | Manual | Complex | Edit the code |
| Data ownership | Google/Microsoft | Vendor | You own it |
| Performance | Slow at scale | Fast | Instant |

---

## Troubleshooting

**`npm start` fails with "command not found"**
→ Install Node.js from https://nodejs.org

**White screen after starting**
→ Check the terminal for error messages. Most common cause: missing file or typo in a filename.

**Data not saving between refreshes**
→ Make sure your browser allows localStorage. Incognito mode blocks it.

**Port 3000 already in use**
→ npm will ask if you want to use a different port. Press Y.
