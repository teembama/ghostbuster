from supabase import create_client, Client
from app.config import get_settings
from typing import Dict, List, Optional
import uuid

settings = get_settings()

class DatabaseService:
    def __init__(self):
        try:
            self._client: Optional[Client] = create_client(
                settings.supabase_url,
                settings.supabase_key
            )
        except Exception as e:
            print(f"⚠️  Supabase connection failed: {e}")
            self._client = None

    @property
    def client(self) -> Client:
        if self._client is None:
            raise RuntimeError(
                "Supabase client is not connected. Check SUPABASE_URL and "
                "SUPABASE_KEY environment variables, then restart the service."
            )
        return self._client

    async def create_upload(self, filename: str, total_rows: int) -> str:
        upload_id = str(uuid.uuid4())
        data = {"id": upload_id, "filename": filename, "total_rows": total_rows, "status": "processing"}
        self.client.table("uploads").insert(data).execute()
        return upload_id

    async def save_employees(self, upload_id: str, employees: List[Dict]):
        for emp in employees:
            emp["upload_id"] = upload_id
        self.client.table("employees").insert(employees).execute()

    async def get_analysis_result(self, upload_id: str) -> Optional[Dict]:
        response = self.client.table("analysis_results").select("*").eq("upload_id", upload_id).execute()
        if response.data:
            return response.data[0]
        return None

    async def get_employees(self, upload_id: str, flagged_only: bool = False) -> List[Dict]:
        query = self.client.table("employees").select("*").eq("upload_id", upload_id)
        if flagged_only:
            query = query.neq("classification", "VERIFIED")
        return query.execute().data

    async def get_employee_by_id(self, employee_id: str) -> Optional[Dict]:
        response = self.client.table("employees").select("*").eq("id", employee_id).execute()
        if response.data:
            return response.data[0]
        return None


_db_instance = None

def get_db() -> "DatabaseService":
    global _db_instance
    if _db_instance is None:
        _db_instance = DatabaseService()
    return _db_instance

class _LazyDB:
    def __getattr__(self, name):
        return getattr(get_db(), name)

db = _LazyDB()