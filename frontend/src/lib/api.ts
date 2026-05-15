// ─── Config ───────────────────────────────────────────────────────────────────

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ─── Error class ──────────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  detail: string;
  body: unknown;

  constructor(status: number, detail: string, body?: unknown) {
    super(`API ${status}: ${detail}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.body = body;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────
// Mirror app/models/schemas.py — keep these in sync with the backend.

export type Classification = "VERIFIED" | "REVIEW_REQUIRED" | "HIGH_RISK";
export type FlagType = "ATTENDANCE" | "BIOMETRIC" | "SALARY" | "NETWORK";
export type FlagSeverity = "LOW" | "MEDIUM" | "HIGH";

export interface RedFlag {
  type: FlagType;
  severity: FlagSeverity;
  description: string;
  evidence: string;
}

export interface Employee {
  id: string;
  name: string;
  ministry: string;
  salary: number;
  bank_account: string;
  bank_name: string;
  biometric_id: string | null;
  attendance_rate: number;
  employment_date: string;
  fraud_score: number;
  classification: Classification;
  red_flags: RedFlag[];
}

export interface FraudBreakdown {
  ghost_workers: number;
  duplicate_identities: number;
  salary_fraud: number;
  network_fraud: number;
}

export interface UploadResponse {
  upload_id: string;
  filename: string;
  total_rows: number;
  uploaded_at: string;
  status: string;
}

export interface AnalysisResult {
  upload_id: string;
  total_employees: number;
  flagged_count: number;
  estimated_loss: number;
  fraud_breakdown: FraudBreakdown;
  employees: Employee[];
  processed_at: string;
  analysis_duration_seconds: number;
}

// /analysis/results returns 202 + this body while the background task runs.
export interface AnalysisPending {
  status: "processing";
}

export interface EmployeesPage {
  employees: Employee[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface NetworkNode {
  id: string;
  name: string;
  type: string;
  fraud_score: number;
  ministry: string;
}

export interface NetworkEdge {
  source: string;
  target: string;
  type: "shared_account" | "shared_biometric";
  weight: number;
}

export interface NetworkGraphData {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
}

export interface Bank {
  name: string;
  code: string;
}

export interface BanksResponse {
  banks: Bank[];
}

export interface DisburseTransaction {
  employee_id: string;
  employee_name: string;
  transaction_reference: string;
  amount_naira: number;
  success: boolean;
  status: string;
}

export interface DisburseResponse {
  total: number;
  successful: number;
  failed: number;
  total_amount_naira: number;
  transactions: DisburseTransaction[];
  dry_run: boolean;
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Accept: "application/json", ...init?.headers },
      ...init,
    });
  } catch (err) {
    // Network failure (server down, CORS, DNS, etc.) — fetch rejects rather
    // than returning a Response, so we wrap it in ApiError with status 0.
    const message = err instanceof Error ? err.message : "Network error";
    throw new ApiError(0, message, err);
  }

  if (!res.ok) {
    let detail = res.statusText;
    let body: unknown = undefined;
    try {
      body = await res.json();
      if (body && typeof body === "object" && "detail" in body) {
        detail = String((body as { detail: unknown }).detail);
      }
    } catch {
      // Body wasn't JSON; leave detail as statusText.
    }
    throw new ApiError(res.status, detail, body);
  }

  return res.json() as Promise<T>;
}

// ─── Endpoints ────────────────────────────────────────────────────────────────

// POST /api/upload — multipart upload, triggers background analysis.
export async function uploadPayroll(file: File): Promise<UploadResponse> {
  const body = new FormData();
  body.append("file", file);
  return request<UploadResponse>("/api/upload", { method: "POST", body });
}

// GET /api/analysis/results/{upload_id}
// Returns 200 with AnalysisResult once analysis is complete, or 202 with
// { status: "processing" } while the background task is still running.
export async function getAnalysisResults(
  uploadId: string,
): Promise<AnalysisResult | AnalysisPending> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/analysis/results/${uploadId}`, {
      headers: { Accept: "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    throw new ApiError(0, message, err);
  }

  if (res.status === 202) {
    return { status: "processing" };
  }

  if (!res.ok) {
    let detail = res.statusText;
    let body: unknown = undefined;
    try {
      body = await res.json();
      if (body && typeof body === "object" && "detail" in body) {
        detail = String((body as { detail: unknown }).detail);
      }
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, detail, body);
  }

  return res.json() as Promise<AnalysisResult>;
}

export interface ListEmployeesOptions {
  page?: number;
  page_size?: number;
  classification?: Classification;
  sort_by?:
    | "fraud_score"
    | "name"
    | "salary"
    | "ministry"
    | "attendance_rate"
    | "classification"
    | "employment_date";
  sort_desc?: boolean;
}

// GET /api/employees/{upload_id}?page=&page_size=&classification=&sort_by=&sort_desc=
export async function listEmployees(
  uploadId: string,
  opts: ListEmployeesOptions = {},
): Promise<EmployeesPage> {
  const params = new URLSearchParams();
  if (opts.page !== undefined) params.set("page", String(opts.page));
  if (opts.page_size !== undefined)
    params.set("page_size", String(opts.page_size));
  if (opts.classification) params.set("classification", opts.classification);
  if (opts.sort_by) params.set("sort_by", opts.sort_by);
  if (opts.sort_desc !== undefined)
    params.set("sort_desc", String(opts.sort_desc));

  const qs = params.toString();
  return request<EmployeesPage>(
    `/api/employees/${uploadId}${qs ? `?${qs}` : ""}`,
  );
}

// GET /api/analysis/graph/{upload_id}
export async function getNetworkGraph(
  uploadId: string,
): Promise<NetworkGraphData> {
  return request<NetworkGraphData>(`/api/analysis/graph/${uploadId}`);
}

// GET /api/employee/{employee_id} — single-employee lookup.
export async function getEmployee(employeeId: string): Promise<Employee> {
  return request<Employee>(`/api/employee/${employeeId}`);
}

// GET /api/squad/banks
export async function listBanks(): Promise<BanksResponse> {
  return request<BanksResponse>("/api/squad/banks");
}

// POST /api/squad/disburse/{upload_id}
// dry_run defaults to true on the backend; we mirror that here.
export async function disburseSalaries(
  uploadId: string,
  dryRun: boolean = true,
): Promise<DisburseResponse> {
  return request<DisburseResponse>(`/api/squad/disburse/${uploadId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dry_run: dryRun }),
  });
}
