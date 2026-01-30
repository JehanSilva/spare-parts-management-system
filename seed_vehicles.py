import os
import django

# 1. Setup Django Environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from inventory.models import Vehicle

# 2. Define the Data (Make, Model, Start_Year, End_Year)
vehicle_data = [
    # --- TOYOTA ---
    ("Toyota", "Corolla Axio (NKE165)", 2012, 2019),
    ("Toyota", "Corolla (141)", 2007, 2013),
    ("Toyota", "Corolla (121)", 2002, 2008),
    ("Toyota", "Vitz (KSP130)", 2011, 2020),
    ("Toyota", "Vitz (KSP90)", 2005, 2011),
    ("Toyota", "Aqua (Prius C)", 2012, 2021),
    ("Toyota", "Premio (260)", 2007, 2020),
    ("Toyota", "Allion (260)", 2007, 2020),
    ("Toyota", "Hiace (KDH 200)", 2005, 2023),
    ("Toyota", "Prius (ZVW30)", 2009, 2015),
    ("Toyota", "Prius (ZVW50)", 2016, 2022),
    ("Toyota", "Yaris (Belta)", 2006, 2012),
    ("Toyota", "C-HR", 2017, 2023),
    ("Toyota", "Land Cruiser Prado (150)", 2010, 2023),

    # --- PERODUA (Added) ---
    ("Perodua", "Viva (Elite)", 2007, 2014),
    ("Perodua", "Axia", 2014, 2023),
    ("Perodua", "Bezza", 2016, 2023),
    ("Perodua", "Kelisa", 2001, 2007),
    ("Perodua", "Kenari", 2000, 2009),

    # --- SUZUKI ---
    ("Suzuki", "Alto (800)", 2013, 2024),
    ("Suzuki", "Alto (Japan K-Car)", 2015, 2022),
    ("Suzuki", "Wagon R (Stingray/FZ)", 2014, 2020),
    ("Suzuki", "Swift (RS/Hybrid)", 2017, 2023),
    ("Suzuki", "Swift (Beetle)", 2005, 2011),
    ("Suzuki", "Celerio", 2014, 2020),
    ("Suzuki", "Spacia", 2015, 2020),
    ("Suzuki", "Every (Van)", 2015, 2022),
    ("Suzuki", "Baleno", 2016, 2022),

    # --- HYUNDAI (Expanded) ---
    ("Hyundai", "Grand i10", 2014, 2019),
    ("Hyundai", "Eon", 2011, 2019),  # Competitor to Alto
    ("Hyundai", "Tucson", 2010, 2015),
    ("Hyundai", "Tucson (TL)", 2016, 2021),
    ("Hyundai", "Santa Fe", 2013, 2019),
    ("Hyundai", "Elantra", 2011, 2016),
    ("Hyundai", "Accent", 2011, 2017),

    # --- HONDA ---
    ("Honda", "Vezel (RU1/RU3)", 2014, 2021),
    ("Honda", "Fit (GP5)", 2013, 2019),
    ("Honda", "Fit (GP1)", 2010, 2013),
    ("Honda", "Grace", 2014, 2020),
    ("Honda", "Civic (FK7/FC1)", 2016, 2021),
    ("Honda", "Civic (FD)", 2006, 2011),
    ("Honda", "CR-V (RW)", 2017, 2022),
    ("Honda", "Insight", 2009, 2014),

    # --- NISSAN ---
    ("Nissan", "Leaf (ZE0)", 2011, 2017),
    ("Nissan", "Leaf (ZE1)", 2018, 2023),
    ("Nissan", "X-Trail (Hybrid)", 2014, 2022),
    ("Nissan", "NV200 (Vanette)", 2010, 2020),
    ("Nissan", "Sunny (N17)", 2011, 2018),
    ("Nissan", "Sunny (FB15)", 1999, 2004),
    ("Nissan", "March (K13)", 2011, 2017),

    # --- MITSUBISHI ---
    ("Mitsubishi", "Montero Sport", 2010, 2015),
    ("Mitsubishi", "L200 (Sportero)", 2010, 2020),
    ("Mitsubishi", "Lancer (EX)", 2008, 2016),

    # --- OTHERS ---
    ("Micro", "Panda", 2011, 2018),
    ("Micro", "Panda Cross", 2014, 2019),
    ("Kia", "Picanto", 2012, 2019),
    ("Kia", "Sorento", 2010, 2018),
    ("Kia", "Sportage", 2011, 2018),
    ("Mazda", "Axela (3)", 2014, 2019),
]

def seed_db():
    print("🚗 Starting Database Refresh...")

    # --- STEP 1: DELETE OLD DATA ---
    print("🗑️  Deleting existing vehicles from the database...")
    deleted_count, _ = Vehicle.objects.all().delete()
    print(f"✅ Deleted {deleted_count} old records.")

    # --- STEP 2: ADD NEW DATA ---
    print("\n🌱 Seeding new car list...")
    count = 0
    
    for make, model, start_year, end_year in vehicle_data:
        for year in range(start_year, end_year + 1):
            obj, created = Vehicle.objects.get_or_create(
                make=make,
                model=model,
                year=year
            )
            if created:
                if count % 10 == 0: 
                    print(f"   Created: {make} {model} - {year}")
                count += 1

    print(f"\n✅ SUCCESS: Added {count} new cars to the database!")

if __name__ == '__main__':
    seed_db()