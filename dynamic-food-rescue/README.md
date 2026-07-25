# 🍽️ Dynamic Food Rescue – Complete Project Documentation

> **A real‑time, mobile‑first platform that reduces food waste by connecting grocery stores with consumers through dynamic discounts and free donations.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Vercel](https://img.shields.io/badge/deployed%20on-Vercel-black)](https://vercel.com)

---

## 📖 Table of Contents

- [Project Overview](#-project-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Getting Started](#-getting-started)

## 🌍 Project Overview

**Dynamic Food Rescue** tackles one of the most pressing global challenges – food waste. In Nepal, grocery chains discard **30% of fresh produce** solely due to sell‑by dates, even though the food is still perfectly edible.

Our platform provides:

- **Real‑time dynamic discounts** on soon‑to‑expire items.
- **Seamless reservation** with a 60‑minute pickup window.
- **QR code** and **pickup code** for frictionless in‑store pickup.
- **Flexible payments** via eSewa (online) or cash on pickup.
- **Free donation** of surplus food to charities.
- **Full‑featured dashboards** for both shoppers and store vendors.

**The result:** less waste, recovered revenue, affordable food, and a cleaner planet.

---

## ✨ Features

### 👤 User (Shopper)
- **Location‑based deals** – find discounts near you (sorted by distance).
- **Reserve & pick up** – one‑tap reservation with 60‑minute window.
- **QR & pickup code** – easy verification at the store.
- **Multiple payment methods** – eSewa or cash on pickup.
- **Optional delivery** – have your order delivered (₹200 fee).
- **Free Food** – claim surplus donations from stores.
- **User Dashboard** – impact stats (food/money/CO₂ saved), order history, nearby stores, flash alerts, smart recommendations, rated stores, and vendor notes.
- **Rate & chat** – rate stores and bargain with vendors via real‑time chat.
- **In‑app notifications** – alerts for vendor notes, reminders, and donation claims.

### 🏪 Vendor (Store)
- **Store setup** – create and manage store profile.
- **Product management** – add/edit/delete products (name, category, unit, price, discount, sell‑by, quantity).
- **Reservation management** – view active reservations, mark as picked up, mark as paid, send notes to users.
- **Delivery management** – view delivery address and status, update delivery status.
- **Analytics dashboard** – revenue, orders, ratings, and weekly trends (charts).
- **Donations** – list surplus food for free; see claimed donations; mark as picked up.
- **Subscription** – 10‑day free trial, then ₹1000/month (pay via eSewa).
- **Notifications** – receive alerts when users claim donations or make reservations.

### 🔧 Admin
- **Admin Dashboard** – overview of all stores, products, reservations, revenue, and subscription status.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite, TypeScript |
| **Styling** | Tailwind CSS, shadcn/ui |
| **State & Forms** | React Context, React Hook Form, Zod |
| **Animations** | Framer Motion |
| **Routing** | React Router v6 (role‑based guards) |
| **Backend** | Supabase (PostgreSQL, Auth, Realtime, Row‑Level Security) |
| **Payments** | eSewa (test & production) |
| **Workflow Automation** | n8n Cloud (scheduled jobs) |
| **Hosting** | Vercel (frontend) / Supabase (backend) |

---

## 🏗️ Architecture (Textual Description)

The application is designed as a modern **React Single Page Application** (SPA) that communicates with a **Supabase** backend. The frontend is built with **Vite** and **TypeScript**, styled with **Tailwind CSS**, and enhanced with **shadcn/ui** components. All pages are wrapped with **Framer Motion** for smooth transitions, and routing is handled by **React Router** with role‑based guards.

### High‑Level Components

1. **Frontend (Vercel)** – Serves the React app.  
   - **Public pages:** Login, Signup, Payment success/failure.  
   - **User‑protected pages:** Deals, Reservation, User Dashboard, Free Food, Notifications.  
   - **Vendor‑protected pages:** Vendor Dashboard, Product Management, Subscription.  
   - **Admin‑protected pages:** Admin Dashboard.

2. **Backend (Supabase)** – Provides everything:  
   - **PostgreSQL database** with tables for stores, products, inventory, reservations, donations, subscriptions, etc.  
   - **Authentication** (email/password) with built‑in session management.  
   - **Realtime** – WebSocket subscriptions that push inventory, product, and donation changes to all connected clients.  
   - **Row‑Level Security (RLS)** – ensures that users can only access data they are allowed to see (e.g., vendor sees only their store’s data).  
   - **Edge Functions** (optional) – used for eSewa payment callbacks and subscription activation.

3. **Payment Gateway (eSewa)** – Handles online payments:  
   - Users initiate payment from the Reservation page.  
   - eSewa redirects to a success or failure URL, which triggers Supabase updates (e.g., marking a reservation as paid, activating a subscription).

4. **Workflow Automation (n8n Cloud)** – Runs background jobs:  
   - **Discount updater** – recalculates discounts based on remaining sell‑by time (every 15 minutes).  
   - **Reservation expiry** – releases inventory and marks expired reservations (every minute).

### Data Flow

- **Reservation flow:**  
  User clicks “Reserve” → Frontend calls `reserve_item` RPC → Locks inventory row → Updates `reserved` count → Inserts reservation row → Returns pickup code → Frontend displays QR code and starts countdown timer.

- **Real‑time sync:**  
  Any change to `inventory`, `products`, or `reservations` is broadcast via Supabase Realtime. All active clients receive the update and refresh their UI (e.g., available stock decreases automatically, new deals appear, etc.).

- **Payment flow:**  
  User selects eSewa → Frontend creates a form and submits to eSewa → eSewa redirects to `/payment‑success` with `pid` (transaction ID) → Success page updates the relevant reservation or subscription status via Supabase.

- **Donation flow:**  
  Vendor adds a donation → Insert into `donations` table → Realtime broadcasts it → User sees it on the “Free Food” page → User clicks “Claim” → Updates status to `claimed` and notifies the vendor.

- **Subscription flow:**  
  Vendor visits `/vendor/subscribe` → Selects a plan → Clicks “Subscribe” → Creates a pending subscription → Redirects to eSewa → Payment success activates the subscription; payment failure deletes the pending record.

The architecture is fully serverless, using Supabase for all backend services and Vercel for the frontend, making it scalable, cost‑effective, and easy to maintain.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** v18 or higher
- **npm** or **yarn**
- A **Supabase** account (free tier)
### Installation
''bash
git clone https://github.com/ukharel/GMC_ChillPill.git
cd dynamic-food-rescue
npm install

### Packages

# Install core dependencies
npm install @supabase/supabase-js @supabase/auth-ui-react react-router-dom react-hook-form zod @hookform/resolvers/zod sonner lucide-react react-qr-code i18next react-i18next recharts framer-motion

# Install dev dependencies
npm install -D tailwindcss postcss autoprefixer @types/node @types/react @types/react-dom @typescript-eslint/eslint-plugin @typescript-eslint/parser @vitejs/plugin-react eslint eslint-plugin-react-hooks eslint-plugin-react-refresh typescript vite

# Initialize Tailwind
npx tailwindcss init -p

# Initialize shadcn/ui
npx shadcn-ui@latest init

# Add shadcn components
npx shadcn-ui@latest add button input card badge


