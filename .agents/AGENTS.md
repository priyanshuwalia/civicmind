# CivicMind AI Agent System Specifications

Welcome to the official Agent Specification for **CivicMind**. This document acts as the source of truth for the multi-agent orchestration layer, detailing the roles, scopes, reasoning patterns, and inter-agent coordination mechanisms.

---

## 1. System Vision & Objective
CivicMind is an agent-driven municipal infrastructure management and community reporting system. It transforms raw, chaotic public incident reports into structured, verified, prioritized, and routed municipal work orders. It also performs predictive infrastructure threat modeling.

By transitioning from Google Maps API to **Leaflet Maps API**, the system eliminates API cost barriers, guarantees offline-first capabilities, and provides maximum layout customizability for dense geographical visualizations.

---

## 2. Multi-Agent Orchestration Layer
The system employs six specialized agents that run sequentially or in parallel clusters to process tickets and model city risk.

### Agent 1: Intake Agent
* **Role**: Primary Classifier & Parser
* **Objective**: Process unstructured public citizen text and image data, sanitizing inputs, classifying the issue type, and estimating initial severity.
* **Problem Domains**: Road Infrastructure, Water & Sewage, Power & Grid, Sanitation, Parks & Safety.
* **Severity Range**: 1 (Inconvenience) to 5 (Extreme Life Safety Threat).

### Agent 2: Verification Agent
* **Role**: Integrity & Duplicate Detector
* **Objective**: Correlate new submissions against active incidents within a 500-meter radius. Analyze semantic and telemetry data to prevent duplicate tickets and combat spam reports.

### Agent 3: Impact Agent
* **Role**: GIS & Demographic Analyst
* **Objective**: Measure the societal, commercial, and physical footprint of the issue. Integrate with density vectors (schools, hospitals, main transit routes, high-density residential grids) to yield an impact score from 1 to 5.

### Agent 4: Prioritization Agent
* **Role**: Operational Router & Ranker
* **Objective**: Execute mathematical priority indexing using the composite formula:
  $$\text{Priority Score} = \text{Severity} + \text{Impact} + (\text{Verification Confidence} \times 2) + \text{Age Factor}$$
  Ranks issues into **LOW**, **MEDIUM**, **HIGH**, or **CRITICAL** tiers, establishing escalation level protocols.

### Agent 5: Resolution Agent
* **Role**: Financial & Logistical Planner
* **Objective**: Assign issues to the correct municipal authority, generate step-by-step action plans, and estimate repair costs (USD) and timelines based on historic contractor contracts.

### Agent 6: Prediction Agent
* **Role**: Proactive Threat Forecaster
* **Objective**: Synthesize city sensor readings, age of infrastructure, and active report clusters to map high-risk vulnerability zones and predict failures (e.g., water main bursts, substation overloads) before they occur.

---

## 3. Map Engine Guideline
* **Engine**: Leaflet Maps API (with free OpenStreetMap tiles).
* **Requirements**: Custom glassmorphic map cards, responsive zoom, markers styled dynamically based on status colors, circle overlays for predictive risk zones, and a simple double-click or drag-pin selector for citizen reports.
