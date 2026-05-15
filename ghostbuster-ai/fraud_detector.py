import pandas as pd
from typing import List, Dict


class FraudDetector:

    def detect_ghost_workers(self, df: pd.DataFrame) -> pd.Series:
        return df["biometric_id"].isna() & (df["attendance_rate"] > 99.0)

    def detect_duplicate_identities(self, df: pd.DataFrame) -> pd.Series:
        counts = df["biometric_id"].value_counts()
        return df["biometric_id"].map(counts).fillna(0) >= 3

    def detect_salary_fraud(self, df: pd.DataFrame) -> pd.Series:
        dates = pd.to_datetime(df["employment_date"])
        days_employed = (pd.Timestamp.now() - dates).dt.days
        return (df["salary"] > 800000) | ((df["salary"] > 600000) & (days_employed < 365))

    def detect_network_fraud(self, df: pd.DataFrame) -> pd.Series:
        counts = df["bank_account"].value_counts()
        return df["bank_account"].map(counts).fillna(0) >= 5

    def calculate_fraud_score(self, df: pd.DataFrame) -> pd.Series:
        ghost = self.detect_ghost_workers(df)
        dupes = self.detect_duplicate_identities(df)
        salary = self.detect_salary_fraud(df)
        network = self.detect_network_fraud(df)

        scores = (
            ghost.astype(int) * 50
            + dupes.astype(int) * 40
            + salary.astype(int) * 30
            + network.astype(int) * 45
        )

        combo_count = ghost.astype(int) + dupes.astype(int) + salary.astype(int) + network.astype(int)
        scores += (combo_count >= 2).astype(int) * 20

        return scores.clip(upper=100)

    def generate_red_flags(self, row: pd.Series, df: pd.DataFrame) -> List[Dict]:
        flags = []

        if pd.isna(row["biometric_id"]) and row["attendance_rate"] > 99.0:
            flags.append({
                "type": "BIOMETRIC",
                "severity": "HIGH",
                "description": "No biometric record with perfect attendance",
                "evidence": f"Missing biometric but {row['attendance_rate']}% attendance",
            })

        if not pd.isna(row["biometric_id"]):
            count = (df["biometric_id"] == row["biometric_id"]).sum()
            if count > 1:
                flags.append({
                    "type": "BIOMETRIC",
                    "severity": "HIGH",
                    "description": f"Biometric ID shared with {count - 1} other(s)",
                    "evidence": f"BIO {row['biometric_id']} appears {count} times",
                })

        if row["salary"] > 800000:
            flags.append({
                "type": "SALARY",
                "severity": "MEDIUM",
                "description": "Salary exceeds civil service range",
                "evidence": f"₦{row['salary']:,}/month",
            })
        elif row["salary"] > 600000:
            days_employed = (pd.Timestamp.now() - pd.to_datetime(row["employment_date"])).days
            if days_employed < 365:
                flags.append({
                    "type": "SALARY",
                    "severity": "MEDIUM",
                    "description": "Salary exceeds civil service range",
                    "evidence": f"₦{row['salary']:,}/month",
                })

        account_count = (df["bank_account"] == row["bank_account"]).sum()
        if account_count >= 5:
            flags.append({
                "type": "NETWORK",
                "severity": "HIGH",
                "description": f"Bank account receives {account_count} salaries",
                "evidence": f"Account {row['bank_account']} linked to {account_count} employees",
            })

        if row["attendance_rate"] > 99.5:
            flags.append({
                "type": "ATTENDANCE",
                "severity": "MEDIUM",
                "description": "Attendance statistically improbable",
                "evidence": f"{row['attendance_rate']}% attendance",
            })

        return flags

    def classify_risk(self, score: float) -> str:
        if score >= 50:
            return "HIGH_RISK"
        if score >= 25:
            return "REVIEW_REQUIRED"
        return "VERIFIED"

    def analyze(self, employees: List[Dict]) -> Dict:
        df = pd.DataFrame(employees)

        df["fraud_score"] = self.calculate_fraud_score(df)
        df["classification"] = df["fraud_score"].map(self.classify_risk)

        flagged_mask = df["classification"] != "VERIFIED"

        df["red_flags"] = None
        for idx in df[flagged_mask].index:
            df.at[idx, "red_flags"] = self.generate_red_flags(df.loc[idx], df)

        flagged_count = flagged_mask.sum()
        estimated_loss = int(pd.to_numeric(df.loc[flagged_mask, "salary"], errors="coerce").clip(upper=500000).sum() * 12)

        fraud_breakdown = {
            "ghost_workers": int(self.detect_ghost_workers(df).sum()),
            "duplicate_identities": int(self.detect_duplicate_identities(df).sum()),
            "salary_fraud": int(self.detect_salary_fraud(df).sum()),
            "network_fraud": int(self.detect_network_fraud(df).sum()),
        }

        return {
            "flagged_count": int(flagged_count),
            "estimated_loss": estimated_loss,
            "fraud_breakdown": fraud_breakdown,
            "employees": df.to_dict(orient="records"),
        }
