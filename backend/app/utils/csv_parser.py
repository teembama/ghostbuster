# CSV parsing utilities
# TODO: Implement helpers to parse uploaded payroll CSVs with pandas,
# validate required columns, normalize fields, and yield Employee records.
import pandas as pd
from typing import Dict, List, Tuple
import io

class CSVParser:
    REQUIRED_COLUMNS = [
        "name",
        "ministry",
        "salary",
        "bank_account",
        "bank_name",
        "employment_date"
    ]
    
    OPTIONAL_COLUMNS = [
        "biometric_id",
        "attendance_rate"
    ]
    
    def validate_file(self, file_content: bytes) -> Tuple[bool, str]:
        """Validate CSV file structure"""
        try:
            df = pd.read_csv(io.BytesIO(file_content))
            
            # Check required columns
            missing = [col for col in self.REQUIRED_COLUMNS if col not in df.columns]
            if missing:
                return False, f"Missing columns: {', '.join(missing)}"
            
            # Check row count
            if len(df) == 0:
                return False, "CSV file is empty"
            
            if len(df) > 50000:
                return False, "File too large. Maximum 50,000 employees."
            
            return True, "Valid"
            
        except Exception as e:
            return False, f"Invalid CSV format: {str(e)}"
    
    def parse_to_dict(self, file_content: bytes) -> List[Dict]:
        """Parse CSV to list of employee dicts"""
        df = pd.read_csv(io.BytesIO(file_content))
        
        # Fill missing optional columns
        if "biometric_id" not in df.columns:
            df["biometric_id"] = None
        if "attendance_rate" not in df.columns:
            df["attendance_rate"] = 95.0
        
        # Clean data
        df["salary"] = pd.to_numeric(df["salary"], errors="coerce").fillna(0)
        df["attendance_rate"] = pd.to_numeric(df["attendance_rate"], errors="coerce").fillna(95.0)
        df["bank_account"] = df["bank_account"].astype(str).str.strip()
        
        # Convert to dict
        employees = df.to_dict(orient="records")
        return employees

parser = CSVParser()