# Pydantic schemas for request/response payloads
# TODO: Define models such as:
#   - Employee, EmployeeCreate
#   - UploadResponse
#   - AnalysisResult, GhostFlag
#   - SquadAccountVerification, SquadPayoutRequest/Response

from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime
from enum import Enum

# Enums
class RiskLevel(str, Enum):
    VERIFIED = "VERIFIED"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    HIGH_RISK = "HIGH_RISK"

class FlagType(str, Enum):
    ATTENDANCE = "ATTENDANCE"
    BIOMETRIC = "BIOMETRIC"
    SALARY = "SALARY"
    NETWORK = "NETWORK"

class FlagSeverity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"

# Models
class RedFlag(BaseModel):
    type: FlagType
    severity: FlagSeverity
    description: str
    evidence: str

class Employee(BaseModel):
    id: str
    name: str
    ministry: str
    salary: float
    bank_account: str
    bank_name: str
    biometric_id: Optional[str] = None
    attendance_rate: float
    employment_date: str
    fraud_score: float = Field(ge=0, le=100)
    classification: RiskLevel
    red_flags: List[RedFlag] = []

class FraudBreakdown(BaseModel):
    ghost_workers: int
    duplicate_identities: int
    salary_fraud: int
    network_fraud: int

class AnalysisResult(BaseModel):
    upload_id: str
    total_employees: int
    flagged_count: int
    estimated_loss: float
    fraud_breakdown: FraudBreakdown
    employees: List[Employee]
    processed_at: datetime
    analysis_duration_seconds: float

class UploadResponse(BaseModel):
    upload_id: str
    filename: str
    total_rows: int
    uploaded_at: datetime
    status: str = "processing"

class NetworkNode(BaseModel):
    id: str
    name: str
    type: str = "employee"
    fraud_score: float
    ministry: str

class NetworkEdge(BaseModel):
    source: str
    target: str
    type: Literal["shared_account", "shared_biometric"]
    weight: float = 1.0

class NetworkGraphData(BaseModel):
    nodes: List[NetworkNode]
    edges: List[NetworkEdge]

class AccountLookupRequest(BaseModel):
    bank_code: str
    account_number: str

class AccountLookupResponse(BaseModel):
    account_name: str
    account_number: str
    bank_code: str
    verified: bool

class TransferRequest(BaseModel):
    transaction_reference: str
    amount: str  # In Kobo
    bank_code: str
    account_number: str
    account_name: str
    currency_id: str = "NGN"
    remark: str

class TransferResponse(BaseModel):
    transaction_reference: str
    status: str
    amount: str
    recipient: str