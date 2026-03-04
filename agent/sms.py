import logging
import os
import re

from twilio.rest import Client

logger = logging.getLogger("clearpath-sms")

E164_PATTERN = re.compile(r"^\+[1-9]\d{1,14}$")


def send_booking_confirmation(
    to_number: str,
    member_name: str,
    doctor_name: str,
    slot: str,
    confirmation_number: str,
) -> bool:
    """Send an SMS booking confirmation via Twilio.

    Returns True on success, False on failure. Never throws.
    """
    try:
        if not E164_PATTERN.match(to_number):
            logger.error(f"Invalid E.164 phone number: {to_number}")
            return False

        message_body = (
            f"Hi {member_name}, your appointment with {doctor_name} on {slot} "
            f"is confirmed. Confirmation #: {confirmation_number}. "
            f"Reply CANCEL to cancel. - ClearPath Health"
        )

        twilio_enabled = os.environ.get("TWILIO_ENABLED", "true").lower()
        if twilio_enabled == "false":
            logger.info(f"[TWILIO DISABLED] Would send to {to_number}: {message_body}")
            return True

        account_sid = os.environ["TWILIO_ACCOUNT_SID"]
        auth_token = os.environ["TWILIO_AUTH_TOKEN"]
        from_number = os.environ["TWILIO_FROM_NUMBER"]

        client = Client(account_sid, auth_token)
        msg = client.messages.create(
            body=message_body,
            from_=from_number,
            to=to_number,
        )
        logger.info(f"SMS sent to {to_number} — SID: {msg.sid}")
        return True
    except Exception:
        logger.exception(f"Failed to send SMS to {to_number}")
        return False
