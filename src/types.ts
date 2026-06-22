export interface Incident {
  id: string;
  title: string;
  rawDescription: string;
  imageUrl?: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  reporter: {
    name: string;
    email: string;
    avatar?: string;
  };
  createdAt: string;
  status: 'SUBMITTED' | 'ANALYZING' | 'VERIFIED' | 'PRIORITIZED' | 'RESOLVING' | 'RESOLVED' | 'REJECTED';
  
  // Citizen verification stats
  upvotes: number;
  downvotes: number;
  evidence: {
    id: string;
    author: string;
    text: string;
    createdAt: string;
  }[];

  // Agent Outputs
  intake?: {
    issue_type: string;
    severity: number; // 1-5
    confidence: number; // 0-1
    location_desc: string;
    detailed_description: string;
    agentThought?: string;
  };
  
  verification?: {
    verified: boolean;
    duplicate_group: string | null;
    confidence: number; // 0-1
    agentThought?: string;
  };
  
  impact?: {
    impact_score: number; // 1-5
    affected_population: number;
    reasoning: string;
    agentThought?: string;
  };
  
  prioritization?: {
    priority_score: number; // derived from formula: Severity + Impact + Verification Confidence + Age Factor
    priority_rank: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    escalation_level: number; // 1-3
    agentThought?: string;
  };
  
  resolution?: {
    department: string;
    recommended_action: string;
    estimated_cost: number;
    estimated_duration: string;
    approvedByOperator: boolean;
    operatorOverridden: boolean;
    agentThought?: string;
  };
}

export interface RiskZone {
  id: string;
  zone: string;
  risk_score: number; // 1-100
  primary_vulnerability: string;
  lat: number;
  lng: number;
  radius: number; // meters
}

export interface PredictedFailure {
  id: string;
  item: string;
  estimate_time: string;
  confidence: number;
  category: string;
  location: string;
}

export interface PredictionData {
  risk_zones: RiskZone[];
  predicted_failures: PredictedFailure[];
  confidence_scores: number;
  generatedAt: string;
  agentThought?: string;
}

export interface AgentStatus {
  id: string;
  name: string;
  status: 'IDLE' | 'ACTIVE' | 'COMPLETED' | 'FAILED';
  lastActive: string;
}
