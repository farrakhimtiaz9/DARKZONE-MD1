import os
from functools import lru_cache

from dotenv import load_dotenv
from typesafe_sdk import AsyncTypeSafeClient, RetryPolicy, TypeSafeAPIError

load_dotenv()


@lru_cache(maxsize=1)
def get_jev_client() -> AsyncTypeSafeClient:
    proxy = (
        os.getenv("INTEGRATION_PROXY_URL")
        or os.getenv("integration_proxy_url")
        or "https://integrations.emergentagent.com"
    ).rstrip("/")
    return AsyncTypeSafeClient(
        api_key=os.environ["EMERGENT_LLM_KEY"],
        base_url=f"{proxy}/llm/typesafe",
        retry=RetryPolicy(max_retries=2, respect_retry_after=False),
    )


def jev_error_code(exc: TypeSafeAPIError) -> str:
    body = getattr(exc, "body", None)
    if isinstance(body, dict):
        err = body.get("error")
        code = (err.get("type") if isinstance(err, dict) else None) or body.get("code") or body.get("error_type") or str(err or "")
    else:
        code = str(body or exc).strip()
    known = {"CAPACITY_LIMIT", "USER_CONCURRENCY_LIMIT", "CONCURRENCY_REQUEST_LIMIT", "budget_exceeded"}
    return "RATE_LIMITED" if exc.status == 429 and code not in known else code
