PLAN_CONFIG = {
    "plan_name": "ClearPath Health PPO",
    "accepted_insurance": [
        "Blue Cross Blue Shield",
        "Aetna",
        "United Healthcare",
        "Cigna",
        "Medicare",
        "Medicaid",
    ],
    "members": {
        "MBR001": {
            "name": "Sarah Johnson",
            "plan": "ClearPath PPO Gold",
            "deductible": {"total": 1500, "met": 800},
            "copays": {
                "primary_care": 25,
                "specialist": 50,
                "urgent_care": 75,
                "er": 250,
            },
            "benefits": {
                "physical_therapy": {"allowed": 20, "used": 7},
                "mental_health": {"allowed": 30, "used": 3},
            },
        },
        "MBR002": {
            "name": "David Kim",
            "plan": "ClearPath PPO Silver",
            "deductible": {"total": 3000, "met": 200},
            "copays": {
                "primary_care": 40,
                "specialist": 80,
                "urgent_care": 100,
                "er": 350,
            },
            "benefits": {
                "physical_therapy": {"allowed": 15, "used": 15},
                "mental_health": {"allowed": 20, "used": 8},
            },
        },
    },
    "doctors": [
        {
            "id": "D001",
            "name": "Dr. Priya Patel",
            "specialty": "Primary Care",
            "location": "Austin, TX",
            "availability": [
                {"slot": "Monday 9:00 AM", "available": True},
                {"slot": "Tuesday 2:00 PM", "available": True},
                {"slot": "Thursday 11:00 AM", "available": False},
            ],
        },
        {
            "id": "D002",
            "name": "Dr. James Okafor",
            "specialty": "Cardiology",
            "location": "Austin, TX",
            "availability": [
                {"slot": "Wednesday 10:00 AM", "available": True},
                {"slot": "Friday 3:00 PM", "available": True},
            ],
        },
        {
            "id": "D003",
            "name": "Dr. Lisa Chen",
            "specialty": "Physical Therapy",
            "location": "Austin, TX",
            "availability": [
                {"slot": "Monday 1:00 PM", "available": True},
                {"slot": "Tuesday 4:00 PM", "available": True},
                {"slot": "Wednesday 2:00 PM", "available": False},
            ],
        },
    ],
    "booked_appointments": [],
}
