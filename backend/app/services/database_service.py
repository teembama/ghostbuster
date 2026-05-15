# Database service
# TODO: Wrap the Supabase client for CRUD operations on employees,
# uploads, and analysis runs. Provide functions like:
#   - get_supabase_client()
#   - insert_employees(records)
#   - list_employees(filters)
#   - save_analysis_run(result)

from supabase import create_client, Client
from app.config import get_settings
from typing import Dict, List, Optional
import uuid

settings = get_settings()

class DatabaseService:
    def __init__(self):
        self.client: Client = create_client(
            settings.supabase_url,
            settings.supabase_key
        )
    
    async def create_upload(self, filename: str, total_rows: int) -> str:
        """Create upload record and return upload_id"""
        upload_id = str(uuid.uuid4())
        
        data = {
            "id": upload_id,
            "filename": filename,
            "total_rows": total_rows,
            "status": "processing"
        }
        
        response = self.client.table("uploads").insert(data).execute()
        return upload_id
    
    async def save_employees(self, upload_id: str, employees: List[Dict]):
        """Bulk insert employees"""
        for emp in employees:
            emp["upload_id"] = upload_id
        
        response = self.client.table("employees").insert(employees).execute()
        return response
    
    async def get_analysis_result(self, upload_id: str) -> Optional[Dict]:
        """Fetch analysis results"""
        response = self.client.table("analysis_results") \
            .select("*") \
            .eq("upload_id", upload_id) \
            .execute()
        
        if response.data:
            return response.data[0]
        return None
    
    async def get_employees(self, upload_id: str, flagged_only: bool = False) -> List[Dict]:
        """Fetch employees for upload"""
        query = self.client.table("employees").select("*").eq("upload_id", upload_id)
        
        if flagged_only:
            query = query.neq("classification", "VERIFIED")
        
        response = query.execute()
        return response.data
    
    async def get_employee_by_id(self, employee_id: str) -> Optional[Dict]:
        """Fetch single employee"""
        response = self.client.table("employees") \
            .select("*") \
            .eq("id", employee_id) \
            .execute()
        
        if response.data:
            return response.data[0]
        return None

# Singleton instance
db = DatabaseService()