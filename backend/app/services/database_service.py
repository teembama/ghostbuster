from supabase import create_client, Client
from app.config import get_settings
from typing import Dict, List, Optional
import uuid

settings = get_settings()

# Supabase / PostgREST returns at most this many rows per response by default.
# Anything calling .execute() without explicit pagination is silently capped here.
SUPABASE_PAGE_SIZE = 1000


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

    def _select_all(self, table: str, *, eq: Dict[str, str] = None, neq: Dict[str, str] = None) -> List[Dict]:
        """Paginate through a table, returning every matching row.

        Supabase's default response cap is 1000 rows. For a 50k-employee CSV
        that would silently drop 49k. Loop with .range() until a short page
        comes back.
        """
        rows: List[Dict] = []
        offset = 0
        while True:
            query = self.client.table(table).select("*")
            if eq:
                for k, v in eq.items():
                    query = query.eq(k, v)
            if neq:
                for k, v in neq.items():
                    query = query.neq(k, v)
            page = query.range(offset, offset + SUPABASE_PAGE_SIZE - 1).execute()
            data = page.data or []
            rows.extend(data)
            if len(data) < SUPABASE_PAGE_SIZE:
                break
            offset += SUPABASE_PAGE_SIZE
        return rows

    async def create_upload(self, filename: str, total_rows: int) -> str:
        upload_id = str(uuid.uuid4())
        data = {"id": upload_id, "filename": filename, "total_rows": total_rows, "status": "processing"}
        self.client.table("uploads").insert(data).execute()
        return upload_id

    def save_employees(self, upload_id: str, employees: List[Dict]) -> None:
        """Bulk-insert employee rows. Sync so background tasks (which run in
        a threadpool, not the event loop) can call it without asyncio glue.
        """
        for emp in employees:
            emp["upload_id"] = upload_id
        batch_size = 1000
        for i in range(0, len(employees), batch_size):
            batch = employees[i:i + batch_size]
            self.client.table("employees").insert(batch).execute()

    async def get_analysis_result(self, upload_id: str) -> Optional[Dict]:
        response = self.client.table("analysis_results").select("*").eq("upload_id", upload_id).execute()
        if response.data:
            return response.data[0]
        return None

    async def get_employees(self, upload_id: str, flagged_only: bool = False) -> List[Dict]:
        eq = {"upload_id": upload_id}
        neq = {"classification": "VERIFIED"} if flagged_only else None
        return self._select_all("employees", eq=eq, neq=neq)

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
