
import json
import os
from functools import lru_cache

import firebase_admin
from firebase_admin import auth, credentials, firestore

from app.config import get_settings


def get_firebase_app():
    # Reuse the existing Firebase app if already initialized.
    try:
        return firebase_admin.get_app()
    except ValueError:
        pass

    settings = get_settings()

    if settings.service_account_json:
        try:
            service_account = json.loads(settings.service_account_json)
            cred = credentials.Certificate(service_account)
        except json.JSONDecodeError as exc:
            raise RuntimeError(
                "FIREBASE_SERVICE_ACCOUNT_JSON contains invalid JSON."
            ) from exc

    elif settings.credentials_path:
        if not os.path.isfile(settings.credentials_path):
            raise RuntimeError(
                f"Firebase credentials file not found: "
                f"{settings.credentials_path}"
            )

        cred = credentials.Certificate(settings.credentials_path)

    else:
        cred = credentials.ApplicationDefault()

    return firebase_admin.initialize_app(cred)


@lru_cache
def get_db():
    app = get_firebase_app()
    return firestore.client(app=app)


def verify_token(token: str):
    try:
        app = get_firebase_app()

        return auth.verify_id_token(
            token,
            app=app,
            check_revoked=True
        )

    except Exception as exc:
        print(
            f"Firebase token verification failed: "
            f"{type(exc).__name__}: {exc}"
        )
        raise ValueError(
            "Invalid or expired Firebase ID token."
        ) from exc
