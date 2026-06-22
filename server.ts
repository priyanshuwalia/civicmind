import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

import type { Incident } from "./src/types";
import {
  applicationDefault,
  cert as firebaseCert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();

// Initialize Firebase Admin SDK for Authentication & Image Uploads
if (getApps().length === 0) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccount) {
    try {
      const serviceAccountCert = JSON.parse(serviceAccount);
      initializeApp({
        credential: firebaseCert(serviceAccountCert),
        storageBucket:
          process.env.FIREBASE_STORAGE_BUCKET ||
          (serviceAccountCert.project_id
            ? `${serviceAccountCert.project_id}.appspot.com`
            : undefined),
      });
      console.log("Firebase Admin initialized via service account.");
    } catch (err) {
      console.error(
        "Failed to parse FIREBASE_SERVICE_ACCOUNT JSON, fallback to default credentials:",
        err,
      );
      try {
        initializeApp({
          credential: applicationDefault(),
          projectId: process.env.VITE_FIREBASE_PROJECT_ID || "mock-project",
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        });
      } catch (innerErr) {
        console.error(
          "Firebase fallback initialization failed, using default credentials config:",
          innerErr,
        );
        initializeApp({
          projectId: process.env.VITE_FIREBASE_PROJECT_ID || "mock-project",
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        });
      }
    }
  } else {
    initializeApp({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID || "mock-project",
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
    console.log("Firebase Admin initialized via default / project ID.");
  }
}

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Initialize Gemini SDK
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

let dbInitPromise: Promise<void> | null = null;

export function ensureDbInitialized() {
  if (!dbInitPromise) {
    dbInitPromise = initDb().catch((error) => {
      dbInitPromise = null;
      throw error;
    });
  }

  return dbInitPromise;
}

app.use("/api", async (_req, res, next) => {
  try {
    await ensureDbInitialized();
    next();
  } catch (error: any) {
    console.error("Database initialization failed:", error);
    res.status(500).json({
      error: "Database initialization failed",
      details: error?.message || "Unknown database error",
    });
  }
});

// Firebase Authentication Middleware
async function checkAuth(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: "Missing or invalid authorization header." });
  }

  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Token verification failed:", error);
    return res.status(401).json({ error: "Unauthorized." });
  }
}

// Operator Authorization Middleware
async function requireOperator(req: any, res: any, next: any) {
  if (!req.user || !req.user.email) {
    return res.status(403).json({ error: "Forbidden. Email not verified." });
  }

  try {
    const userDoc = await prisma.user.findUnique({
      where: { email: req.user.email },
    });
    if (!userDoc || userDoc.role !== "operator") {
      return res
        .status(403)
        .json({ error: "Access denied. Operator role required." });
    }
    next();
  } catch (error) {
    console.error("Operator verification failed:", error);
    res.status(500).json({ error: "Internal server error." });
  }
}

// Reward points and update user profile stats in Postgres via Prisma
async function rewardPoints(
  email: string,
  name: string,
  points: number,
  fieldToIncrement?: "reports_filed" | "evidence_submitted",
) {
  const avatar = `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 5000000)}?auto=format&fit=crop&q=80&w=100`;

  const dataToUpdate: any = {
    points: { increment: points },
    name: name,
  };
  if (fieldToIncrement === "reports_filed") {
    dataToUpdate.reportsFiled = { increment: 1 };
  } else if (fieldToIncrement === "evidence_submitted") {
    dataToUpdate.evidenceSubmitted = { increment: 1 };
  }

  try {
    await prisma.user.upsert({
      where: { email },
      update: dataToUpdate,
      create: {
        email,
        name,
        avatar,
        points: points,
        reportsFiled: fieldToIncrement === "reports_filed" ? 1 : 0,
        evidenceSubmitted: fieldToIncrement === "evidence_submitted" ? 1 : 0,
        role: "citizen",
      },
    });
  } catch (e) {
    console.error("Failed to reward points:", e);
  }
}

// Initialize Seeding for Leaderboard Users
async function initDb() {
  try {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      console.log("Seeding competitor profiles into Prisma NeonDB...");
      const mockUsers = [
        {
          email: "marcus@rome.net",
          name: "Marcus Aurelius",
          avatar:
            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100",
          points: 820,
          reportsFiled: 14,
          evidenceSubmitted: 22,
          role: "citizen",
        },
        {
          email: "tesla@grid.com",
          name: "Johnny Tesla",
          avatar:
            "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100",
          points: 415,
          reportsFiled: 6,
          evidenceSubmitted: 12,
          role: "citizen",
        },
        {
          email: "clara@spokes.org",
          name: "Clara Cycle",
          avatar:
            "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=100",
          points: 120,
          reportsFiled: 2,
          evidenceSubmitted: 4,
          role: "citizen",
        },
        {
          email: "operator@civicmind.gov",
          name: "Sarah Operator",
          avatar:
            "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=100",
          points: 0,
          reportsFiled: 0,
          evidenceSubmitted: 0,
          role: "operator",
        },
      ];

      await prisma.user.createMany({ data: mockUsers });
      console.log("Competitor profiles seeded in NeonDB.");
    }
  } catch (err) {
    console.error("Database seeding failed:", err);
  }
}

// SIMULATED AGENT PIPELINE: Fallback generator
function runSimulatedAgentPipeline(
  incident: Incident,
  otherIncidents: Incident[],
): Incident {
  const current = { ...incident };

  // 1. Intake Agent Sim
  if (!current.intake) {
    const isWater =
      current.title.toLowerCase().includes("water") ||
      current.rawDescription.toLowerCase().includes("leak") ||
      current.rawDescription.toLowerCase().includes("flooding");
    const isPower =
      current.title.toLowerCase().includes("power") ||
      current.title.toLowerCase().includes("electricity") ||
      current.rawDescription.toLowerCase().includes("spark") ||
      current.rawDescription.toLowerCase().includes("wire");
    const isTree =
      current.title.toLowerCase().includes("tree") ||
      current.rawDescription.toLowerCase().includes("branch") ||
      current.rawDescription.toLowerCase().includes("foliage");
    const isRoad =
      current.title.toLowerCase().includes("sinkhole") ||
      current.title.toLowerCase().includes("pothole") ||
      current.rawDescription.toLowerCase().includes("asphalt") ||
      current.rawDescription.toLowerCase().includes("pavement");

    let issue_type = "Road Infrastructure";
    let severity = 3;
    if (isWater) {
      issue_type = "Water & Sewage";
      severity = 4;
    } else if (isPower) {
      issue_type = "Power & Grid";
      severity = 4;
    } else if (isTree) {
      issue_type = "Parks & Safety";
      severity = 2;
    } else if (isRoad) {
      issue_type = "Road Infrastructure";
      severity = 3;
    }

    if (
      current.rawDescription.toLowerCase().includes("critical") ||
      current.rawDescription.toLowerCase().includes("emergency") ||
      current.rawDescription.toLowerCase().includes("dangerous")
    ) {
      severity = Math.min(5, severity + 1);
    }

    current.intake = {
      issue_type,
      severity,
      confidence: 0.92,
      location_desc: `Inspected reporting vicinity of ${current.location.address}. High utility density corridor matching category ${issue_type}.`,
      detailed_description: `Substantiated report of ${current.title.toLowerCase()} posing structural and functional municipal blockages. Raw reported notes indicate: "${current.rawDescription.substring(0, 80)}..."`,
      agentThought: `Intake Agent [SIMULATED]: Extracted tokens and ran semantic matching. Identified primary agent cluster matching '${issue_type}'. Confirmed Severity index as ${severity}/5 based on hazard proximity levels and density weights.`,
    };
  }

  // 2. Verification Agent Sim
  if (!current.verification) {
    const dups = otherIncidents.filter((other) => {
      if (other.id === current.id) return false;
      const dist = Math.sqrt(
        Math.pow(other.location.lat - current.location.lat, 2) +
          Math.pow(other.location.lng - current.location.lng, 2),
      );
      const hasSemanticOverlap = other.title
        .toLowerCase()
        .split(" ")
        .some(
          (word) =>
            word.length > 4 && current.title.toLowerCase().includes(word),
        );
      return dist < 0.005 && hasSemanticOverlap;
    });

    const isDup = dups.length > 0;
    const dupGroup = isDup ? dups[0].id : null;

    current.verification = {
      verified: true,
      duplicate_group: dupGroup,
      confidence: isDup ? 0.94 : 0.88,
      agentThought: `Verification Agent [SIMULATED]: Run geospatial lookup over index. ${isDup ? `FOUND potential duplicate incident group matching ${dupGroup}. Consolidated citizen files.` : "No duplicate structural vectors registered within a 500-meter radius boundary."}`,
    };
  }

  // 3. Impact Agent Sim
  if (!current.impact) {
    const s = current.intake?.severity || 3;
    const isSchoolZone =
      current.rawDescription.toLowerCase().includes("school") ||
      current.location.address.toLowerCase().includes("school");
    const isCommercial =
      current.location.address.toLowerCase().includes("grand") ||
      current.location.address.toLowerCase().includes("ave");

    let impact_score = Math.min(5, s + (isSchoolZone ? 1 : 0));
    let affected_population = isSchoolZone ? 1500 : isCommercial ? 4000 : 450;

    let reasoning = `Analyzed spatial indicators. The infrastructural disruption at ${current.location.address} impairs nearby local transit facilities. `;
    if (isSchoolZone)
      reasoning +=
        "Crucial high-vulnerability pedestrian zone identified due to local school proximity.";
    else if (isCommercial)
      reasoning +=
        "Direct impact on metropolitan sales corridor, water grid distribution grids, and central power substations.";
    else
      reasoning +=
        "Indirect residential pressure decline; low overall municipal flow disruption.";

    current.impact = {
      impact_score,
      affected_population,
      reasoning,
      agentThought: `Impact Agent [SIMULATED]: Evaluated population density surrounding coordinates (${current.location.lat.toFixed(4)}, ${current.location.lng.toFixed(4)}). Assigned impact factor weight ${impact_score}/5. School indicator is ${isSchoolZone ? "TRUE" : "FALSE"}.`,
    };
  }

  // 4. Prioritization Agent Sim
  if (!current.prioritization) {
    const sev = current.intake?.severity || 3;
    const imp = current.impact?.impact_score || 3;
    const ver = current.verification?.confidence || 0.85;

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
      agentThought: `Prioritization Agent [SIMULATED]: Summing structural weights. Severity: ${sev}, Impact: ${imp}, Verification Confidence Score: ${ver}. Computed score = ${priority_score}. High status dispatch rules map this to ${priority_rank}.`,
    };
  }

  // 5. Resolution Agent Sim
  if (!current.resolution) {
    let department = "Department of Public Works";
    let recommended_action =
      "Deploy dispatch team for structural assessment and block hazard. Clean immediate debris and clear surrounding sidewalk.";
    let estimated_cost = 1200;
    let estimated_duration = "4 days";

    const type = current.intake?.issue_type || "Road Infrastructure";
    if (type === "Water & Sewage") {
      department = "Water & Sewerage Authority";
      recommended_action =
        "Expose main valve cluster to isolate pipeline. Replace broken joints, carry out sub-grade structural refilling and restore surrounding curbs.";
      estimated_cost = 8500;
      estimated_duration = "16 hours";
    } else if (type === "Power & Grid") {
      department = "Metro Power & Utility";
      recommended_action =
        "Isolate circuit using digital SCADA breaker controls. Dispatch high-voltage certified repair technician. Replace insulation bracket assembly.";
      estimated_cost = 4500;
      estimated_duration = "6 hours";
    } else if (type === "Parks & Safety") {
      department = "Department of Parks & Recreation";
      recommended_action =
        "Send timber removal crew with heavy-duty diesel woodchipper. Prune overhead overhanging branches to eliminate future breakage vectors.";
      estimated_cost = 750;
      estimated_duration = "3 hours";
    } else if (type === "Road Infrastructure") {
      department = "Department of Transportation";
      recommended_action =
        "Clear pavement fractures. Apply warm-mix asphalt patch or structural sub-grade replacement concrete. Repave road markings.";
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
      agentThought: `Resolution Agent [SIMULATED]: Mapped to ${department} category. Extrapolated cost (${estimated_cost} USD) and duration (${estimated_duration}) from past municipal contract archives.`,
    };
  }

  current.status = "RESOLVING";
  return current;
}

// REAL AI PIPELINE: Interacts with actual Gemini API
async function runRealGeminiAgentPipeline(
  incident: Incident,
  otherIncidents: Incident[],
): Promise<Incident> {
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
            agentThought: { type: Type.STRING },
          },
          required: [
            "issue_type",
            "severity",
            "confidence",
            "location_desc",
            "detailed_description",
            "agentThought",
          ],
        },
      },
    });

    const intakeResult = JSON.parse(intakeResponse.text || "{}");
    current.intake = {
      issue_type: intakeResult.issue_type || "Road Infrastructure",
      severity: Number(intakeResult.severity) || 3,
      confidence: Number(intakeResult.confidence) || 0.9,
      location_desc: intakeResult.location_desc || current.location.address,
      detailed_description:
        intakeResult.detailed_description || current.rawDescription,
      agentThought:
        "Intake Agent [AI]: " +
        (intakeResult.agentThought || "Successfully extracted categories."),
    };

    //  verification
    const otherLogSummary = otherIncidents
      .filter((other) => other.id !== current.id)
      .map(
        (other) =>
          `ID: ${other.id}, Title: ${other.title}, Category: ${other.intake?.issue_type || "Unknown"}, Address: ${other.location.address}`,
      )
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
            agentThought: { type: Type.STRING },
          },
          required: [
            "verified",
            "duplicate_group",
            "confidence",
            "agentThought",
          ],
        },
      },
    });

    const verResult = JSON.parse(verificationResponse.text || "{}");
    current.verification = {
      verified: verResult.verified !== undefined ? verResult.verified : true,
      duplicate_group: verResult.duplicate_group || null,
      confidence: Number(verResult.confidence) || 0.85,
      agentThought:
        "Verification Agent [AI]: " +
        (verResult.agentThought || "Verification processing compiled."),
    };

    // 3. Impact Agent
    const impactPrompt = `
      You are the Impact Agent of CivicMind. Estimate community, commercial, and safety impact of this civic threat.
      Title: "${current.title}"
      Category: "${current.intake.issue_type}"
      Severity: ${current.intake.severity}/5
      Location: "${current.location.address}"
      Description: "${current.intake.detailed_description}"

      Assess potential safety hazards, population densities, proximity to schools, hospitals, transit, or grid dependencies.
      Estimate:
      - impact_score: 1 to 5
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
            agentThought: { type: Type.STRING },
          },
          required: [
            "impact_score",
            "affected_population",
            "reasoning",
            "agentThought",
          ],
        },
      },
    });

    const impResult = JSON.parse(impactResponse.text || "{}");
    current.impact = {
      impact_score: Number(impResult.impact_score) || 3,
      affected_population: Number(impResult.affected_population) || 500,
      reasoning: impResult.reasoning || "Standard residential impact corridor.",
      agentThought:
        "Impact Agent [AI]: " +
        (impResult.agentThought || "Impact weights assessed."),
    };

    // 4. Prioritization Agent
    const sevScore = current.intake.severity;
    const impScore = current.impact.impact_score;
    const verConf = current.verification.confidence;
    const priority_score = parseFloat(
      (sevScore + impScore + verConf * 2 + 1.5).toFixed(1),
    );

    let priority_rank: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" = "MEDIUM";
    let escalation_level = 1;
    if (priority_score >= 12.5) {
      priority_rank = "CRITICAL";
      escalation_level = 3;
    } else if (priority_score >= 9.5) {
      priority_rank = "HIGH";
      escalation_level = 2;
    } else if (priority_score >= 6.5) {
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
      agentThought: `Prioritization Agent [AI]: Computed priorities through mathematical composite scoring. Formula: Severity (${sevScore}) + Impact (${impScore}) + (Verification Confidence (${verConf.toFixed(2)}) * 2) + Age Factor (1.5) = ${priority_score}. Category maps to prioritization tier: ${priority_rank}.`,
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
            agentThought: { type: Type.STRING },
          },
          required: [
            "department",
            "recommended_action",
            "estimated_cost",
            "estimated_duration",
            "agentThought",
          ],
        },
      },
    });

    const resResult = JSON.parse(resolutionResponse.text || "{}");
    current.resolution = {
      department: resResult.department || "Department of Public Works",
      recommended_action:
        resResult.recommended_action ||
        "Deploy maintenance team to seal area and correct physical faults.",
      estimated_cost: Number(resResult.estimated_cost) || 1200,
      estimated_duration: resResult.estimated_duration || "2 days",
      approvedByOperator: false,
      operatorOverridden: false,
      agentThought:
        "Resolution Agent [AI]: " +
        (resResult.agentThought || "Devised dispatch routing protocols."),
    };

    current.status = "RESOLVING";
    return current;
  } catch (error) {
    console.error(
      "Gemini API Pipeline error, falling back to Simulation:",
      error,
    );
    return runSimulatedAgentPipeline(incident, otherIncidents);
  }
}

// --- ENDPOINTS ---

// File Upload Endpoint (base64) -> Firebase Storage Upload
app.post("/api/upload", checkAuth, async (req, res) => {
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
    const mimeType = matches[1];
    const extension = mimeType.split("/")[1] || "jpeg";
    const filename = `uploads/${Date.now()}-${Math.floor(Math.random() * 1000)}.${extension}`;

    let publicUrl = "";

    try {
      const bucket = getStorage().bucket();
      const file = bucket.file(filename);

      await file.save(fileBuffer, {
        metadata: { contentType: mimeType },
        public: true,
      });

      publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
      console.log("File uploaded successfully to Firebase Storage:", publicUrl);
    } catch (storageErr) {
      console.warn(
        "Firebase Storage upload failed, falling back to local file system:",
        storageErr,
      );

      const localFilename = `upload-${Date.now()}.${extension}`;
      const uploadDir = path.join(__dirname, "public", "uploads");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      fs.writeFileSync(path.join(uploadDir, localFilename), fileBuffer);
      publicUrl = `/uploads/${localFilename}`;
    }

    res.json({ imageUrl: publicUrl });
  } catch (err: any) {
    console.error("File upload failed:", err);
    res
      .status(500)
      .json({ error: "Failed to upload image", details: err.message });
  }
});

// Gamification Leaderboard API via Prisma
app.get("/api/users/leaderboard", checkAuth, async (req, res) => {
  try {
    const list = await prisma.user.findMany({
      orderBy: { points: "desc" },
    });
    res.json(list);
  } catch (err: any) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Failed to fetch leaderboard", details: err.message });
  }
});

// User Profile Creation/Lookup API via Prisma
app.post("/api/users/profile", checkAuth, async (req, res) => {
  const { email, name, role } = req.body;
  const userEmail = email || (req as any).user.email;
  const userName = name || (req as any).user.name || "Anonymous Citizen";

  if (!userEmail) {
    return res.status(400).json({ error: "Email is required." });
  }

  try {
    let user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      const avatar = `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 5000000)}?auto=format&fit=crop&q=80&w=100`;
      user = await prisma.user.create({
        data: {
          email: userEmail,
          name: userName,
          avatar,
          points: 0,
          reportsFiled: 0,
          evidenceSubmitted: 0,
          role: role === "operator" ? "operator" : "citizen",
        },
      });
    }

    res.json(user);
  } catch (err: any) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Failed to fetch profile", details: err.message });
  }
});

// 1. Get all incidents via Prisma
app.get("/api/incidents", checkAuth, async (req, res) => {
  try {
    const rawList = await prisma.incident.findMany({
      include: { evidence: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
    });

    const mapped = rawList.map((inc) => ({
      id: inc.id,
      title: inc.title,
      rawDescription: inc.rawDescription,
      imageUrl: inc.imageUrl || undefined,
      location: { lat: inc.lat, lng: inc.lng, address: inc.address },
      reporter: {
        name: inc.reporterName,
        email: inc.reporterEmail,
        avatar: inc.reporterAvatar || undefined,
      },
      createdAt: inc.createdAt.toISOString(),
      status: inc.status as any,
      upvotes: inc.upvotes,
      downvotes: inc.downvotes,
      evidence: inc.evidence.map((ev) => ({
        id: ev.id,
        author: ev.author,
        text: ev.text,
        createdAt: ev.createdAt.toISOString(),
      })),
      intake: (inc.intake as any) || undefined,
      verification: (inc.verification as any) || undefined,
      impact: (inc.impact as any) || undefined,
      prioritization: (inc.prioritization as any) || undefined,
      resolution: (inc.resolution as any) || undefined,
    }));

    res.json(mapped);
  } catch (err: any) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Failed to fetch incidents", details: err.message });
  }
});

// 2. Get single incident via Prisma
app.get("/api/incidents/:id", checkAuth, async (req, res) => {
  try {
    const inc = await prisma.incident.findUnique({
      where: { id: req.params.id },
      include: { evidence: { orderBy: { createdAt: "asc" } } },
    });
    if (!inc) {
      return res.status(404).json({ error: "Incident not found" });
    }

    res.json({
      id: inc.id,
      title: inc.title,
      rawDescription: inc.rawDescription,
      imageUrl: inc.imageUrl || undefined,
      location: { lat: inc.lat, lng: inc.lng, address: inc.address },
      reporter: {
        name: inc.reporterName,
        email: inc.reporterEmail,
        avatar: inc.reporterAvatar || undefined,
      },
      createdAt: inc.createdAt.toISOString(),
      status: inc.status as any,
      upvotes: inc.upvotes,
      downvotes: inc.downvotes,
      evidence: inc.evidence.map((ev) => ({
        id: ev.id,
        author: ev.author,
        text: ev.text,
        createdAt: ev.createdAt.toISOString(),
      })),
      intake: (inc.intake as any) || undefined,
      verification: (inc.verification as any) || undefined,
      impact: (inc.impact as any) || undefined,
      prioritization: (inc.prioritization as any) || undefined,
      resolution: (inc.resolution as any) || undefined,
    });
  } catch (err: any) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Failed to fetch incident", details: err.message });
  }
});

// 3. Create raw incident (Citizen Submission) via Prisma
app.post("/api/incidents", checkAuth, async (req, res) => {
  const {
    title,
    rawDescription,
    address,
    lat,
    lng,
    reporterName,
    reporterEmail,
    imageUrl,
  } = req.body;

  if (!title || !rawDescription) {
    return res
      .status(400)
      .json({ error: "Title and rawDescription are required fields." });
  }

  const id = `inc-${Date.now()}`;
  const latVal = Number(lat) || 37.7749 + (Math.random() - 0.5) * 0.05;
  const lngVal = Number(lng) || -122.4194 + (Math.random() - 0.5) * 0.05;
  const addr = address || "Unspecified Location, Metropolis";
  const name = reporterName || (req as any).user.name || "Anonymous Citizen";
  const email = reporterEmail || (req as any).user.email;
  const avatar = `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 5000000)}?auto=format&fit=crop&q=80&w=100`;
  const status = "SUBMITTED";

  try {
    const incident = await prisma.incident.create({
      data: {
        id,
        title,
        rawDescription,
        imageUrl: imageUrl || null,
        lat: latVal,
        lng: lngVal,
        address: addr,
        reporterName: name,
        reporterEmail: email,
        reporterAvatar: avatar,
        status,
        upvotes: 0,
        downvotes: 0,
      },
    });

    // Reward points
    await rewardPoints(email, name, 20, "reports_filed");

    res.status(201).json({
      id: incident.id,
      title: incident.title,
      rawDescription: incident.rawDescription,
      imageUrl: incident.imageUrl || undefined,
      location: {
        lat: incident.lat,
        lng: incident.lng,
        address: incident.address,
      },
      reporter: {
        name: incident.reporterName,
        email: incident.reporterEmail,
        avatar: incident.reporterAvatar || undefined,
      },
      createdAt: incident.createdAt.toISOString(),
      status: incident.status as any,
      upvotes: incident.upvotes,
      downvotes: incident.downvotes,
      evidence: [],
    });
  } catch (err: any) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Failed to save incident", details: err.message });
  }
});

// 4. Run step-by-step agent workflow on an incident via Prisma (Requires Operator role)
app.post(
  "/api/incidents/:id/analyze",
  checkAuth,
  requireOperator,
  async (req, res) => {
    try {
      const incidentDoc = await prisma.incident.findUnique({
        where: { id: req.params.id },
        include: { evidence: true },
      });
      if (!incidentDoc) {
        return res.status(404).json({ error: "Incident not found" });
      }

      await prisma.incident.update({
        where: { id: incidentDoc.id },
        data: { status: "ANALYZING" },
      });

      const currentIncident: Incident = {
        id: incidentDoc.id,
        title: incidentDoc.title,
        rawDescription: incidentDoc.rawDescription,
        imageUrl: incidentDoc.imageUrl || undefined,
        location: {
          lat: incidentDoc.lat,
          lng: incidentDoc.lng,
          address: incidentDoc.address,
        },
        reporter: {
          name: incidentDoc.reporterName,
          email: incidentDoc.reporterEmail,
          avatar: incidentDoc.reporterAvatar || undefined,
        },
        createdAt: incidentDoc.createdAt.toISOString(),
        status: "ANALYZING",
        upvotes: incidentDoc.upvotes,
        downvotes: incidentDoc.downvotes,
        evidence: incidentDoc.evidence.map((ev) => ({
          id: ev.id,
          author: ev.author,
          text: ev.text,
          createdAt: ev.createdAt.toISOString(),
        })),
        intake: (incidentDoc.intake as any) || undefined,
        verification: (incidentDoc.verification as any) || undefined,
        impact: (incidentDoc.impact as any) || undefined,
        prioritization: (incidentDoc.prioritization as any) || undefined,
        resolution: (incidentDoc.resolution as any) || undefined,
      };

      // Get all OTHER incidents
      const rawOthers = await prisma.incident.findMany({
        where: { id: { not: currentIncident.id } },
        include: { evidence: true },
      });

      const otherIncidents: Incident[] = rawOthers.map((inc) => ({
        id: inc.id,
        title: inc.title,
        rawDescription: inc.rawDescription,
        imageUrl: inc.imageUrl || undefined,
        location: { lat: inc.lat, lng: inc.lng, address: inc.address },
        reporter: {
          name: inc.reporterName,
          email: inc.reporterEmail,
          avatar: inc.reporterAvatar || undefined,
        },
        createdAt: inc.createdAt.toISOString(),
        status: inc.status as any,
        upvotes: inc.upvotes,
        downvotes: inc.downvotes,
        evidence: inc.evidence.map((ev) => ({
          id: ev.id,
          author: ev.author,
          text: ev.text,
          createdAt: ev.createdAt.toISOString(),
        })),
        intake: (inc.intake as any) || undefined,
        verification: (inc.verification as any) || undefined,
        impact: (inc.impact as any) || undefined,
        prioritization: (inc.prioritization as any) || undefined,
        resolution: (inc.resolution as any) || undefined,
      }));

      // Run pipeline
      const updated = await runRealGeminiAgentPipeline(
        currentIncident,
        otherIncidents,
      );

      // Update database record with outputs
      await prisma.incident.update({
        where: { id: updated.id },
        data: {
          status: updated.status,
          intake: updated.intake || null,
          verification: updated.verification || null,
          impact: updated.impact || null,
          prioritization: updated.prioritization || null,
          resolution: updated.resolution || null,
        },
      });

      res.json(updated);
    } catch (err: any) {
      console.error("AI Analysis failed:", err);
      res
        .status(500)
        .json({ error: "Agentic workflow failed", details: err.message });
    }
  },
);

// 5. Citizen Upvote/Downvote Community Verification via Prisma - Rewards 5 points to the voter
app.post("/api/incidents/:id/vote", checkAuth, async (req, res) => {
  try {
    const { type, voterEmail, voterName } = req.body;
    const email = voterEmail || (req as any).user.email;
    const name = voterName || (req as any).user.name || "Anonymous Citizen";

    const updateData: any = {};
    if (type === "up") {
      updateData.upvotes = { increment: 1 };
    } else if (type === "down") {
      updateData.downvotes = { increment: 1 };
    }

    const updated = await prisma.incident.update({
      where: { id: req.params.id },
      data: updateData,
      include: { evidence: { orderBy: { createdAt: "asc" } } },
    });

    // Reward points to voter
    if (email && name) {
      await rewardPoints(email, name, 5);
    }

    res.json({
      id: updated.id,
      title: updated.title,
      rawDescription: updated.rawDescription,
      imageUrl: updated.imageUrl || undefined,
      location: {
        lat: updated.lat,
        lng: updated.lng,
        address: updated.address,
      },
      reporter: {
        name: updated.reporterName,
        email: updated.reporterEmail,
        avatar: updated.reporterAvatar || undefined,
      },
      createdAt: updated.createdAt.toISOString(),
      status: updated.status as any,
      upvotes: updated.upvotes,
      downvotes: updated.downvotes,
      evidence: updated.evidence.map((ev) => ({
        id: ev.id,
        author: ev.author,
        text: ev.text,
        createdAt: ev.createdAt.toISOString(),
      })),
      intake: (updated.intake as any) || undefined,
      verification: (updated.verification as any) || undefined,
      impact: (updated.impact as any) || undefined,
      prioritization: (updated.prioritization as any) || undefined,
      resolution: (updated.resolution as any) || undefined,
    });
  } catch (err: any) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Failed to register vote", details: err.message });
  }
});

// 6. Citizen Add Evidence / Comment via Prisma - Rewards 10 points
app.post("/api/incidents/:id/evidence", checkAuth, async (req, res) => {
  const { author, text, commenterEmail } = req.body;
  if (!author || !text) {
    return res
      .status(400)
      .json({ error: "Author and text are required to save evidence." });
  }

  const id = `ev-${Date.now()}`;
  const email = commenterEmail || (req as any).user.email;
  const authorName = author || (req as any).user.name || "Anonymous Citizen";

  try {
    await prisma.evidence.create({
      data: {
        id,
        incidentId: req.params.id,
        author: authorName,
        text,
      },
    });

    // Reward points to commenter
    await rewardPoints(email, authorName, 10, "evidence_submitted");

    // Fetch updated incident
    const updated = await prisma.incident.findUnique({
      where: { id: req.params.id },
      include: { evidence: { orderBy: { createdAt: "asc" } } },
    });

    if (!updated) {
      return res.status(404).json({ error: "Incident not found" });
    }

    res.status(201).json({
      id: updated.id,
      title: updated.title,
      rawDescription: updated.rawDescription,
      imageUrl: updated.imageUrl || undefined,
      location: {
        lat: updated.lat,
        lng: updated.lng,
        address: updated.address,
      },
      reporter: {
        name: updated.reporterName,
        email: updated.reporterEmail,
        avatar: updated.reporterAvatar || undefined,
      },
      createdAt: updated.createdAt.toISOString(),
      status: updated.status as any,
      upvotes: updated.upvotes,
      downvotes: updated.downvotes,
      evidence: updated.evidence.map((ev) => ({
        id: ev.id,
        author: ev.author,
        text: ev.text,
        createdAt: ev.createdAt.toISOString(),
      })),
      intake: (updated.intake as any) || undefined,
      verification: (updated.verification as any) || undefined,
      impact: (updated.impact as any) || undefined,
      prioritization: (updated.prioritization as any) || undefined,
      resolution: (updated.resolution as any) || undefined,
    });
  } catch (err: any) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Failed to add evidence", details: err.message });
  }
});

// 7. Municipal Operator Overrides via Prisma (Requires Operator role)
app.post(
  "/api/incidents/:id/operate",
  checkAuth,
  requireOperator,
  async (req, res) => {
    try {
      const incidentDoc = await prisma.incident.findUnique({
        where: { id: req.params.id },
      });
      if (!incidentDoc) {
        return res.status(404).json({ error: "Incident not found" });
      }

      const currentIncident: Incident = {
        id: incidentDoc.id,
        title: incidentDoc.title,
        rawDescription: incidentDoc.rawDescription,
        imageUrl: incidentDoc.imageUrl || undefined,
        location: {
          lat: incidentDoc.lat,
          lng: incidentDoc.lng,
          address: incidentDoc.address,
        },
        reporter: {
          name: incidentDoc.reporterName,
          email: incidentDoc.reporterEmail,
          avatar: incidentDoc.reporterAvatar || undefined,
        },
        createdAt: incidentDoc.createdAt.toISOString(),
        status: incidentDoc.status as any,
        upvotes: incidentDoc.upvotes,
        downvotes: incidentDoc.downvotes,
        evidence: [],
        intake: (incidentDoc.intake as any) || undefined,
        verification: (incidentDoc.verification as any) || undefined,
        impact: (incidentDoc.impact as any) || undefined,
        prioritization: (incidentDoc.prioritization as any) || undefined,
        resolution: (incidentDoc.resolution as any) || undefined,
      };

      const {
        priorityRank,
        department,
        estimatedCost,
        estimatedDuration,
        status,
        approveAction,
      } = req.body;

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

      // Save operator edits via Prisma
      const updated = await prisma.incident.update({
        where: { id: currentIncident.id },
        data: {
          status: currentIncident.status,
          prioritization: currentIncident.prioritization || null,
          resolution: currentIncident.resolution || null,
        },
        include: { evidence: { orderBy: { createdAt: "asc" } } },
      });

      res.json({
        id: updated.id,
        title: updated.title,
        rawDescription: updated.rawDescription,
        imageUrl: updated.imageUrl || undefined,
        location: {
          lat: updated.lat,
          lng: updated.lng,
          address: updated.address,
        },
        reporter: {
          name: updated.reporterName,
          email: updated.reporterEmail,
          avatar: updated.reporterAvatar || undefined,
        },
        createdAt: updated.createdAt.toISOString(),
        status: updated.status as any,
        upvotes: updated.upvotes,
        downvotes: updated.downvotes,
        evidence: updated.evidence.map((ev) => ({
          id: ev.id,
          author: ev.author,
          text: ev.text,
          createdAt: ev.createdAt.toISOString(),
        })),
        intake: (updated.intake as any) || undefined,
        verification: (updated.verification as any) || undefined,
        impact: (updated.impact as any) || undefined,
        prioritization: (updated.prioritization as any) || undefined,
        resolution: (updated.resolution as any) || undefined,
      });
    } catch (err: any) {
      console.error(err);
      res
        .status(500)
        .json({ error: "Failed to save adjustments", details: err.message });
    }
  },
);

// 8. Get Predictions via Prisma
app.get("/api/predictions", checkAuth, async (req, res) => {
  try {
    const latest = await prisma.prediction.findFirst({
      orderBy: { generatedAt: "desc" },
    });
    if (!latest) {
      return res.json({
        risk_zones: [],
        predicted_failures: [],
        confidence_scores: 0,
        generatedAt: new Date().toISOString(),
      });
    }
    res.json({
      confidence_scores: latest.confidenceScores,
      generatedAt: latest.generatedAt.toISOString(),
      agentThought: latest.agentThought || undefined,
      risk_zones: latest.riskZones,
      predicted_failures: latest.predictedFailures,
    });
  } catch (err: any) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Failed to fetch predictions", details: err.message });
  }
});

// 9. Force Regenerate Predictions (Prediction Agent call to Gemini) via Prisma (Requires Operator role)
app.post(
  "/api/predictions/regenerate",
  checkAuth,
  requireOperator,
  async (req, res) => {
    try {
      const incidentsSnapshot = await prisma.incident.findMany();
      const mappedIncidents: Incident[] = incidentsSnapshot.map((inc) => ({
        id: inc.id,
        title: inc.title,
        rawDescription: inc.rawDescription,
        imageUrl: inc.imageUrl || undefined,
        location: { lat: inc.lat, lng: inc.lng, address: inc.address },
        reporter: {
          name: inc.reporterName,
          email: inc.reporterEmail,
          avatar: inc.reporterAvatar || undefined,
        },
        createdAt: inc.createdAt.toISOString(),
        status: inc.status as any,
        upvotes: inc.upvotes,
        downvotes: inc.downvotes,
        evidence: [],
        intake: (inc.intake as any) || undefined,
        verification: (inc.verification as any) || undefined,
        impact: (inc.impact as any) || undefined,
        prioritization: (inc.prioritization as any) || undefined,
        resolution: (inc.resolution as any) || undefined,
      }));

      const listSummary = mappedIncidents
        .map(
          (inc) =>
            `ID: ${inc.id}, Category: ${inc.intake?.issue_type || "Unknown"}, Address: ${inc.location.address}, Severity: ${inc.intake?.severity || "Unknown"}`,
        )
        .join("\n");

      let finalPredictionData;

      if (!ai) {
        const existing = await prisma.prediction.findFirst({
          orderBy: { generatedAt: "desc" },
        });

        finalPredictionData = {
          confidence_scores: 0.88,
          generatedAt: new Date().toISOString(),
          agentThought:
            "Prediction Agent [SIMULATED]: Refreshed municipal models. Correlated active sewer issues with sub-base erosion sensors. Risk zones expanded.",
          risk_zones: [
            {
              id: `rz-${Date.now()}-1`,
              zone: "Grand Boulevard Corridor Hub",
              risk_score: Math.min(98, 85 + Math.floor(Math.random() * 10)),
              primary_vulnerability:
                "Corroded Water Mains and Intense Utility Siltation",
              lat: 37.7794,
              lng: -122.4184,
              radius: 350,
            },
            {
              id: `rz-${Date.now()}-2`,
              zone: "Market Street West Junction",
              risk_score: Math.min(98, 72 + Math.floor(Math.random() * 10)),
              primary_vulnerability:
                "Substation Overload due to Grid Thermal Degradation",
              lat: 37.7735,
              lng: -122.4215,
              radius: 250,
            },
          ],
          predicted_failures: [
            {
              id: `pf-${Date.now()}-1`,
              item: 'Water Main Segment rupture risk (Dia 24")',
              estimate_time: "Within 72 Hours",
              confidence: 0.91,
              category: "Water & Sewage",
              location: "Grand Boulevard & 10th Ave Intersection",
            },
            {
              id: `pf-${Date.now()}-2`,
              item: "Substation Transformer Overload cascade (Phase B)",
              estimate_time: "Within 5 Days",
              confidence: 0.86,
              category: "Power & Grid",
              location: "450 Market Street Grid Vault",
            },
          ],
        };
      } else {
        const predictionPrompt = `
        You are the Prediction Agent of CivicMind. Analyze the city's active incident registry and forecast upcoming failures.
        Active Incident Log Summary:
        ${listSummary || "No active incidents."}

        Predict structural hotspots, risk zones, and impending infrastructure failures.
        Return:
        - risk_zones: list of object { id, zone, risk_score (1-100), primary_vulnerability, lat, lng, radius (meters) }
        - predicted_failures: list of object { id, item, estimate_time, confidence (0.0 to 1.0), category, location }
        - confidence_scores: average model confidence (0.0 to 1.0)
        - agentThought: internal logic.
      `;

        const predResponse = await ai.models.generateContent({
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
                      radius: { type: Type.INTEGER },
                    },
                    required: [
                      "zone",
                      "risk_score",
                      "primary_vulnerability",
                      "lat",
                      "lng",
                      "radius",
                    ],
                  },
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
                      location: { type: Type.STRING },
                    },
                    required: [
                      "item",
                      "estimate_time",
                      "confidence",
                      "category",
                      "location",
                    ],
                  },
                },
              },
              required: [
                "confidence_scores",
                "agentThought",
                "risk_zones",
                "predicted_failures",
              ],
            },
          },
        });

        const parsedPred = JSON.parse(predResponse.text || "{}");
        finalPredictionData = {
          confidence_scores: Number(parsedPred.confidence_scores) || 0.8,
          generatedAt: new Date().toISOString(),
          agentThought:
            "Prediction Agent [AI]: " +
            (parsedPred.agentThought ||
              "Re-calculated predictive failure indices."),
          risk_zones: (parsedPred.risk_zones || []).map(
            (rz: any, i: number) => ({
              id: `rz-${Date.now()}-${i}`,
              zone: rz.zone,
              risk_score: Number(rz.risk_score) || 50,
              primary_vulnerability: rz.primary_vulnerability,
              lat: Number(rz.lat) || 37.7749,
              lng: Number(rz.lng) || -122.4194,
              radius: Number(rz.radius) || 200,
            }),
          ),
          predicted_failures: (parsedPred.predicted_failures || []).map(
            (pf: any, i: number) => ({
              id: `pf-${Date.now()}-${i}`,
              item: pf.item,
              estimate_time: pf.estimate_time,
              confidence: Number(pf.confidence) || 0.7,
              category: pf.category,
              location: pf.location,
            }),
          ),
        };
      }

      const predId = `pred-${Date.now()}`;
      await prisma.prediction.create({
        data: {
          id: predId,
          confidenceScores: finalPredictionData.confidence_scores,
          generatedAt: new Date(finalPredictionData.generatedAt),
          agentThought: finalPredictionData.agentThought || null,
          riskZones: finalPredictionData.risk_zones,
          predictedFailures: finalPredictionData.predicted_failures,
        },
      });

      res.json(finalPredictionData);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({
        error: "Failed to regenerate predictions",
        details: err.message,
      });
    }
  },
);

// Vite Server Configuration in dev mode, static serving in prod
async function startServer() {
  await ensureDbInitialized();

  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) {
    const { createServer } = await import("vite");

    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "custom",
    });

    app.use(vite.middlewares);

    app.use("*", async (req, res, next) => {
      const url = req.originalUrl;

      try {
        let template = fs.readFileSync(
          path.resolve(__dirname, "index.html"),
          "utf-8",
        );

        template = await vite.transformIndexHtml(url, template);

        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    // Serve static frontend files
    const staticDir = fs.existsSync(path.join(__dirname, "index.html"))
      ? __dirname
      : path.join(__dirname, "dist");

    app.use(express.static(staticDir));
    app.get("*", (req, res) => {
      res.sendFile(path.join(staticDir, "index.html"));
    });
  }

  app.listen(PORT, () => {
    console.log(`CivicMind fully operational on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer().catch((error) => {
    console.error("Failed to start CivicMind server:", error);
    process.exit(1);
  });
}

export default app;
