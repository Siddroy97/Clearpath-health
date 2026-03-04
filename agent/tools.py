import logging
import random
from difflib import SequenceMatcher

from livekit.agents import Agent, RunContext, function_tool

from agent.mock_data import PLAN_CONFIG

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

    # Book it
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

    return (
        f"Appointment confirmed!\n"
        f"Confirmation Number: {confirmation}\n"
        f"Patient: {member['name']}\n"
        f"Doctor: {doctor['name']} ({doctor['specialty']})\n"
        f"Time: {slot}\n"
        f"Location: {doctor['location']}\n"
        "Please arrive 15 minutes early for check-in."
    )


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
