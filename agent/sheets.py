import logging
import os
from datetime import datetime

import gspread
from google.oauth2.service_account import Credentials

logger = logging.getLogger("clearpath-sheets")

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

SHEET_NAME = "ClearPath Appointments"

# Column indices (1-based for gspread)
COL_CONFIRMATION = 1
COL_MEMBER_ID = 2
COL_MEMBER_NAME = 3
COL_DOCTOR_NAME = 4
COL_SLOT = 5
COL_TIMESTAMP = 6
COL_STATUS = 7
COL_SMS_SENT = 8


def _get_sheet():
    """Authenticate and return the worksheet handle."""
    creds_path = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "")
    sheet_id = os.environ.get("GOOGLE_SHEET_ID", "")

    if not creds_path or not sheet_id:
        raise RuntimeError("GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SHEET_ID not set")

    credentials = Credentials.from_service_account_file(creds_path, scopes=SCOPES)
    gc = gspread.authorize(credentials)
    spreadsheet = gc.open_by_key(sheet_id)

    try:
        worksheet = spreadsheet.worksheet(SHEET_NAME)
    except gspread.exceptions.WorksheetNotFound:
        worksheet = spreadsheet.add_worksheet(title=SHEET_NAME, rows=1000, cols=8)
        worksheet.append_row([
            "Confirmation Number",
            "Member ID",
            "Member Name",
            "Doctor Name",
            "Appointment Slot",
            "Booking Timestamp",
            "Status",
            "SMS Sent",
        ])

    return worksheet


def append_appointment(
    confirmation_number: str,
    member_id: str,
    member_name: str,
    doctor_name: str,
    slot: str,
) -> bool:
    """Append a new appointment row to the Google Sheet.

    Returns True on success, False on failure. Never throws.
    """
    try:
        ws = _get_sheet()
        ws.append_row([
            confirmation_number,
            member_id,
            member_name,
            doctor_name,
            slot,
            datetime.now().isoformat(),
            "Confirmed",
            "No",
        ])
        logger.info(f"Logged appointment {confirmation_number} to Google Sheets")
        return True
    except Exception:
        logger.exception(f"Failed to log appointment {confirmation_number} to Google Sheets")
        return False


def get_appointments_for_member(member_id: str) -> list:
    """Return all appointment rows for the given member ID.

    Returns an empty list on any error.
    """
    try:
        ws = _get_sheet()
        all_rows = ws.get_all_records()
        return [row for row in all_rows if row.get("Member ID") == member_id]
    except Exception:
        logger.exception(f"Failed to fetch appointments for member {member_id}")
        return []


def update_sms_status(confirmation_number: str) -> bool:
    """Mark SMS Sent as 'Yes' for the given confirmation number.

    Returns True on success, False on failure. Never throws.
    """
    try:
        ws = _get_sheet()
        cell = ws.find(confirmation_number, in_column=COL_CONFIRMATION)
        if cell is None:
            logger.warning(f"Confirmation {confirmation_number} not found in sheet")
            return False
        ws.update_cell(cell.row, COL_SMS_SENT, "Yes")
        logger.info(f"Updated SMS status for {confirmation_number}")
        return True
    except Exception:
        logger.exception(f"Failed to update SMS status for {confirmation_number}")
        return False
