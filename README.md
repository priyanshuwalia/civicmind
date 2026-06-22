# CivicMind 🏙️
### AI-Agentic Municipal Infrastructure Management & Predictive Resolution Platform

CivicMind is an agent-driven municipal infrastructure management and community-led civic action platform. It takes unstructured citizen reports (informal descriptions, location selections) and pipelines them through a multi-agent system of six specialized AI agents powered by Gemini. These agents classify, verify, impact-assess, prioritize, and cost-estimate the work orders, saving municipalities manual coordination costs and forecasting utility failures before they happen.

The platform uses an open-source, keyless **Leaflet Maps API** (with OpenStreetMap tiles) for mapping, providing instant geolocation and reverse-geocoding capability.

---

## 🚀 Key Features

* **Zero-Friction Reporting**: Citizens double-click or tap on the map to place a pin, write a brief description in natural language, and submit.
* **Leaflet + OSM Tiles Map**: Center automatically at the user's current location, drop pins, and render predictive failure circles without needing proprietary maps keys.
* **Geocoding Support**: Asynchronously queries OpenStreetMap's Nominatim reverse-geocoder on map clicks to resolve coordinates into readable street addresses.
* **Multi-Agent Orchestrator**: Sequentially chains 6 agents:
  1. **Intake Agent**: Classifies issue domain and extracts initial hazard severity.
  2. **Verification Agent**: Identifies nearby duplicate tickets and tracks verification confidence.
  3. **Impact Agent**: Measures demographic/proximity footprints (e.g. distance to schools or hospitals).
  4. **Prioritization Agent**: Runs a composite priority calculation to rank tickets (Low, Medium, High, Critical).
  5. **Resolution Agent**: Directs tickets to municipal departments and generates action lists, durations, and cost estimates.
  6. **Prediction Agent**: Clusters incidents to model future asset failure zones.
* **Persistent PostgreSQL Backend**: Connects to a live database storing all incidents, evidence comments, and predictions.

---

## 🛠️ Tech Stack

* **Frontend**: React 19, Vite, Tailwind CSS, Lucide icons.
* **Mapping**: Leaflet Maps API, OpenStreetMap, Nominatim reverse-geocoding.
* **Backend**: Express, Node.js, tsx.
* **Database**: PostgreSQL (Docker-based), pg client.
* **AI Model Orchestration**: Vertex AI / Gemini SDK (`gemini-3.5-flash`).

---

## 📋 Environment Variables

A `.env.example` file is included in the project. Create a `.env.local` (for development) or `.env` file in the root directory and define the following variables:

```bash
# GEMINI_API_KEY: Obtain from Google AI Studio. 
# If not provided, the backend falls back to simulated agent responses.
GEMINI_API_KEY="your_gemini_api_key_here"

# APP_URL: The URL where the client and server are hosted.
APP_URL="http://localhost:3000"

# DATABASE_URL: Local PostgreSQL database connection URI.
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/civicmind"
```

---

## ⚙️ Local Setup Guide

Follow these steps to set up and launch CivicMind on your local computer.

### Prerequisites
* **Node.js** (v18 or higher recommended)
* **Docker Engine** (for running PostgreSQL)
* **Git**

---

### Step 1: Clone and Install Dependencies
Initialize Git (if not already done) and download npm packages:
```bash
git init
npm install
```

### Step 2: Set Up the PostgreSQL Database
Launch a PostgreSQL instance in Docker. This exposes the database on port `5432` with username `postgres`, password `postgres`, and database name `civicmind`:
```bash
docker run -d \
  --name civicmind-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=civicmind \
  -p 5432:5432 \
  postgres:15
```

You can check that the container is running by typing:
```bash
docker ps
```

### Step 3: Configure Environment Variables
Create a file named `.env.local` in the project root:
```bash
cp .env.example .env.local
```
Open `.env.local` and paste your Google Gemini API key into the `GEMINI_API_KEY` slot.

### Step 4: Run the Development Server
Launch the application:
```bash
npm run dev
```

* The server will boot, connect to PostgreSQL, and automatically run `initDb()` which:
  1. Creates the necessary tables (`incidents`, `evidence`, and `predictions`).
  2. Seeds initial incidents and predicted failure zones if the database is blank.
* Open your browser and navigate to **[http://localhost:3000](http://localhost:3000)**.
* Grant location permissions when prompted to center the map at your current location.

### Step 5: Test the System End-to-End
1. **Citizen Submission**:
   * Navigate to the **Citizen Portal** in the navigation toggle.
   * Go to "File New Complaint".
   * Click "Pick on Map" and click a point on the map. Verify that the address text field updates with your correct street name.
   * Enter a headline (e.g. "Pavement buckling near school") and details, then click "Launch AI Intake Agent Analysis".
2. **AI Orchestration**:
   * Toggle to the **Control Tower** role in the navigation bar.
   * Click your newly submitted incident in the list.
   * Click **Run Agentic Pipeline** to execute the multi-agent cascade. Watch the live thought panel reveal the reasoning of the Intake, Verification, Impact, Prioritization, and Resolution agents.
3. **Operator Overrides**:
   * Inspect the auto-generated dispatch plans and budget estimates. Override the priority rank or department and click **Approve Dispatch**. The status will persist as `RESOLVING` in PostgreSQL.

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
