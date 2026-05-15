"""Squad API integration for GhostBuster.

Wraps Squad's payout sandbox (account lookup + fund transfer). Supports a mock
mode (MOCK_SQUAD=true) that skips all HTTP and returns deterministic fake data
for local development and demos.
"""

import asyncio
import logging
from typing import Any, Dict, Optional

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

HTTP_TIMEOUT_SECONDS = 10.0
SQUAD_TIMEOUT_RETRY_DELAY = 2.0  # spec: wait 2s before re-querying on 424

# 20 realistic Nigerian full names — used by mock mode keyed by hash(account_number).
MOCK_NIGERIAN_NAMES = [
    "Adebayo Okonkwo",
    "Chioma Adeleke",
    "Emeka Nwosu",
    "Funke Ogundimu",
    "Ibrahim Suleiman",
    "Ngozi Eze",
    "Olamide Bakare",
    "Tunde Afolabi",
    "Yetunde Oluwaseun",
    "Chinedu Obi",
    "Aisha Mohammed",
    "Babatunde Akinola",
    "Folake Adesanya",
    "Hassan Bello",
    "Ifeoma Okafor",
    "Kemi Adebisi",
    "Musa Garba",
    "Nneka Uchechukwu",
    "Segun Oyelaran",
    "Zainab Abubakar",
]


def _mock_name_for(account_number: str) -> str:
    """Deterministically pick a mock account name from the account number."""
    # Strip whitespace so trailing spaces don't change the hash bucket.
    key = (account_number or "").strip()
    return MOCK_NIGERIAN_NAMES[hash(key) % len(MOCK_NIGERIAN_NAMES)]


def _auth_headers() -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.squad_api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


async def verify_account(account_number: str, bank_code: str) -> Dict[str, Any]:
    """Verify a bank account via Squad's account lookup endpoint.

    Returns:
        {verified: bool, account_name: str, account_number: str, bank_code: str}

    Never raises — failures are reported as verified=False with an empty name so
    callers can degrade gracefully (e.g. dashboard shows "unverified").
    """
    account_number = (account_number or "").strip()
    bank_code = (bank_code or "").strip()

    if settings.mock_squad:
        return {
            "verified": True,
            "account_name": _mock_name_for(account_number),
            "account_number": account_number,
            "bank_code": bank_code,
        }

    url = f"{settings.squad_base_url}/payout/account/lookup"
    payload = {"bank_code": bank_code, "account_number": account_number}

    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS) as client:
            response = await client.post(url, json=payload, headers=_auth_headers())

        if response.status_code != 200:
            logger.warning(
                "Squad account lookup non-200: status=%s body=%s",
                response.status_code,
                response.text[:500],
            )
            return {
                "verified": False,
                "account_name": "",
                "account_number": account_number,
                "bank_code": bank_code,
            }

        body = response.json()
        # Squad wraps payloads as {status: 200, data: {...}}.
        data = body.get("data") or {}
        account_name = data.get("account_name") or ""
        verified = bool(account_name) and int(body.get("status", 0)) == 200

        return {
            "verified": verified,
            "account_name": account_name,
            "account_number": data.get("account_number") or account_number,
            "bank_code": bank_code,
        }

    except httpx.TimeoutException:
        logger.exception(
            "Squad account lookup timed out for account=%s bank=%s",
            account_number,
            bank_code,
        )
    except httpx.HTTPError:
        logger.exception(
            "Squad account lookup HTTP error for account=%s bank=%s",
            account_number,
            bank_code,
        )
    except (ValueError, KeyError):
        logger.exception(
            "Squad account lookup returned malformed JSON for account=%s",
            account_number,
        )

    return {
        "verified": False,
        "account_name": "",
        "account_number": account_number,
        "bank_code": bank_code,
    }


async def _query_transfer_status(
    client: httpx.AsyncClient, transaction_reference: str
) -> Optional[str]:
    """GET /payout/transfer/{ref} once and return the transaction_status string."""
    url = f"{settings.squad_base_url}/payout/transfer/{transaction_reference}"
    try:
        response = await client.get(url, headers=_auth_headers())
        if response.status_code != 200:
            logger.warning(
                "Squad transfer status non-200: ref=%s status=%s body=%s",
                transaction_reference,
                response.status_code,
                response.text[:500],
            )
            return None
        body = response.json()
        data = body.get("data") or {}
        return data.get("transaction_status")
    except (httpx.HTTPError, ValueError, KeyError):
        logger.exception(
            "Squad transfer status query failed for ref=%s", transaction_reference
        )
        return None


async def transfer_funds(
    transaction_reference: str,
    amount_kobo: int,
    bank_code: str,
    account_number: str,
    account_name: str,
    remark: str,
) -> Dict[str, Any]:
    """Initiate a fund transfer via Squad's payout endpoint.

    Squad's API expects `amount` as a string in kobo. On HTTP 424 (timeout from
    Squad's side) we wait 2 seconds and re-query the transfer once to learn the
    final status, per their documented retry pattern.

    Returns:
        {success: bool, transaction_reference: str, status: str}
    """
    if settings.mock_squad:
        return {
            "success": True,
            "transaction_reference": transaction_reference,
            "status": "success",
        }

    url = f"{settings.squad_base_url}/payout/transfer"
    payload = {
        "transaction_reference": transaction_reference,
        "amount": str(amount_kobo),
        "bank_code": bank_code,
        "account_number": account_number,
        "account_name": account_name,
        "currency_id": "NGN",
        "remark": remark,
    }

    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS) as client:
            response = await client.post(url, json=payload, headers=_auth_headers())

            # 424 Failed Dependency — Squad's timeout. Wait then re-query once.
            if response.status_code == 424:
                logger.info(
                    "Squad transfer returned 424 for ref=%s — retrying status query in %ss",
                    transaction_reference,
                    SQUAD_TIMEOUT_RETRY_DELAY,
                )
                await asyncio.sleep(SQUAD_TIMEOUT_RETRY_DELAY)
                final_status = await _query_transfer_status(client, transaction_reference)
                return {
                    "success": final_status == "success",
                    "transaction_reference": transaction_reference,
                    "status": final_status or "unknown",
                }

            if response.status_code != 200:
                logger.warning(
                    "Squad transfer non-200: ref=%s status=%s body=%s",
                    transaction_reference,
                    response.status_code,
                    response.text[:500],
                )
                return {
                    "success": False,
                    "transaction_reference": transaction_reference,
                    "status": "failed",
                }

            body = response.json()
            data = body.get("data") or {}
            status = data.get("transaction_status") or "unknown"
            return {
                "success": status == "success",
                "transaction_reference": data.get("transaction_reference")
                or transaction_reference,
                "status": status,
            }

    except httpx.TimeoutException:
        logger.exception("Squad transfer timed out for ref=%s", transaction_reference)
        return {
            "success": False,
            "transaction_reference": transaction_reference,
            "status": "timeout",
        }
    except httpx.HTTPError:
        logger.exception("Squad transfer HTTP error for ref=%s", transaction_reference)
        return {
            "success": False,
            "transaction_reference": transaction_reference,
            "status": "error",
        }
    except (ValueError, KeyError):
        logger.exception(
            "Squad transfer returned malformed JSON for ref=%s", transaction_reference
        )
        return {
            "success": False,
            "transaction_reference": transaction_reference,
            "status": "error",
        }