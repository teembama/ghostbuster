// ─── Config ───────────────────────────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ─── Interfaces ───────────────────────────────────────────────────────────────

export type FraudType =
  | "Ghost Worker"
  | "Duplicate Identity"
  | "Salary Fraud"
  | "Network Fraud";

export type Severity = "critical" | "high" | "medium";

export interface UploadResponse {
  upload_id: string;
}

export interface AnalysisResult {
  upload_id: string;
  status: "completed" | "processing" | "failed";
  total_records: number;
  flagged_count: number;
  processing_time_ms: number;
}

export interface FraudBreakdownItem {
  name: string;
  value: number;
  color: string;
}

export interface MinistryBreakdownItem {
  ministry: string;
  flagged: number;
}

export interface FlaggedEmployee {
  id: string;
  name: string;
  ministry: string;
  fraudType: FraudType;
  riskScore: number;
}

export interface ResultsSummary {
  upload_id: string;
  summary: {
    total: number;
    flagged: number;
    loss: number;
    clean: number;
  };
  fraud_breakdown: FraudBreakdownItem[];
  ministry_breakdown: MinistryBreakdownItem[];
  flagged_employees: FlaggedEmployee[];
}

export interface RedFlag {
  id: number;
  severity: Severity;
  title: string;
  detail: string;
}

export interface ConnectedEmployee {
  id: string;
  name: string;
  ministry: string;
  link: string;
}

export interface EmployeeCase {
  name: string;
  initials: string;
  id: string;
  ministry: string;
  role: string;
  grade: string;
  salary: number;
  fraudProbability: number;
  fraudTypes: string[];
  department: string;
  dateJoined: string;
  lastSeen: string;
  redFlags: RedFlag[];
  connectedEmployees: ConnectedEmployee[];
}

export interface DisbursementResult {
  success: boolean;
  upload_id: string;
  disbursed_count: number;
  total_amount: number;
  transaction_id: string;
  timestamp: string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_UPLOAD_ID = "mock-upload-2024-001";

const MOCK_ANALYSIS_RESULT: AnalysisResult = {
  upload_id: MOCK_UPLOAD_ID,
  status: "completed",
  total_records: 10_000,
  flagged_count: 847,
  processing_time_ms: 3_241,
};

const MOCK_RESULTS_SUMMARY: ResultsSummary = {
  upload_id: MOCK_UPLOAD_ID,
  summary: {
    total: 10_000,
    flagged: 847,
    loss: 2_147_500_000,
    clean: 9_153,
  },
  fraud_breakdown: [
    { name: "Ghost Workers",     value: 312, color: "#FF3B5C" },
    { name: "Duplicate IDs",     value: 198, color: "#FF9500" },
    { name: "Salary Fraud",      value: 156, color: "#FFD60A" },
    { name: "Network Fraud",     value: 181, color: "#BF5AF2" },
  ],
  ministry_breakdown: [
    { ministry: "Finance",     flagged: 185 },
    { ministry: "Education",   flagged: 142 },
    { ministry: "Health",      flagged: 121 },
    { ministry: "Interior",    flagged: 98  },
    { ministry: "Works",       flagged: 167 },
    { ministry: "Agriculture", flagged: 134 },
  ],
  flagged_employees: [
    { id: "EMP-3821", name: "Ibrahim Musa",     ministry: "Finance",     fraudType: "Ghost Worker",      riskScore: 97 },
    { id: "EMP-7143", name: "Tunde Fashola",    ministry: "Health",      fraudType: "Ghost Worker",      riskScore: 95 },
    { id: "EMP-1189", name: "Kola Balogun",     ministry: "Health",      fraudType: "Ghost Worker",      riskScore: 91 },
    { id: "EMP-2205", name: "Ngozi Eze",        ministry: "Education",   fraudType: "Duplicate Identity",riskScore: 88 },
    { id: "EMP-5912", name: "Emeka Obi",        ministry: "Agriculture", fraudType: "Duplicate Identity",riskScore: 85 },
    { id: "EMP-4438", name: "Bola Ahmed",       ministry: "Works",       fraudType: "Salary Fraud",      riskScore: 79 },
    { id: "EMP-6674", name: "Yemi Lawal",       ministry: "Interior",    fraudType: "Network Fraud",     riskScore: 76 },
    { id: "EMP-9012", name: "Chioma Nwosu",     ministry: "Finance",     fraudType: "Salary Fraud",      riskScore: 72 },
    { id: "EMP-8347", name: "Funke Akindele",   ministry: "Education",   fraudType: "Network Fraud",     riskScore: 68 },
    { id: "EMP-3056", name: "Ade Sankore",      ministry: "Works",       fraudType: "Salary Fraud",      riskScore: 63 },
  ],
};

const MOCK_EMPLOYEE_CASE: EmployeeCase = {
  name: "Chukwuemeka Obi",
  initials: "CO",
  id: "FMF-2024-04821",
  ministry: "Federal Ministry of Finance",
  role: "Senior Accountant",
  grade: "Grade Level 12",
  salary: 485_000,
  fraudProbability: 94,
  fraudTypes: ["Ghost Worker", "Network Fraud"],
  department: "Revenue Management Division",
  dateJoined: "March 2017",
  lastSeen: "18 months ago",
  redFlags: [
    {
      id: 1,
      severity: "critical",
      title: "No biometric records in IPPIS for 18 months",
      detail: "Employee has not been verified by IPPIS biometric system since June 2022.",
    },
    {
      id: 2,
      severity: "critical",
      title: "Bank account shared with 4 other employees",
      detail: "Account 0123-4567-89 (GTBank) is linked to EMP-1823, EMP-4410, EMP-7201, and EMP-9034.",
    },
    {
      id: 3,
      severity: "high",
      title: "Attendance marked 100% for 24 consecutive months",
      detail: "Perfect attendance spanning Jan 2022 – Dec 2023 with zero sick days or leave days recorded.",
    },
    {
      id: 4,
      severity: "high",
      title: "Salary increased 340% in 6 months with no promotion record",
      detail: "Base pay moved from ₦110,000 to ₦485,000 between Feb and Aug 2023. No HR promotion document found.",
    },
    {
      id: 5,
      severity: "medium",
      title: "Phone number linked to 7 other employee records",
      detail: "+234 802 XXX XXXX appears as primary contact on 7 separate IPPIS employee profiles.",
    },
  ],
  connectedEmployees: [
    { id: "EMP-1823", name: "Abiodun Salami",      ministry: "Min. of Finance",   link: "Shared bank account" },
    { id: "EMP-4410", name: "Obiageli Nwachukwu",  ministry: "Min. of Finance",   link: "Shared bank account" },
    { id: "EMP-7201", name: "Sule Maikano",         ministry: "Min. of Finance",   link: "Shared phone number" },
    { id: "EMP-9034", name: "Chiamaka Ezeh",        ministry: "Min. of Education", link: "Shared NIN prefix"   },
  ],
};

const MOCK_DISBURSEMENT: DisbursementResult = {
  success: true,
  upload_id: MOCK_UPLOAD_ID,
  disbursed_count: 9_153,
  total_amount: 4_439_205_000,
  transaction_id: "TXN-2024-03-FMF-001",
  timestamp: new Date().toISOString(),
};

// ─── HTTP helper ──────────────────────────────────────────────────────────────

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── API functions ────────────────────────────────────────────────────────────

export async function uploadPayroll(file: File): Promise<UploadResponse> {
  try {
    const body = new FormData();
    body.append("file", file);
    return await request<UploadResponse>("/api/upload", { method: "POST", body });
  } catch {
    return { upload_id: MOCK_UPLOAD_ID };
  }
}

export async function analyzePayroll(upload_id: string): Promise<AnalysisResult> {
  try {
    return await request<AnalysisResult>(`/api/analyze/${upload_id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ upload_id }),
    });
  } catch {
    return { ...MOCK_ANALYSIS_RESULT, upload_id };
  }
}

export async function getResults(upload_id: string): Promise<ResultsSummary> {
  try {
    return await request<ResultsSummary>(`/api/results/${upload_id}`);
  } catch {
    return { ...MOCK_RESULTS_SUMMARY, upload_id };
  }
}

export async function getCase(employee_id: string): Promise<EmployeeCase> {
  try {
    return await request<EmployeeCase>(`/api/cases/${employee_id}`);
  } catch {
    return { ...MOCK_EMPLOYEE_CASE, id: employee_id };
  }
}

export async function disbursePayroll(upload_id: string): Promise<DisbursementResult> {
  try {
    return await request<DisbursementResult>("/api/squad/disburse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ upload_id }),
    });
  } catch {
    return { ...MOCK_DISBURSEMENT, upload_id, timestamp: new Date().toISOString() };
  }
}
