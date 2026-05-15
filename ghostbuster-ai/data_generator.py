import random
import pandas as pd
from faker import Faker
from datetime import datetime, timedelta

fake = Faker()

IGBO_NAMES = {
    "first": ["Chioma", "Chukwu", "Nnamdi", "Uchenna", "Adaeze", "Okechukwu", "Chiamaka", "Chinedu"],
    "last": ["Okafor", "Nwankwo", "Eze", "Okonkwo", "Ani", "Nwosu", "Onyeka", "Obiora"],
}

YORUBA_NAMES = {
    "first": ["Ade", "Tunde", "Bola", "Femi", "Yemi", "Tayo", "Kemi", "Dele"],
    "last": ["Adeyemi", "Williams", "Ogunlesi", "Adeleke", "Adebayo", "Oyedepo"],
}

HAUSA_NAMES = {
    "first": ["Abubakar", "Fatima", "Hassan", "Amina", "Ibrahim", "Zainab", "Usman", "Aisha"],
    "last": ["Mohammed", "Yusuf", "Ibrahim", "Ahmad", "Suleiman", "Musa", "Umar"],
}


def generate_nigerian_name():
    pool = random.choice([IGBO_NAMES, YORUBA_NAMES, HAUSA_NAMES])
    return f"{random.choice(pool['first'])} {random.choice(pool['last'])}"


def generate_ministry():
    ministries = [
        "Ministry of Finance",
        "Ministry of Health",
        "Ministry of Education",
        "Federal Roads Maintenance Agency",
        "Nigeria Customs Service",
        "Ministry of Agriculture",
        "Ministry of Works",
        "Ministry of Power",
        "Ministry of Water Resources",
        "Civil Service Commission",
    ]
    return random.choice(ministries)


def generate_clean_employee():
    return {
        "name": generate_nigerian_name(),
        "ministry": generate_ministry(),
        "salary": random.randint(80000, 500000),
        "bank_account": str(random.randint(1000000000, 9999999999)),
        "bank_name": random.choice(["GTBank", "Zenith", "Access", "UBA", "First Bank"]),
        "biometric_id": f"BIO_{random.randint(10000, 99999)}",
        "attendance_rate": round(random.uniform(85.0, 98.0), 2),
        "employment_date": fake.date_between(start_date="-10y", end_date="-1y").isoformat(),
    }


def inject_ghost_workers(employees, count):
    for _ in range(count):
        emp = generate_clean_employee()
        emp["biometric_id"] = None
        emp["attendance_rate"] = 99.9
        emp["employment_date"] = fake.date_between(start_date="-2y", end_date="-6m").isoformat()
        employees.append(emp)


def inject_duplicate_identities(employees, count):
    group_sizes = [2, 2, 3, 2, 2, 3]
    generated = 0
    size_idx = 0
    while generated < count:
        size = group_sizes[size_idx % len(group_sizes)]
        shared_bio = f"BIO_{random.randint(10000, 99999)}"
        for _ in range(size):
            if generated >= count:
                break
            emp = generate_clean_employee()
            emp["biometric_id"] = shared_bio
            emp["attendance_rate"] = round(random.uniform(96.0, 99.5), 2)
            employees.append(emp)
            generated += 1
        size_idx += 1


def inject_salary_fraud(employees, count):
    today = datetime.today().date()
    for _ in range(count):
        emp = generate_clean_employee()
        emp["salary"] = random.randint(900000, 1500000)
        emp["employment_date"] = fake.date_between(start_date="-1y", end_date=today).isoformat()
        employees.append(emp)


def inject_network_fraud(employees, count):
    ring_sizes = [23, 12, 8, 7, 15, 10]
    generated = 0
    size_idx = 0
    while generated < count:
        size = ring_sizes[size_idx % len(ring_sizes)]
        shared_account = str(random.randint(1000000000, 9999999999))
        shared_bank = random.choice(["GTBank", "Zenith"])
        shared_ministry = generate_ministry()
        for _ in range(size):
            if generated >= count:
                break
            emp = generate_clean_employee()
            emp["bank_account"] = shared_account
            emp["bank_name"] = shared_bank
            emp["ministry"] = shared_ministry
            emp["attendance_rate"] = round(random.uniform(98.0, 100.0), 2)
            employees.append(emp)
            generated += 1
        size_idx += 1


def generate_full_dataset(total_employees=10000, fraud_rate=0.0847):
    clean_count = total_employees - int(total_employees * fraud_rate)
    employees = [generate_clean_employee() for _ in range(clean_count)]

    inject_ghost_workers(employees, int(total_employees * 0.031))
    inject_duplicate_identities(employees, int(total_employees * 0.020))
    inject_salary_fraud(employees, int(total_employees * 0.016))
    inject_network_fraud(employees, int(total_employees * 0.018))

    random.shuffle(employees)

    for i, emp in enumerate(employees):
        emp["id"] = f"EMP_{str(i + 1).zfill(6)}"

    return employees


if __name__ == "__main__":
    import os

    os.makedirs("generated_data", exist_ok=True)

    employees = generate_full_dataset()
    df = pd.DataFrame(employees)
    df.to_csv("generated_data/synthetic_payroll.csv", index=False)

    ghost_count = df["biometric_id"].isna().sum()
    print(f"Total employees generated: {len(df)}")
    print(f"Ghost workers (no biometric): {ghost_count}")
