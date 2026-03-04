import logging
import os
import random
import time
from difflib import SequenceMatcher

from livekit.agents import Agent, RunContext, function_tool

from agent.mock_data import PLAN_CONFIG
from agent.sheets import append_appointment, update_sms_status
from agent.sms import send_booking_confirmation

logger = logging.getLogger("clearpath-tools")


def _fuzzy_match(query: str, target: str, threshold: float = 0.6) -> bool:
    return SequenceMatcher(None, query.lower(), target.lower()).ratio() >= threshold


@function_tool()
async def verify_insurance(context: RunContext, insurance_name: str) -> str:
    """Check if an insurance provider is accepted by ClearPath Health.

    Args:
        insurance_name: The name of the insurance provider to check.
    """
    for accepted in PLAN_CONFIG["accepted_insurance"]:
        if _fuzzy_match(insurance_name, accepted):
            return (
                f"Yes, {accepted} is accepted by ClearPath Health. "
                f"We accept the following plans: {', '.join(PLAN_CONFIG['accepted_insurance'])}."
            )

    return (
        f"I'm sorry, {insurance_name} does not appear to be in our list of accepted providers. "
        f"We currently accept: {', '.join(PLAN_CONFIG['accepted_insurance'])}. "
        f"Would you like me to connect you with a representative for more details?"
    )


@function_tool()
async def lookup_benefits(
    context: RunContext, member_id: str, benefit_type: str
) -> str:
    """Look up benefit information for a ClearPath Health member.

    Args:
        member_id: The member's ID (e.g. MBR001).
        benefit_type: The type of benefit to look up. One of: deductible, copay, physical_therapy, mental_health.
    """
    member = PLAN_CONFIG["members"].get(member_id.upper())
    if not member:
        return (
            f"I couldn't locate member ID {member_id}. "
            "Could you double-check that number? It should start with MBR followed by digits."
        )

    name = member["name"]

    if benefit_type == "deductible":
        ded = member["deductible"]
        remaining = ded["total"] - ded["met"]
        return (
            f"{name}, your annual deductible is ${ded['total']}. "
            f"You've met ${ded['met']} so far, with ${remaining} remaining."
        )

    if benefit_type == "copay":
        copays = member["copays"]
        lines = [f"{k.replace('_', ' ').title()}: ${v}" for k, v in copays.items()]
        return (
            f"{name}, here are your copay amounts:\n"
            + "\n".join(lines)
            + "\nWould you like details on a specific visit type?"
        )

    if benefit_type in ("physical_therapy", "mental_health"):
        benefit = member["benefits"].get(benefit_type)
        if not benefit:
            return f"I don't have {benefit_type.replace('_', ' ')} benefit info on file for {name}."
        remaining = benefit["allowed"] - benefit["used"]
        label = benefit_type.replace("_", " ").title()
        if remaining <= 0:
            return (
                f"{name}, you've used all {benefit['allowed']} of your {label} visits for this plan year. "
                "You may want to speak with a representative about additional coverage options."
            )
        return (
            f"{name}, your {label} benefit allows {benefit['allowed']} visits per year. "
            f"You've used {benefit['used']}, so you have {remaining} visits remaining."
        )

    return (
        f"I'm not sure how to look up '{benefit_type}'. "
        "I can help with: deductible, copay, physical_therapy, or mental_health."
    )


@function_tool()
async def check_doctor_availability(
    context: RunContext,
    specialty: str = "",
    doctor_name: str = "",
) -> str:
    """Search for available doctor appointment slots by specialty or doctor name.

    Args:
        specialty: The medical specialty to search for (e.g. Primary Care, Cardiology).
        doctor_name: The doctor's name to search for.
    """
    matches = []

    for doc in PLAN_CONFIG["doctors"]:
        if specialty and _fuzzy_match(specialty, doc["specialty"]):
            matches.append(doc)
        elif doctor_name and _fuzzy_match(doctor_name, doc["name"]):
            matches.append(doc)

    if not matches:
        available_specialties = sorted(set(d["specialty"] for d in PLAN_CONFIG["doctors"]))
        return (
            "I couldn't find a match for that search. "
            f"We have doctors in the following specialties: {', '.join(available_specialties)}. "
            "Would you like to search one of those?"
        )

    results = []
    for doc in matches:
        open_slots = [s["slot"] for s in doc["availability"] if s["available"]]
        if open_slots:
            results.append(
                f"{doc['name']} ({doc['specialty']}) in {doc['location']} — "
                f"Available: {', '.join(open_slots)}. Doctor ID: {doc['id']}"
            )
        else:
            results.append(
                f"{doc['name']} ({doc['specialty']}) — No available slots at this time."
            )

    return "\n".join(results)


@function_tool()
async def book_appointment(
    context: RunContext, doctor_id: str, slot: str, member_id: str
) -> str:
    """Book an appointment with a doctor for a ClearPath Health member.

    Args:
        doctor_id: The doctor's ID (e.g. D001).
        slot: The time slot to book (e.g. Monday 9:00 AM).
        member_id: The member's ID (e.g. MBR001).
    """
    member = PLAN_CONFIG["members"].get(member_id.upper())
    if not member:
        return f"I couldn't locate member ID {member_id}. Please verify and try again."

    doctor = None
    for doc in PLAN_CONFIG["doctors"]:
        if doc["id"].upper() == doctor_id.upper():
            doctor = doc
            break

    if not doctor:
        return f"I couldn't find a doctor with ID {doctor_id}."

    target_slot = None
    for s in doctor["availability"]:
        if s["slot"].lower() == slot.lower():
            target_slot = s
            break

    if not target_slot:
        available = [s["slot"] for s in doctor["availability"]]
        return (
            f"The slot '{slot}' doesn't exist for {doctor['name']}. "
            f"Available slots are: {', '.join(available)}."
        )

    if not target_slot["available"]:
        open_slots = [s["slot"] for s in doctor["availability"] if s["available"]]
        if open_slots:
            return (
                f"Sorry, {slot} is no longer available with {doctor['name']}. "
                f"Open slots: {', '.join(open_slots)}."
            )
        return f"Sorry, {doctor['name']} has no available slots right now."

    # Book it in mock data
    target_slot["available"] = False
    confirmation = f"CLR-{random.randint(100000, 999999)}"

    appointment = {
        "confirmation": confirmation,
        "member_id": member_id.upper(),
        "member_name": member["name"],
        "doctor_id": doctor["id"],
        "doctor_name": doctor["name"],
        "specialty": doctor["specialty"],
        "location": doctor["location"],
        "slot": slot,
    }
    PLAN_CONFIG["booked_appointments"].append(appointment)

    # Log to Google Sheets
    sheets_ok = append_appointment(
        confirmation_number=confirmation,
        member_id=member_id.upper(),
        member_name=member["name"],
        doctor_name=doctor["name"],
        slot=slot,
    )

    # Send SMS confirmation
    patient_phone = os.environ.get("PATIENT_PHONE_NUMBER", "")
    sms_ok = False
    if patient_phone:
        sms_ok = send_booking_confirmation(
            to_number=patient_phone,
            member_name=member["name"],
            doctor_name=doctor["name"],
            slot=slot,
            confirmation_number=confirmation,
        )
        if sms_ok and sheets_ok:
            update_sms_status(confirmation)

    # Build response with all three status indicators
    lines = [
        f"Appointment confirmed!",
        f"Confirmation Number: {confirmation}",
        f"Patient: {member['name']}",
        f"Doctor: {doctor['name']} ({doctor['specialty']})",
        f"Time: {slot}",
        f"Location: {doctor['location']}",
        "Please arrive 15 minutes early for check-in.",
    ]

    if sheets_ok:
        lines.append("Records: Successfully logged to our records system.")
    else:
        lines.append(
            "Records: There was an issue logging to our records system — "
            "our team will follow up."
        )

    if sms_ok:
        lines.append("SMS: A text confirmation has been sent to your phone.")
    elif patient_phone:
        lines.append("SMS: We were unable to send a text confirmation, but your booking is secure.")
    else:
        lines.append("SMS: No phone number on file — text confirmation skipped.")

    return "\n".join(lines)


@function_tool()
async def escalate_to_human(context: RunContext, reason: str) -> str:
    """Transfer the call to a human agent at ClearPath Health.

    Args:
        reason: The reason for the escalation.
    """
    logger.info(f"Escalation requested — Reason: {reason}")
    return (
        "I'm transferring you to a human agent now. "
        f"I've noted the reason: {reason}. "
        "Please stay on the line — a representative will be with you shortly. "
        "Your estimated wait time is under 2 minutes."
    )


# In production, this would be an Epic FHIR API call or
# Availity integration - both are notoriously slow and
# return inconsistent schemas across health systems.

MOCK_EHR_DATA = {
    "MBR001": {
        "last_visit": "2024-11-15",
        "last_provider": "Dr. Priya Patel",
        "visit_count_ytd": 3,
        "active_conditions": ["Hypertension", "Type 2 Diabetes"],
        "current_medications": ["Metformin 500mg", "Lisinopril 10mg"],
        "allergies": ["Penicillin"],
    },
}


@function_tool()
async def lookup_ehr_history(context: RunContext, member_id: str) -> str:
    """Look up a patient's visit history from the MediTrack EHR system.

    This queries the legacy EHR for past visits, active conditions,
    medications, and allergies. The system can be slow or unreliable.

    Args:
        member_id: The member's ID (e.g. MBR001).
    """
    roll = random.random()

    # 25% chance: simulate a timeout
    if roll < 0.25:
        time.sleep(3)
        logger.warning(f"MediTrack EHR timeout for member {member_id}")
        return (
            "ERROR: MediTrack EHR v2.3 connection timed out after 3 seconds. "
            "Unable to retrieve patient history at this time. "
            "The agent should let the patient know their medical records are "
            "temporarily unavailable and offer to help with what is available."
        )

    # 15% chance: return malformed/empty data
    if roll < 0.40:
        logger.warning(f"MediTrack EHR returned malformed data for member {member_id}")
        return (
            "ERROR: MediTrack EHR v2.3 returned an unexpected response format. "
            "Payload was empty or contained invalid schema. "
            "The agent should let the patient know their medical records are "
            "temporarily unavailable and offer to help with what is available."
        )

    # 60% chance: success
    record = MOCK_EHR_DATA.get(member_id.upper())
    if not record:
        return (
            f"No EHR records found for member {member_id} in MediTrack. "
            "This member may be new or records may not have been migrated."
        )

    conditions = ", ".join(record["active_conditions"])
    medications = ", ".join(record["current_medications"])
    allergies = ", ".join(record["allergies"])

    return (
        f"MediTrack EHR v2.3 — Patient Record for {member_id}:\n"
        f"Last Visit: {record['last_visit']} with {record['last_provider']}\n"
        f"Visits This Year: {record['visit_count_ytd']}\n"
        f"Active Conditions: {conditions}\n"
        f"Current Medications: {medications}\n"
        f"Allergies: {allergies}\n"
        "Note: Summarize relevant info naturally. Do not read raw data verbatim."
    )
