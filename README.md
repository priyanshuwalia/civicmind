# CivicMind 🏙️
### AI-Agentic Municipal Infrastructure Management & Predictive Resolution Platform

CivicMind is an agent-driven municipal infrastructure management and community-led civic action platform. It takes unstructured citizen reports (informal descriptions, location selections) and pipelines them through a multi-agent system of six specialized AI agents powered by Gemini. These agents classify, verify, impact-assess, prioritize, and cost-estimate the work orders, saving municipalities manual coordination costs and forecasting utility failures before they happen.

The platform uses an open-source, keyless **Leaflet Maps API** (with OpenStreetMap tiles) for mapping, providing instant geolocation and reverse-geocoding capability.

---

## 🚀 Key Features

* **Authenticated Contribution Security**: Secure Login & Signup gate using Firebase Authentication. Users choose Citizen or Operator roles which authorize their portal visibility.
* **Zero-Friction Reporting**: Citizens double-click or tap on the map to place a pin, write a brief description in natural language, and submit.
* **Leaflet + OSM Tiles Map**: Center automatically at the user's current location, drop pins, and render predictive failure circles without needing proprietary maps keys.
* **Geocoding Support**: Asynchronously queries OpenStreetMap's Nominatim reverse-geocoder on map clicks to resolve coordinates into readable street addresses.
* **Multi-Agent Orchestrator**: Sequentially chains 6 agents (Intake, Verification, Impact, Prioritization, Resolution, Prediction) on incident tickets.
* **Firebase Firestore & Storage Integration**: Fast cloud storage for images and document records, replacing local filesystem uploads and PostgreSQL databases.
* **Gamified Citizen Leagues**: Track contributions dynamically (Bronze, Silver, Gold, Platinum, Diamond) based on submissions, evidence logs, and verification votes.

---

## 🛠️ Tech Stack

* **Frontend**: React 19, Vite, Tailwind CSS, Lucide icons, Firebase Client SDK (Auth).
* **Mapping**: Leaflet Maps API, OpenStreetMap, Nominatim reverse-geocoding.
* **Backend**: Express, Node.js, tsx, Firebase Admin SDK.
* **Database & Cloud Storage**: Firebase Firestore, Firebase Storage.
* **AI Model Orchestration**: Vertex AI / Gemini SDK (`gemini-3.5-flash`).

---

## 📋 Environment Variables

A `.env.example` file is included in the project. Create a `.env` file in the root directory and define the following variables:

```bash
# GEMINI_API_KEY: Obtain from Google AI Studio.
GEMINI_API_KEY="your_gemini_api_key_here"

# APP_URL: The URL where the client and server are hosted.
APP_URL="http://localhost:3000"

# FIREBASE SERVICE ACCOUNT (Server configuration)
FIREBASE_SERVICE_ACCOUNT='{"type": "service_account", "project_id": "...", ...}'
FIREBASE_STORAGE_BUCKET="your-project-id.appspot.com"

# FIREBASE CLIENT WEB CONFIGURATION (Frontend configuration)
VITE_FIREBASE_API_KEY="your-api-key"
VITE_FIREBASE_AUTH_DOMAIN="your-project-id.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="your-project-id"
VITE_FIREBASE_STORAGE_BUCKET="your-project-id.appspot.com"
VITE_FIREBASE_MESSAGING_SENDER_ID="your-messaging-sender-id"
VITE_FIREBASE_APP_ID="your-app-id"
```

---

## ⚙️ Local Setup Guide

Follow these steps to set up and launch CivicMind on your local computer.

### Prerequisites
* **Node.js** (v18 or higher recommended)
* **Firebase Project**: Create a free project in the Firebase Console.
  * Enable **Authentication** (Email/Password provider).
  * Enable **Firestore Database**.
  * Enable **Cloud Storage**.
* **Git**

---

### Step 1: Clone and Install Dependencies
Initialize Git (if not already done) and download npm packages:
```bash
git init
npm install
```

### Step 2: Configure Environment Variables
Create a file named `.env` in the project root:
```bash
cp .env.example .env
```
1. Open the `.env` file.
2. Under Firebase Console -> Project Settings -> General -> Your Apps, click **Web App** (or create one) to copy the VITE_FIREBASE Client Configuration keys.
3. Under Project Settings -> Service Accounts, click **Generate new private key**. Convert the generated JSON file contents into a single line string and paste it into the `FIREBASE_SERVICE_ACCOUNT` value.

### Step 3: Run the Development Server
Launch the application:
```bash
npm run dev
```

* The server will boot, initialize Firebase Firestore/Storage, and seed initial competitor users for the leaderboard.
* Open your browser and navigate to **[http://localhost:3000](http://localhost:3000)**.
* Register or log in to access the portal views.

---

## 📦 Building for Production

To create an optimized production bundle containing the static assets and the Express build:
```bash
npm run build
```

Verify type-safety by running typecheck:
```bash
npm run lint
```

