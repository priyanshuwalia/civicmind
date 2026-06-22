import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { Incident, PredictionData, RiskZone, PredictedFailure } from "./src/types";
import pg from "pg";

dotenv.config();

const { Pool } = pg;
const app = express();
const PORT = 3000;

// Set body size limit to 10mb to support base64 image uploads
app.use(express.json({ limit: "10mb" }));

// Initialize Gemini SDK with User-Agent telemetry
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    })
  : null;

// Connect to local PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/civicmind"
});

// Helper: map a Postgres DB row to the frontend TypeScript Incident interface
function rowToIncident(row: any, evidenceRows: any[] = []): Incident {
  return {
    id: row.id,
    title: row.title,
    rawDescription: row.raw_description,
    imageUrl: row.image_url || undefined,
    location: {
      lat: Number(row.lat),
      lng: Number(row.lng),
      address: row.address,
    },
    reporter: {
      name: row.reporter_name,
      email: row.reporter_email,
      avatar: row.reporter_avatar || undefined,
    },
    createdAt: new Date(row.created_at).toISOString(),
    status: row.status,
    upvotes: Number(row.upvotes),
    downvotes: Number(row.downvotes),
    evidence: evidenceRows.map(ev => ({
      id: ev.id,
      author: ev.author,
      text: ev.text,
      createdAt: new Date(ev.created_at).toISOString()
    })),
    intake: row.intake || undefined,
    verification: row.verification || undefined,
    impact: row.impact || undefined,
    prioritization: row.prioritization || undefined,
    resolution: row.resolution || undefined,
  };
}

// Helper: Reward points and update user profile stats in PostgreSQL
async function rewardPoints(email: string, name: string, points: number, fieldToIncrement?: "reports_filed" | "evidence_submitted") {
  const avatar = `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 5000000)}?auto=format&fit=crop&q=80&w=100`;
  
  if (fieldToIncrement === "reports_filed") {
    await pool.query(
      `INSERT INTO users (email, name, avatar, points, reports_filed)
       VALUES ($1, $2, $3, $4, 1)
       ON CONFLICT (email) DO UPDATE 
       SET name = $2, points = users.points + $4, reports_filed = users.reports_filed + 1`,
      [email, name, avatar, points]
    );
  } else if (fieldToIncrement === "evidence_submitted") {
    await pool.query(
      `INSERT INTO users (email, name, avatar, points, evidence_submitted)
       VALUES ($1, $2, $3, $4, 1)
       ON CONFLICT (email) DO UPDATE 
       SET name = $2, points = users.points + $4, evidence_submitted = users.evidence_submitted + 1`,
      [email, name, avatar, points]
    );
  } else {
    await pool.query(
      `INSERT INTO users (email, name, avatar, points)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE 
       SET name = $2, points = users.points + $4`,
      [email, name, avatar, points]
    );
  }
}

// Database Schema Initialization (Blank Slate - no seeded mock incidents, but seeds mock users for leaderboard)
async function initDb() {
  try {
    // 1. Create schemas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS incidents (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        raw_description TEXT NOT NULL,
        image_url VARCHAR(512),
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        address VARCHAR(512) NOT NULL,
        reporter_name VARCHAR(255) NOT NULL,
        reporter_email VARCHAR(255) NOT NULL,
        reporter_avatar VARCHAR(512),
        created_at TIMESTAMP NOT NULL,
        status VARCHAR(50) NOT NULL,
        upvotes INT NOT NULL DEFAULT 0,
        downvotes INT NOT NULL DEFAULT 0,
        intake JSONB,
        verification JSONB,
        impact JSONB,
        prioritization JSONB,
        resolution JSONB
      );
      
      CREATE TABLE IF NOT EXISTS evidence (
        id VARCHAR(50) PRIMARY KEY,
        incident_id VARCHAR(50) REFERENCES incidents(id) ON DELETE CASCADE,
        author VARCHAR(255) NOT NULL,
        text TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS predictions (
        id VARCHAR(50) PRIMARY KEY,
        confidence_scores DOUBLE PRECISION NOT NULL,
        generated_at TIMESTAMP NOT NULL,
        agent_thought TEXT,
        risk_zones JSONB NOT NULL,
        predicted_failures JSONB NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        email VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        avatar VARCHAR(512),
        points INT NOT NULL DEFAULT 0,
        reports_filed INT NOT NULL DEFAULT 0,
        evidence_submitted INT NOT NULL DEFAULT 0
      );
    `);
    console.log("Database tables verified or created successfully.");

    // Seed mock competitor accounts for leaderboard if table is empty
    const usersCheck = await pool.query("SELECT COUNT(*) FROM users");
    if (Number(usersCheck.rows[0].count) === 0) {
      console.log("Seeding competitor profiles into users table...");
      const mockUsers = [
        { email: "marcus@rome.net", name: "Marcus Aurelius", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100", points: 820, reports_filed: 14, evidence_submitted: 22 },
        { email: "tesla@grid.com", name: "Johnny Tesla", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100", points: 415, reports_filed: 6, evidence_submitted: 12 },
        { email: "clara@spokes.org", name: "Clara Cycle", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=100", points: 120, reports_filed: 2, evidence_submitted: 4 }
      ];

      for (const u of mockUsers) {
        await pool.query(
          "INSERT INTO users (email, name, avatar, points, reports_filed, evidence_submitted) VALUES ($1, $2, $3, $4, $5, $6)",
          [u.email, u.name, u.avatar, u.points, u.reports_filed, u.evidence_submitted]
        );
      }
      console.log("Competitor profiles seeded successfully.");
    }
  } catch (err) {
    console.error("Database initialization failed:", err);
  }
}

// SIMULATED AGENT PIPELINE: Fallback generator
function runSimulatedAgentPipeline(incident: Incident, otherIncidents: Incident[]): Incident {
  const current = { ...incident };

  // 1. Intake Agent Sim
  if (!current.intake) {
    const isWater = current.title.toLowerCase().includes("water") || current.rawDescription.toLowerCase().includes("leak") || current.rawDescription.toLowerCase().includes("flooding");
    const isPower = current.title.toLowerCase().includes("power") || current.title.toLowerCase().includes("electricity") || current.rawDescription.toLowerCase().includes("spark") || current.rawDescription.toLowerCase().includes("wire");
    const isTree = current.title.toLowerCase().includes("tree") || current.rawDescription.toLowerCase().includes("branch") || current.rawDescription.toLowerCase().includes("foliage");
    const isRoad = current.title.toLowerCase().includes("sinkhole") || current.title.toLowerCase().includes("pothole") || current.rawDescription.toLowerCase().includes("asphalt") || current.rawDescription.toLowerCase().includes("pavement");

    let issue_type = "Road Infrastructure";
    let severity = 3;
    if (isWater) { issue_type = "Water & Sewage"; severity = 4; }
    else if (isPower) { issue_type = "Power & Grid"; severity = 4; }
    else if (isTree) { issue_type = "Parks & Safety"; severity = 2; }
    else if (isRoad) { issue_type = "Road Infrastructure"; severity = 3; }

    if (current.rawDescription.toLowerCase().includes("critical") || current.rawDescription.toLowerCase().includes("emergency") || current.rawDescription.toLowerCase().includes("dangerous")) {
      severity = Math.min(5, severity + 1);
    }

    current.intake = {
      issue_type,
      severity,
      confidence: 0.92,
      location_desc: `Inspected reporting vicinity of ${current.location.address}. High utility density corridor matching category ${issue_type}.`,
      detailed_description: `Substantiated report of ${current.title.toLowerCase()} posing structural and functional municipal blockages. Raw reported notes indicate: "${current.rawDescription.substring(0, 80)}..."`,
      agentThought: `Intake Agent [SIMULATED]: Extracted tokens and ran semantic matching. Identified primary agent cluster matching '${issue_type}'. Confirmed Severity index as ${severity}/5 based on hazard proximity levels and density weights.`
    };
  }

  // 2. Verification Agent Sim
  if (!current.verification) {
    const dups = otherIncidents.filter(other => {
      if (other.id === current.id) return false;
      const dist = Math.sqrt(Math.pow(other.location.lat - current.location.lat, 2) + Math.pow(other.location.lng - current.location.lng, 2));
      const hasSemanticOverlap = other.title.toLowerCase().split(" ").some(word => word.length > 4 && current.title.toLowerCase().includes(word));
      return dist < 0.005 && hasSemanticOverlap;
    });

    const isDup = dups.length > 0;
    const dupGroup = isDup ? dups[0].id : null;

    current.verification = {
      verified: true,
      duplicate_group: dupGroup,
      confidence: isDup ? 0.94 : 0.88,
      agentThought: `Verification Agent [SIMULATED]: Run geospatial lookup over index. ${isDup ? `FOUND potential duplicate incident group matching ${dupGroup}. Consolidated citizen files.` : 'No duplicate structural vectors registered within a 500-meter radius boundary.'}`
    };
  }

  // 3. Impact Agent Sim
  if (!current.impact) {
    const s = current.intake?.severity || 3;
    const isSchoolZone = current.rawDescription.toLowerCase().includes("school") || current.location.address.toLowerCase().includes("school");
    const isCommercial = current.location.address.toLowerCase().includes("grand") || current.location.address.toLowerCase().includes("ave");

    let impact_score = Math.min(5, s + (isSchoolZone ? 1 : 0));
    let affected_population = isSchoolZone ? 1500 : (isCommercial ? 4000 : 450);

    let reasoning = `Analyzed spatial indicators. The infrastructural disruption at ${current.location.address} impairs nearby local transit facilities. `;
    if (isSchoolZone) reasoning += "Crucial high-vulnerability pedestrian zone identified due to local school proximity.";
    else if (isCommercial) reasoning += "Direct impact on metropolitan sales corridor, water grid distribution grids, and central power substations.";
    else reasoning += "Indirect residential pressure decline; low overall municipal flow disruption.";

    current.impact = {
      impact_score,
      affected_population,
      reasoning,
      agentThought: `Impact Agent [SIMULATED]: Evaluated population density surrounding coordinates (${current.location.lat.toFixed(4)}, ${current.location.lng.toFixed(4)}). Assigned impact factor weight ${impact_score}/5. School indicator is ${isSchoolZone ? 'TRUE' : 'FALSE'}.`
    };
  }

  // 4. Prioritization Agent Sim
  if (!current.prioritization) {
    const sev = current.intake?.severity || 3;
    const imp = current.impact?.impact_score || 3;
    const ver = current.verification?.confidence || 0.85;
    
    // Priority = Severity + Impact + Verification Confidence * 2 + Age factor (1.2)
    const priority_score = parseFloat((sev + imp + ver * 2 + 1.2).toFixed(1));
    let priority_rank: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" = "MEDIUM";
    let escalation_level = 1;

    if (priority_score >= 12) {
      priority_rank = "CRITICAL";
      escalation_level = 3;
    } else if (priority_score >= 9) {
      priority_rank = "HIGH";
      escalation_level = 2;
    } else if (priority_score >= 6) {
      priority_rank = "MEDIUM";
      escalation_level = 1;
    } else {
      priority_rank = "LOW";
      escalation_level = 1;
    }

    current.prioritization = {
      priority_score,
      priority_rank,
      escalation_level,
      agentThought: `Prioritization Agent [SIMULATED]: Summing structural weights. Severity: ${sev}, Impact: ${imp}, Verification Confidence Score: ${ver}. Computed score = ${priority_score}. High status dispatch rules map this to ${priority_rank}.`
    };
  }

  // 5. Resolution Agent Sim
  if (!current.resolution) {
    let department = "Department of Public Works";
    let recommended_action = "Deploy dispatch team for structural assessment and block hazard. Clean immediate debris and clear surrounding sidewalk.";
    let estimated_cost = 1200;
    let estimated_duration = "4 days";

    const type = current.intake?.issue_type || "Road Infrastructure";
    if (type === "Water & Sewage") {
      department = "Water & Sewerage Authority";
      recommended_action = "Expose main valve cluster to isolate pipeline. Replace broken joints, carry out sub-grade structural refilling and restore surrounding curbs.";
      estimated_cost = 8500;
      estimated_duration = "16 hours";
    } else if (type === "Power & Grid") {
      department = "Metro Power & Utility";
      recommended_action = "Isolate circuit using digital SCADA breaker controls. Dispatch high-voltage certified repair technician. Replace insulation bracket assembly.";
      estimated_cost = 4500;
      estimated_duration = "6 hours";
    } else if (type === "Parks & Safety") {
      department = "Department of Parks & Recreation";
      recommended_action = "Send timber removal crew with heavy-duty diesel woodchipper. Prune overhead overhanging branches to eliminate future breakage vectors.";
      estimated_cost = 750;
      estimated_duration = "3 hours";
    } else if (type === "Road Infrastructure") {
      department = "Department of Transportation";
      recommended_action = "Clear pavement fractures. Apply warm-mix asphalt patch or structural sub-grade replacement concrete. Repave road markings.";
      estimated_cost = 3200;
      estimated_duration = "2 days";
    }

    current.resolution = {
      department,
      recommended_action,
      estimated_cost,
      estimated_duration,
      approvedByOperator: false,
      operatorOverridden: false,
      agentThought: `Resolution Agent [SIMULATED]: Mapped to ${department} category. Extrapolated cost (${estimated_cost} USD) and duration (${estimated_duration}) from past municipal contract archives.`
    };
  }

  current.status = "RESOLVING";
  return current;
}

// REAL AI PIPELINE: Interacts with actual Gemini API
async function runRealGeminiAgentPipeline(incident: Incident, otherIncidents: Incident[]): Promise<Incident> {
  if (!ai) {
    return runSimulatedAgentPipeline(incident, otherIncidents);
  }

  const current = { ...incident };

  try {
    // 1. Intake Agent (Call Gemini)
    const intakePrompt = `
      You are the Intake Agent of CivicMind. Convert this raw citizen submission into a structured incident.
      Raw Report Title: "${current.title}"
      Raw Report Description: "${current.rawDescription}"
      Location Address: "${current.location.address}"
      
      Classify this issue into one of: Road Infrastructure, Water & Sewage, Power & Grid, Sanitation, Parks & Safety.
      Estimate severity from 1 (minor) to 5 (extreme life-safety emergency).
      Write a concise location summary and a professional polished, detailed explanation of the issue.
      Write an "agentThought" detailing your internal categorization rules.
    `;

    const intakeResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: intakePrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            issue_type: { type: Type.STRING },
            severity: { type: Type.INTEGER, description: "1 to 5" },
            confidence: { type: Type.NUMBER, description: "0.0 to 1.0" },
            location_desc: { type: Type.STRING },
            detailed_description: { type: Type.STRING },
            agentThought: { type: Type.STRING }
          },
          required: ["issue_type", "severity", "confidence", "location_desc", "detailed_description", "agentThought"]
        }
      }
    });

    const intakeResult = JSON.parse(intakeResponse.text || "{}");
    current.intake = {
      issue_type: intakeResult.issue_type || "Road Infrastructure",
      severity: Number(intakeResult.severity) || 3,
      confidence: Number(intakeResult.confidence) || 0.9,
      location_desc: intakeResult.location_desc || current.location.address,
      detailed_description: intakeResult.detailed_description || current.rawDescription,
      agentThought: "Intake Agent [AI]: " + (intakeResult.agentThought || "Successfully extracted categories.")
    };

    // 2. Verification Agent (Call Gemini)
    const otherLogSummary = otherIncidents
      .filter(other => other.id !== current.id)
      .map(other => `ID: ${other.id}, Title: ${other.title}, Category: ${other.intake?.issue_type || "Unknown"}, Address: ${other.location.address}`)
      .join("\n");

    const verificationPrompt = `
      You are the Verification Agent of CivicMind. Perform duplicate detection on this issue against existing municipal reports.
      Target Report: 
      Title: "${current.title}"
      Category: "${current.intake.issue_type}"
      Address: "${current.location.address}"
      Description: "${current.intake.detailed_description}"
      Coordinates: (${current.location.lat}, ${current.location.lng})

      Active Existing City Tickets:
      ${otherLogSummary || "None"}

      Check for geospatial and semantic overlap (within ~200 meters, and matching problem domain).
      If it is a duplicate, specify duplicate_group as the ID of the duplicate matching incident, otherwise null.
      Provide a confidence score (0.0 to 1.0) and write an agentThought highlighting your comparisons.
    `;

    const verificationResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: verificationPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            verified: { type: Type.BOOLEAN },
            duplicate_group: { type: Type.STRING, nullable: true },
            confidence: { type: Type.NUMBER, description: "0.0 to 1.0" },
            agentThought: { type: Type.STRING }
          },
          required: ["verified", "duplicate_group", "confidence", "agentThought"]
        }
      }
    });

    const verResult = JSON.parse(verificationResponse.text || "{}");
    current.verification = {
      verified: verResult.verified !== undefined ? verResult.verified : true,
      duplicate_group: verResult.duplicate_group || null,
      confidence: Number(verResult.confidence) || 0.85,
      agentThought: "Verification Agent [AI]: " + (verResult.agentThought || "Verification processing compiled.")
    };

    // 3. Impact Agent (Call Gemini)
    const impactPrompt = `
      You are the Impact Agent of CivicMind. Estimate community, commercial, and safety impact of this civic threat.
      Title: "${current.title}"
      Category: "${current.intake.issue_type}"
      Severity: ${current.intake.severity}/5
      Location: "${current.location.address}"
      Description: "${current.intake.detailed_description}"

      Assess potential safety hazards, population densities, proximity to schools, hospitals, transit, or grid dependencies.
      Estimate:
      - impact_score: 1 (very localized) to 5 (city-wide emergency)
      - affected_population: Estimated number of residents/pedestrians/commuters impacted.
      - reasoning: Explanation of impact risks.
      - agentThought: Internal reasoning monologue detailing your impact weights.
    `;

    const impactResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: impactPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            impact_score: { type: Type.INTEGER, description: "1 to 5" },
            affected_population: { type: Type.INTEGER },
            reasoning: { type: Type.STRING },
            agentThought: { type: Type.STRING }
          },
          required: ["impact_score", "affected_population", "reasoning", "agentThought"]
        }
      }
    });

    const impactResult = JSON.parse(impactResponse.text || "{}");
    current.impact = {
      impact_score: Number(impactResult.impact_score) || 3,
      affected_population: Number(impactResult.affected_population) || 500,
      reasoning: impactResult.reasoning || "Localized road safety degradation.",
      agentThought: "Impact Agent [AI]: " + (impactResult.agentThought || "Calculated impact coefficient.")
    };

    // 4. Prioritization Agent (Formula-driven reasoning)
    const sevScore = current.intake.severity;
    const impScore = current.impact.impact_score;
    const verConf = current.verification.confidence;
    
    // Priority = Severity + Impact + Verification Confidence * 2 + Age factor (assumed default 1.5)
    const priority_score = parseFloat((sevScore + impScore + verConf * 2 + 1.5).toFixed(1));
    let priority_rank: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" = "MEDIUM";
    let escalation_level = 1;

    if (priority_score >= 12) {
      priority_rank = "CRITICAL";
      escalation_level = 3;
    } else if (priority_score >= 9) {
      priority_rank = "HIGH";
      escalation_level = 2;
    } else if (priority_score >= 6) {
      priority_rank = "MEDIUM";
      escalation_level = 1;
    } else {
      priority_rank = "LOW";
      escalation_level = 1;
    }

    current.prioritization = {
      priority_score,
      priority_rank,
      escalation_level,
      agentThought: `Prioritization Agent [AI]: Computed priorities through mathematical composite scoring. Formula: Severity (${sevScore}) + Impact (${impScore}) + (Verification Confidence (${verConf.toFixed(2)}) * 2) + Age Factor (1.5) = ${priority_score}. Category maps to prioritization tier: ${priority_rank}.`
    };

    // 5. Resolution Agent (Call Gemini)
    const resolutionPrompt = `
      You are the Resolution Agent of CivicMind. Recommend dispatch plan, cost, and duration for:
      Title: "${current.title}"
      Category: "${current.intake.issue_type}"
      Severity: ${current.intake.severity}/5
      Priority Rank: "${priority_rank}"
      Location: "${current.location.address}"
      Details: "${current.intake.detailed_description}"

      Select a municipal department (e.g. Water & Sewerage Authority, Department of Transportation, Metro Power & Grid, Department of Parks & Recreation, Sanitation, Public Works).
      Draft a realistic step-by-step action plan, estimated budget cost in USD, and estimated repair duration.
      Provide the reasoning as an 'agentThought'.
    `;

    const resolutionResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: resolutionPrompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            department: { type: Type.STRING },
            recommended_action: { type: Type.STRING },
            estimated_cost: { type: Type.INTEGER },
            estimated_duration: { type: Type.STRING },
            agentThought: { type: Type.STRING }
          },
          required: ["department", "recommended_action", "estimated_cost", "estimated_duration", "agentThought"]
        }
      }
    });

    const resResult = JSON.parse(resolutionResponse.text || "{}");
    current.resolution = {
      department: resResult.department || "Department of Public Works",
      recommended_action: resResult.recommended_action || "Deploy maintenance team to seal area and correct physical faults.",
      estimated_cost: Number(resResult.estimated_cost) || 1200,
      estimated_duration: resResult.estimated_duration || "2 days",
      approvedByOperator: false,
      operatorOverridden: false,
      agentThought: "Resolution Agent [AI]: " + (resResult.agentThought || "Devised dispatch routing protocols.")
    };

    current.status = "RESOLVING";
    return current;

  } catch (error) {
    console.error("Gemini API Pipeline error, falling back to Simulation:", error);
    return runSimulatedAgentPipeline(incident, otherIncidents);
  }
}

// --- ENDPOINTS ---

// File Upload Endpoint (base64)
app.post("/api/upload", (req, res) => {
  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ error: "No image payload provided" });
  }

  try {
    const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: "Invalid base64 payload format" });
    }

    const fileBuffer = Buffer.from(matches[2], "base64");
    const extension = matches[1].split("/")[1];
    const filename = `upload-${Date.now()}.${extension}`;
    
    // Store in public/uploads for Vite dev server routing
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    fs.writeFileSync(path.join(uploadsDir, filename), fileBuffer);
    
    // Also store in dist/uploads if production folder exists
    const prodUploadsDir = path.join(process.cwd(), "dist", "uploads");
    if (fs.existsSync(path.join(process.cwd(), "dist"))) {
      if (!fs.existsSync(prodUploadsDir)) {
        fs.mkdirSync(prodUploadsDir, { recursive: true });
      }
      fs.writeFileSync(path.join(prodUploadsDir, filename), fileBuffer);
    }

    res.json({ imageUrl: `/uploads/${filename}` });
  } catch (err: any) {
    console.error("File upload failed:", err);
    res.status(500).json({ error: "Failed to upload image", details: err.message });
  }
});

// Gamification Leaderboard API
app.get("/api/users/leaderboard", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users ORDER BY points DESC");
    res.json(result.rows);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch leaderboard", details: err.message });
  }
});

// User Profile Creation/Lookup API
app.post("/api/users/profile", async (req, res) => {
  const { email, name } = req.body;
  if (!email || !name) {
    return res.status(400).json({ error: "Email and name are required." });
  }

  try {
    let result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length === 0) {
      const avatar = `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 5000000)}?auto=format&fit=crop&q=80&w=100`;
      await pool.query(
        "INSERT INTO users (email, name, avatar, points) VALUES ($1, $2, $3, 0)",
        [email, name, avatar]
      );
      result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    }
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch profile", details: err.message });
  }
});

// 1. Get all incidents
app.get("/api/incidents", async (req, res) => {
  try {
    const incidentsResult = await pool.query("SELECT * FROM incidents ORDER BY created_at DESC");
    const evidenceResult = await pool.query("SELECT * FROM evidence ORDER BY created_at ASC");
    
    // Group evidence by incident_id
    const evidenceMap: { [key: string]: any[] } = {};
    evidenceResult.rows.forEach(ev => {
      if (!evidenceMap[ev.incident_id]) {
        evidenceMap[ev.incident_id] = [];
      }
      evidenceMap[ev.incident_id].push(ev);
    });
    
    const mapped = incidentsResult.rows.map(row => rowToIncident(row, evidenceMap[row.id] || []));
    res.json(mapped);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch incidents", details: err.message });
  }
});

// 2. Get single incident
app.get("/api/incidents/:id", async (req, res) => {
  try {
    const incidentResult = await pool.query("SELECT * FROM incidents WHERE id = $1", [req.params.id]);
    if (incidentResult.rows.length === 0) {
      return res.status(404).json({ error: "Incident not found" });
    }
    const evidenceResult = await pool.query("SELECT * FROM evidence WHERE incident_id = $1 ORDER BY created_at ASC", [req.params.id]);
    const incident = rowToIncident(incidentResult.rows[0], evidenceResult.rows);
    res.json(incident);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch incident", details: err.message });
  }
});

// 3. Create raw incident (Citizen Submission) - Rewards 20 points
app.post("/api/incidents", async (req, res) => {
  const { title, rawDescription, address, lat, lng, reporterName, reporterEmail, imageUrl } = req.body;

  if (!title || !rawDescription) {
    return res.status(400).json({ error: "Title and rawDescription are required fields." });
  }

  const id = `inc-${Date.now()}`;
  const latVal = Number(lat) || (37.7749 + (Math.random() - 0.5) * 0.05);
  const lngVal = Number(lng) || (-122.4194 + (Math.random() - 0.5) * 0.05);
  const addr = address || "Unspecified Location, Metropolis";
  const name = reporterName || "Anonymous Citizen";
  const email = reporterEmail || "anonymous@citizen.net";
  const avatar = `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 5000000)}?auto=format&fit=crop&q=80&w=100`;
  const createdAt = new Date();
  const status = "SUBMITTED";

  try {
    // 1. Save incident
    await pool.query(
      `INSERT INTO incidents (id, title, raw_description, lat, lng, address, reporter_name, reporter_email, reporter_avatar, created_at, status, image_url) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [id, title, rawDescription, latVal, lngVal, addr, name, email, avatar, createdAt, status, imageUrl || null]
    );

    // 2. Reward points
    await rewardPoints(email, name, 20, "reports_filed");

    const insertedResult = await pool.query("SELECT * FROM incidents WHERE id = $1", [id]);
    const incident = rowToIncident(insertedResult.rows[0], []);
    res.status(201).json(incident);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Failed to save incident to database", details: err.message });
  }
});

// 4. Run step-by-step agent workflow on an incident
app.post("/api/incidents/:id/analyze", async (req, res) => {
  try {
    const incidentResult = await pool.query("SELECT * FROM incidents WHERE id = $1", [req.params.id]);
    if (incidentResult.rows.length === 0) {
      return res.status(404).json({ error: "Incident not found" });
    }
    const evidenceResult = await pool.query("SELECT * FROM evidence WHERE incident_id = $1 ORDER BY created_at ASC", [req.params.id]);
    const currentIncident = rowToIncident(incidentResult.rows[0], evidenceResult.rows);

    // Update status to analyzing in DB
    await pool.query("UPDATE incidents SET status = $1 WHERE id = $2", ["ANALYZING", currentIncident.id]);
    currentIncident.status = "ANALYZING";

    // Get all OTHER incidents for duplicate checking
    const otherResult = await pool.query("SELECT * FROM incidents WHERE id != $1", [currentIncident.id]);
    const otherEvidence = await pool.query("SELECT * FROM evidence WHERE incident_id != $1", [currentIncident.id]);
    const otherEvidenceMap: { [key: string]: any[] } = {};
    otherEvidence.rows.forEach(ev => {
      if (!otherEvidenceMap[ev.incident_id]) {
        otherEvidenceMap[ev.incident_id] = [];
      }
      otherEvidenceMap[ev.incident_id].push(ev);
    });
    const otherIncidents = otherResult.rows.map(row => rowToIncident(row, otherEvidenceMap[row.id] || []));

    // Run pipeline
    const updated = await runRealGeminiAgentPipeline(currentIncident, otherIncidents);

    // Update database record with outputs
    await pool.query(
      `UPDATE incidents 
       SET status = $1, intake = $2, verification = $3, impact = $4, prioritization = $5, resolution = $6
       WHERE id = $7`,
      [
        updated.status,
        JSON.stringify(updated.intake || null),
        JSON.stringify(updated.verification || null),
        JSON.stringify(updated.impact || null),
        JSON.stringify(updated.prioritization || null),
        JSON.stringify(updated.resolution || null),
        updated.id
      ]
    );

    res.json(updated);
  } catch (err: any) {
    console.error("AI Analysis failed:", err);
    res.status(500).json({ error: "Agentic workflow failed", details: err.message });
  }
});

// 5. Citizen Upvote/Downvote Community Verification - Rewards 5 points to the voter
app.post("/api/incidents/:id/vote", async (req, res) => {
  try {
    const { type, voterEmail, voterName } = req.body; // "up" or "down"
    if (type === "up") {
      await pool.query("UPDATE incidents SET upvotes = upvotes + 1 WHERE id = $1", [req.params.id]);
    } else if (type === "down") {
      await pool.query("UPDATE incidents SET downvotes = downvotes + 1 WHERE id = $1", [req.params.id]);
    }
    
    // Reward points to voter if profile details are provided
    if (voterEmail && voterName) {
      await rewardPoints(voterEmail, voterName, 5);
    }

    // Fetch updated incident
    const incidentResult = await pool.query("SELECT * FROM incidents WHERE id = $1", [req.params.id]);
    if (incidentResult.rows.length === 0) {
      return res.status(404).json({ error: "Incident not found" });
    }
    const evidenceResult = await pool.query("SELECT * FROM evidence WHERE incident_id = $1 ORDER BY created_at ASC", [req.params.id]);
    const incident = rowToIncident(incidentResult.rows[0], evidenceResult.rows);
    res.json(incident);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Failed to register vote", details: err.message });
  }
});

// 6. Citizen Add Evidence / Comment - Rewards 10 points
app.post("/api/incidents/:id/evidence", async (req, res) => {
  const { author, text, commenterEmail } = req.body;
  if (!author || !text) {
    return res.status(400).json({ error: "Author and text are required to save evidence." });
  }

  const id = `ev-${Date.now()}`;
  const createdAt = new Date();
  const email = commenterEmail || `${author.toLowerCase().replace(/\s+/g, '')}@citizen.net`;

  try {
    // Check if incident exists
    const checkResult = await pool.query("SELECT * FROM incidents WHERE id = $1", [req.params.id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: "Incident not found" });
    }

    // Insert evidence record
    await pool.query(
      "INSERT INTO evidence (id, incident_id, author, text, created_at) VALUES ($1, $2, $3, $4, $5)",
      [id, req.params.id, author, text, createdAt]
    );

    // Reward points to commenter
    await rewardPoints(email, author, 10, "evidence_submitted");

    // Fetch updated incident
    const incidentResult = await pool.query("SELECT * FROM incidents WHERE id = $1", [req.params.id]);
    const evidenceResult = await pool.query("SELECT * FROM evidence WHERE incident_id = $1 ORDER BY created_at ASC", [req.params.id]);
    const incident = rowToIncident(incidentResult.rows[0], evidenceResult.rows);
    res.status(201).json(incident);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Failed to add evidence", details: err.message });
  }
});

// 7. Municipal Operator Approval / Priority and Department Overrides
app.post("/api/incidents/:id/operate", async (req, res) => {
  try {
    const incidentResult = await pool.query("SELECT * FROM incidents WHERE id = $1", [req.params.id]);
    if (incidentResult.rows.length === 0) {
      return res.status(404).json({ error: "Incident not found" });
    }
    const evidenceResult = await pool.query("SELECT * FROM evidence WHERE incident_id = $1 ORDER BY created_at ASC", [req.params.id]);
    const currentIncident = rowToIncident(incidentResult.rows[0], evidenceResult.rows);

    const { priorityRank, department, estimatedCost, estimatedDuration, status, approveAction } = req.body;

    if (currentIncident.resolution) {
      if (priorityRank && currentIncident.prioritization) {
        currentIncident.prioritization.priority_rank = priorityRank;
        currentIncident.resolution.operatorOverridden = true;
      }
      if (department) {
        currentIncident.resolution.department = department;
        currentIncident.resolution.operatorOverridden = true;
      }
      if (estimatedCost !== undefined) {
        currentIncident.resolution.estimated_cost = Number(estimatedCost);
        currentIncident.resolution.operatorOverridden = true;
      }
      if (estimatedDuration) {
        currentIncident.resolution.estimated_duration = estimatedDuration;
        currentIncident.resolution.operatorOverridden = true;
      }
      if (approveAction !== undefined) {
        currentIncident.resolution.approvedByOperator = approveAction;
        if (approveAction) {
          currentIncident.status = "RESOLVING";
        }
      }
    }

    if (status) {
      currentIncident.status = status;
    }

    // Save operator edits to DB
    await pool.query(
      `UPDATE incidents 
       SET status = $1, prioritization = $2, resolution = $3
       WHERE id = $4`,
      [
        currentIncident.status,
        JSON.stringify(currentIncident.prioritization || null),
        JSON.stringify(currentIncident.resolution || null),
        currentIncident.id
      ]
    );

    res.json(currentIncident);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Failed to save adjustments", details: err.message });
  }
});

// 8. Get Predictions / Hotspots Risk (Prediction Agent)
app.get("/api/predictions", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM predictions ORDER BY generated_at DESC LIMIT 1");
    if (result.rows.length === 0) {
      return res.json({
        risk_zones: [],
        predicted_failures: [],
        confidence_scores: 0,
        generatedAt: new Date().toISOString()
      });
    }
    const row = result.rows[0];
    res.json({
      confidence_scores: Number(row.confidence_scores),
      generatedAt: new Date(row.generated_at).toISOString(),
      agentThought: row.agent_thought || undefined,
      risk_zones: row.risk_zones,
      predicted_failures: row.predicted_failures
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch predictions", details: err.message });
  }
});

// 9. Force Regenerate Predictions (Prediction Agent call to Gemini)
app.post("/api/predictions/regenerate", async (req, res) => {
  try {
    const incidentsResult = await pool.query("SELECT * FROM incidents");
    const mappedIncidents = incidentsResult.rows.map(row => rowToIncident(row, []));

    const listSummary = mappedIncidents
      .map(inc => `ID: ${inc.id}, Category: ${inc.intake?.issue_type || "Unknown"}, Address: ${inc.location.address}, Severity: ${inc.intake?.severity || "Unknown"}`)
      .join("\n");

    let finalPredictionData;

    if (!ai) {
      const existingResult = await pool.query("SELECT * FROM predictions ORDER BY generated_at DESC LIMIT 1");
      const existingZones = existingResult.rows.length > 0 ? existingResult.rows[0].risk_zones : [];
      const existingFailures = existingResult.rows.length > 0 ? existingResult.rows[0].predicted_failures : [];

      finalPredictionData = {
        confidence_scores: 0.88,
        generatedAt: new Date().toISOString(),
        agentThought: "Prediction Agent [SIMULATED]: Refreshed municipal models. Correlated active sewer issues with sub-base erosion sensors. Risk zones expanded.",
        risk_zones: [
          {
            id: `rz-${Date.now()}-1`,
            zone: "Grand Boulevard Corridor Hub",
            risk_score: Math.min(98, 85 + Math.floor(Math.random() * 10)),
            primary_vulnerability: "Corroded Water Mains and Intense Utility Siltation",
            lat: 37.7794,
            lng: -122.4132,
            radius: 450
          },
          ...existingZones.slice(1)
        ],
        predicted_failures: existingFailures
      };
    } else {
      const predictionPrompt = `
        You are the Prediction Agent of CivicMind. Perform systemic threat modeling, trend analysis, and prediction of infrastructure failures on this city utility registry.
        Current City Incidents:
        ${listSummary}

        Tasks:
        1. Define 3 high-risk spatial 'risk_zones' (return name as 'zone', risk_score (1-100), primary_vulnerability, lat/lng coordinates clustered close to 37.7749 / -122.4194 grid, and radius in meters).
        2. Predict 3 probable upcoming infrastructure failures ('predicted_failures' containing descriptions, estimate_time frames e.g. 'Within 30 Days', confidence levels 0-1, category, and locations).
        3. Supply professional confidence metadata and an agentThought explanation of your forecasting model.
      `;

      const predictionResponse = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: predictionPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              confidence_scores: { type: Type.NUMBER },
              agentThought: { type: Type.STRING },
              risk_zones: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    zone: { type: Type.STRING },
                    risk_score: { type: Type.INTEGER },
                    primary_vulnerability: { type: Type.STRING },
                    lat: { type: Type.NUMBER },
                    lng: { type: Type.NUMBER },
                    radius: { type: Type.INTEGER }
                  },
                  required: ["zone", "risk_score", "primary_vulnerability", "lat", "lng", "radius"]
                }
              },
              predicted_failures: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    item: { type: Type.STRING },
                    estimate_time: { type: Type.STRING },
                    confidence: { type: Type.NUMBER },
                    category: { type: Type.STRING },
                    location: { type: Type.STRING }
                  },
                  required: ["item", "estimate_time", "confidence", "category", "location"]
                }
              }
            },
            required: ["confidence_scores", "agentThought", "risk_zones", "predicted_failures"]
          }
        }
      });

      const parsedResult = JSON.parse(predictionResponse.text || "{}");
      finalPredictionData = {
        confidence_scores: Number(parsedResult.confidence_scores) || 0.8,
        generatedAt: new Date().toISOString(),
        agentThought: "Prediction Agent [AI]: " + (parsedResult.agentThought || "Forecasting compiled successfully."),
        risk_zones: (parsedResult.risk_zones || []).map((rz: any, i: number) => ({
          id: `rz-${Date.now()}-${i}`,
          zone: rz.zone,
          risk_score: Number(rz.risk_score) || 50,
          primary_vulnerability: rz.primary_vulnerability,
          lat: Number(rz.lat) || 37.7749,
          lng: Number(rz.lng) || -122.4194,
          radius: Number(rz.radius) || 300
        })),
        predicted_failures: (parsedResult.predicted_failures || []).map((pf: any, i: number) => ({
          id: `pf-${Date.now()}-${i}`,
          item: pf.item,
          estimate_time: pf.estimate_time,
          confidence: Number(pf.confidence) || 0.7,
          category: pf.category,
          location: pf.location
        }))
      };
    }

    const predId = `pred-${Date.now()}`;
    await pool.query(
      `INSERT INTO predictions (id, confidence_scores, generated_at, agent_thought, risk_zones, predicted_failures)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        predId,
        finalPredictionData.confidence_scores,
        new Date(finalPredictionData.generatedAt),
        finalPredictionData.agentThought,
        JSON.stringify(finalPredictionData.risk_zones),
        JSON.stringify(finalPredictionData.predicted_failures)
      ]
    );

    res.json(finalPredictionData);
  } catch (err: any) {
    console.error("Prediction Agent regeneration error:", err);
    res.status(500).json({ error: "Prediction modeling failed to update." });
  }
});

// START EXPRESS/VITE INBOUND LOGIC
async function start() {
  // Initialize Database Tables (Blank Slate - no seeding)
  await initDb();

  if (process.env.NODE_ENV !== "production") {
    // Dynamic Vite setup inside development Mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production serving of bundled static assets 
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`CivicMind Server running on port ${PORT}`);
  });
}

start();
