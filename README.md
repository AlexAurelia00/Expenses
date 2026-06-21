# Expense Sharing Application (Splitwise Clone)

A complete production-ready Expense Sharing & Split Management Web Application built with **React.js (Vite)**, **Node.js (Express)**, and **Supabase (PostgreSQL, Auth, Storage)**.

---

## Architecture & Features

```
[ React + Vite Frontend ]  ----( HTTP + Bearer JWT )----> [ Node.js Express Backend ]
          |                                                       |
   (Direct Uploads)                                        (PG client & RPCs)
          |                                                       |
          v                                                       v
[ Supabase Storage & Auth ]                               [ Supabase PostgreSQL ]
```

- **Authentication**: Fully secure email+password sign up, email verification, session recovery, password reset, and account deletion.
- **Group Management**: Create groups, add/remove members, support multiple admins, and configure custom group currencies.
- **Dynamic Split Calculations**:
  - **Equal Split**: Split bill evenly among selected participants.
  - **Exact Split**: Enter custom amounts per participant (validated to sum to the bill total).
  - **Percentage Split**: Split by percentage allocation (validated to sum to 100%).
  - **Shares Ratio**: Distribute shares (e.g., A=2 shares, B=1, C=1) and calculate amounts.
- **Smart Debt Simplification**: Built-in greedy matching algorithm to minimize overall payment transfers among members (Who owes whom).
- **Reports & Data Export**: Aggregate expenditures and download histories in **PDF**, **Excel (XLSX)**, and **CSV** formats.
- **Notifications**: Live in-app alert bells paired with SMTP email notifications for new bills, settlement receipts, and group invites.
- **Security & RLS**: Helmet headers, global IP rate-limiting, CORS whitelisting, input sanitizations, and Row Level Security (RLS) policies.

---

## Step-by-Step Supabase Setup

Follow these instructions to set up your database, authentication, and file storage on Supabase:

### 1. Create a Supabase Account & Project
1. Go to [supabase.com](https://supabase.com) and click **Sign Up** or **Sign In**.
2. Click **New Project** in your dashboard, select an organization (or create one), and fill in:
   - **Name**: `Splitwise-Clone`
   - **Database Password**: Write this down safely.
   - **Region**: Choose a region close to your users.
   - **Pricing Tier**: Select the **Free Tier**.
3. Click **Create new project** and wait a few minutes for the database provisioning to complete.

### 2. Retrieve Project Credentials
Once your project is ready, navigate to the settings:
1. In the sidebar, go to **Settings** (Gear icon) -> **API**.
2. Under **Project API keys**, copy the following values:
   - **Project URL** (e.g. `https://your-project-id.supabase.co`)
   - **Anon Key** (under `anon public`)
   - **Service Role Key** (under `service_role` - click reveal. Keep this key secret, do not commit it).
3. Under **JWT Settings**, copy the **JWT Secret** string. This is used by the backend to verify client credentials.

### 3. Run Database Migrations
1. In your Supabase sidebar, click on **SQL Editor** (Query editor icon).
2. Click **New Query** -> **Create a blank query**.
3. Open the migration file: `supabase/migrations/20260621000000_schema.sql`.
4. Copy its entire content, paste it into the Supabase SQL editor, and click **Run**.
5. You should see a success message indicating that tables, indexes, triggers, and RLS policies have been successfully created.

### 4. Configure Storage Buckets
The application requires storage buckets to store user avatars and receipt images:
1. In your Supabase sidebar, click on **Storage** (Bucket icon).
2. Click **New Bucket**.
3. Set the Bucket Name to **`avatars`**.
4. **Important**: Toggle the **Public** switch to **ON** (so images are accessible via public URLs).
5. Click **Create Bucket**.
6. Repeat the steps to create another public bucket named **`receipts`** for invoice uploads.

---

## Configuration & Environment Variables

Make sure to configure the `.env` settings before launching the servers.

### Backend Configurations (`backend/.env`)
Create/edit `backend/.env` file with your credentials:
```env
PORT=5000
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_JWT_SECRET=your-supabase-jwt-secret

# SMTP Mail Server settings (for invites & settlements)
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_FROM=noreply@splitwiseclone.com
```
*Note: If `SMTP_USER` and `SMTP_PASS` are left empty, the server automatically defaults to logging notifications/invitations inside the console log for testing.*

### Frontend Configurations (`frontend/.env`)
Create/edit `frontend/.env` file:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_API_URL=http://localhost:5000
```

---

## Running Locally

### Option A: Local Nodes Development

Open a terminal at the project root directory and follow these steps:

#### 1. Start the Backend Server
```bash
cd backend
npm install
npm run dev
```
The backend server will launch on `http://localhost:5000`.

#### 2. Start the Frontend Dev Server
Open a second terminal window:
```bash
cd frontend
npm install
npm run dev
```
The frontend Vite server will launch on `http://localhost:3000`.

---

### Option B: Docker Compose (All Services)

You can launch both frontend, backend, and proxies instantly using Docker:
1. Ensure Docker Desktop is installed and running on your system.
2. Edit the environment variables inside `docker-compose.yml` file to match your Supabase credentials.
3. Open a terminal at the project root directory and run:
```bash
docker-compose up --build
```
4. Access the web app at `http://localhost:3000` (proxied request calls automatically bridge to backend container).

---

## Database Security: Row Level Security (RLS)

The database enforces security at the PostgreSQL layer using Supabase Auth claims:
- **`profiles`**: Public readable (so users can search by email to add members), write access is only granted to owner (`auth.uid() = id`).
- **`groups`**: Read/write access is restricted to group members. Only group admins can update group descriptions/image settings.
- **`group_members`**: Read access is restricted to active members. Only admins can remove members or promote roles.
- **`expenses` / `splits` / `settlements`**: Restrict select/insert/update queries to active members of the associated group.
- **`notifications`**: Private read/write only visible to the user owner (`user_id = auth.uid()`).
