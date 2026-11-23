import logging
import os
import re
from base64 import urlsafe_b64encode
from contextlib import contextmanager
from hashlib import sha256
from pathlib import Path
from secrets import token_urlsafe
from threading import BoundedSemaphore
from typing import Literal
from urllib.parse import urlsplit
from uuid import uuid4

import psycopg
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from psycopg import errors
from psycopg.rows import dict_row
from pydantic import BaseModel, Field, field_validator

router = APIRouter(prefix="/account")
logger = logging.getLogger(__name__)
hasher = PasswordHasher()
dummy_hash = hasher.hash(token_urlsafe())
password_workers = BoundedSemaphore(2)
session_seconds = 8 * 60 * 60
portal_migration = Path(__file__).resolve().parents[1] / "supabase_identity_portal.sql"
breastcare_app = "breastcare"
local_hosts = {"localhost", "127.0.0.1", "::1"}
web_origin = "https://breast-cancer-da2.onrender.com"
identity_origin = "https://identity-center.onrender.com"
token_pattern = r"^[A-Za-z0-9_-]{43}$"


class Credentials(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(min_length=1, max_length=128, repr=False)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value):
        value = value.strip().lower()
        if not re.fullmatch(r"[^\s@\x00]+@[^\s@\x00]+\.[^\s@\x00]+", value):
            raise ValueError("Email không hợp lệ.")
        return value


class Registration(Credentials):
    full_name: str = Field(max_length=120)
    password: str = Field(min_length=8, max_length=128, repr=False)

    @field_validator("full_name")
    @classmethod
    def normalize_name(cls, value):
        value = value.strip()
        if not value or "\x00" in value:
            raise ValueError("Vui lòng nhập họ tên hợp lệ.")
        return value


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=128, repr=False)
    password: str = Field(min_length=8, max_length=128, repr=False)


class SignInCode(BaseModel):
    code: str = Field(pattern=token_pattern, repr=False)
    verifier: str = Field(pattern=token_pattern, repr=False)


class PortalLaunch(BaseModel):
    app: Literal["breastcare"]
    code_challenge: str = Field(pattern=token_pattern)
    decision: Literal["allow", "deny"] | None = None


@contextmanager
def database():
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        raise HTTPException(503, "Backend chưa cấu hình DATABASE_URL.")
    try:
        with psycopg.connect(
            url, connect_timeout=5, prepare_threshold=None, row_factory=dict_row
        ) as connection:
            yield connection
    except (
        psycopg.OperationalError,
        errors.UndefinedTable,
        errors.UndefinedColumn,
        errors.InsufficientPrivilege,
    ) as exc:
        logger.warning("BreastCare database unavailable (%s)", type(exc).__name__)
        raise HTTPException(503, "Cơ sở dữ liệu tạm thời không khả dụng.") from exc


def require_browser_origin(request: Request):
    origin = request.headers.get("origin")
    if origin == web_origin:
        return
    if origin == identity_origin or request.headers.get("sec-fetch-site") in {
        "cross-site",
        "same-site",
    }:
        raise HTTPException(403, "Trang gửi yêu cầu không hợp lệ.")
    if origin:
        scheme = (
            "http"
            if request.url.hostname in local_hosts and request.url.scheme == "http"
            else "https"
        )
        expected = urlsplit(f"{scheme}://{request.url.netloc}")
        actual = urlsplit(origin)
        if actual != expected:
            raise HTTPException(403, "Trang gửi yêu cầu không hợp lệ.")


def require_json(request: Request):
    require_browser_origin(request)
    validate_json(request)


def validate_json(request):
    if request.headers.get("content-type", "").split(";", 1)[0].lower() != "application/json":
        raise HTTPException(415, "Yêu cầu phải dùng JSON.")


def require_identity_origin(request: Request):
    if request.headers.get("origin") != identity_origin:
        raise HTTPException(403, "Yêu cầu phải đến từ Identity Center.")


def require_identity_json(request: Request):
    require_identity_origin(request)
    validate_json(request)


def no_store(response):
    response.headers["Cache-Control"] = "no-store"


def digest(value):
    return sha256(value.encode()).digest()


def is_admin(user):
    return user["sub"] == os.environ.get("DA2_ADMIN_USER_ID", "").strip().lower()


def require_admin(user):
    if not is_admin(user):
        raise HTTPException(403, "Tài khoản không có quyền quản trị.")


def session_token(request):
    scheme, _, token = request.headers.get("authorization", "").partition(" ")
    if scheme.lower() != "bearer" or not re.fullmatch(token_pattern, token):
        raise HTTPException(401, "Vui lòng đăng nhập lại.")
    return digest(token)


def identity(request: Request):
    require_browser_origin(request)
    token_hash = session_token(request)
    with database() as db:
        ensure_portal_schema(db)
        user = db.execute(
            """
            select a.id::text as sub, a.email, a.full_name
            from breastcare_private.sessions s
            join breastcare_private.accounts a on a.id = s.account_id
            join breastcare_private.portal_sessions p on p.token_hash = s.portal_token_hash
            join breastcare_private.app_permissions g on g.account_id = a.id and g.app = %s
            where s.token_hash = %s and s.expires_at > now() and p.expires_at > now() and g.allowed
        """,
            (breastcare_app, token_hash),
        ).fetchone()
    if not user:
        raise HTTPException(401, "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.")
    return user


def count_attempt(scope, value, limit):
    with database() as db:
        db.execute("delete from breastcare_private.auth_limits where expires_at <= now()")
        result = db.execute(
            """
            insert into breastcare_private.auth_limits (scope, bucket, attempts, expires_at)
            values (%s, %s, 1, now() + interval '10 minutes')
            on conflict (scope, bucket) do update
            set attempts = least(breastcare_private.auth_limits.attempts + 1, %s)
            returning attempts
        """,
            (scope, digest(value), limit + 1),
        ).fetchone()
    if result["attempts"] > limit:
        raise HTTPException(
            429, "Quá nhiều lần thử. Vui lòng thử lại sau vài phút.", headers={"Retry-After": "600"}
        )


def ensure_portal_schema(db):
    check_sql = "select to_regclass('breastcare_private.app_permissions') is not null as ready"
    if db.execute(check_sql).fetchone()["ready"]:
        return
    db.execute("select pg_advisory_xact_lock(204921607)")
    if not db.execute(check_sql).fetchone()["ready"]:
        db.execute(portal_migration.read_text(encoding="utf-8"))


def open_portal(db, account_id):
    ensure_portal_schema(db)
    token = token_urlsafe(32)
    db.execute(
        "delete from breastcare_private.portal_sessions where account_id = %s and expires_at <= now()",
        (account_id,),
    )
    db.execute(
        """
        insert into breastcare_private.portal_sessions (token_hash, account_id, expires_at)
        values (%s, %s, now() + %s * interval '1 second')
    """,
        (digest(token), account_id, session_seconds),
    )
    return token


def open_app_session(db, portal):
    token = token_urlsafe(32)
    db.execute(
        """
        insert into breastcare_private.sessions (token_hash, account_id, expires_at, portal_token_hash)
        values (%s, %s, %s, %s)
    """,
        (digest(token), portal["account_id"], portal["expires_at"], portal["token_hash"]),
    )
    return token


def active_portal(db, token_hash, *, lock=False):
    query = """
        select p.token_hash, p.account_id, p.expires_at, a.email, a.full_name
        from breastcare_private.portal_sessions p
        join breastcare_private.accounts a on a.id = p.account_id
        where p.token_hash = %s and p.expires_at > now()
    """
    if lock:
        query += " for update of p"
    portal = db.execute(query, (token_hash,)).fetchone()
    if not portal:
        raise HTTPException(401, "Phiên Identity Center đã hết hạn. Vui lòng đăng nhập lại.")
    return portal


def verify_password(password_hash, password):
    try:
        with password_workers:
            return hasher.verify(password_hash, password)
    except VerifyMismatchError:
        return False


def hash_password(password):
    with password_workers:
        return hasher.hash(password)


@router.post("/register", status_code=201, dependencies=[Depends(require_identity_json)])
def register(body: Registration, request: Request, response: Response):
    count_attempt("register_ip", request.client.host if request.client else "unknown", 20)
    password_hash = hash_password(body.password)
    try:
        with database() as db:
            db.execute(
                """
                insert into breastcare_private.accounts (id, email, full_name, password_hash)
                values (%s, %s, %s, %s)
            """,
                (uuid4(), body.email, body.full_name, password_hash),
            )
    except errors.UniqueViolation as exc:
        raise HTTPException(409, "Email này đã được đăng ký. Vui lòng đăng nhập.") from exc
    no_store(response)
    return {"registered": True}


@router.post("/login", dependencies=[Depends(require_identity_json)])
def login(body: Credentials, request: Request, response: Response):
    ip = request.client.host if request.client else "unknown"
    count_attempt("login_ip", ip, 100)
    count_attempt("login_account_ip", f"{ip}|{body.email}", 10)
    with database() as db:
        account = db.execute(
            """
            select id, password_hash from breastcare_private.accounts where email = %s for no key update
        """,
            (body.email,),
        ).fetchone()
        valid = verify_password(account["password_hash"] if account else dummy_hash, body.password)
        if not account or not valid:
            raise HTTPException(401, "Email hoặc mật khẩu không đúng.")
        db.execute(
            "delete from breastcare_private.auth_limits where scope = 'login_account_ip' and bucket = %s",
            (digest(f"{ip}|{body.email}"),),
        )
        token = open_portal(db, account["id"])
    no_store(response)
    return {"portal_token": token}


@router.get("/portal/profile", dependencies=[Depends(require_identity_origin)])
def portal_profile(request: Request, response: Response):
    token_hash = session_token(request)
    with database() as db:
        portal = active_portal(db, token_hash)
        permission = db.execute(
            """
            select allowed from breastcare_private.app_permissions
            where account_id = %s and app = %s
        """,
            (portal["account_id"], breastcare_app),
        ).fetchone()
    no_store(response)
    return {
        "email": portal["email"],
        "full_name": portal["full_name"],
        "permissions": {breastcare_app: permission["allowed"] if permission else None},
    }


@router.post("/portal/launch", dependencies=[Depends(require_identity_json)])
def portal_launch(body: PortalLaunch, request: Request, response: Response):
    token_hash = session_token(request)
    with database() as db:
        portal = active_portal(db, token_hash, lock=True)
        account_id = portal["account_id"]
        if body.decision is not None:
            db.execute(
                """
                insert into breastcare_private.app_permissions (account_id, app, allowed)
                values (%s, %s, %s)
                on conflict (account_id, app) do update
                set allowed = excluded.allowed, updated_at = now()
            """,
                (account_id, body.app, body.decision == "allow"),
            )
        permission = db.execute(
            """
            select allowed from breastcare_private.app_permissions
            where account_id = %s and app = %s
        """,
            (account_id, body.app),
        ).fetchone()
        no_store(response)
        if not permission or not permission["allowed"]:
            # Invalidate outstanding handoffs from this portal when the user denies access.
            if body.decision == "deny":
                db.execute(
                    """
                    delete from breastcare_private.sign_in_codes where portal_token_hash = %s
                """,
                    (token_hash,),
                )
            return {"allowed": False}

        code = token_urlsafe(32)
        db.execute("delete from breastcare_private.sign_in_codes where expires_at <= now()")
        db.execute(
            """
            insert into breastcare_private.sign_in_codes
                (token_hash, account_id, code_challenge, expires_at, portal_token_hash)
            values (%s, %s, %s, now() + interval '90 seconds', %s)
        """,
            (digest(code), account_id, body.code_challenge.encode("ascii"), token_hash),
        )
    return {"allowed": True, "authorization_code": code}


@router.post("/portal/logout", status_code=204, dependencies=[Depends(require_identity_origin)])
def portal_logout(request: Request, response: Response):
    token_hash = session_token(request)
    with database() as db:
        db.execute(
            "delete from breastcare_private.portal_sessions where token_hash = %s", (token_hash,)
        )
    no_store(response)


@router.post("/exchange", dependencies=[Depends(require_json)])
def exchange_sign_in_code(body: SignInCode, request: Request, response: Response):
    if request.headers.get("origin") != web_origin:
        raise HTTPException(403, "Chỉ BreastCare có thể nhận phiên đăng nhập.")
    code_hash = digest(body.code)
    challenge = urlsafe_b64encode(digest(body.verifier)).rstrip(b"=")
    with database() as db:
        portal = db.execute(
            """
            select p.token_hash, p.account_id, p.expires_at
            from breastcare_private.sign_in_codes c
            join breastcare_private.portal_sessions p on p.token_hash = c.portal_token_hash
            where c.token_hash = %s and c.code_challenge = %s
              and c.expires_at > now() and p.expires_at > now()
            for update of p
        """,
            (code_hash, challenge),
        ).fetchone()
        consumed = (
            portal
            and db.execute(
                """
            delete from breastcare_private.sign_in_codes
            where token_hash = %s and expires_at > clock_timestamp()
              and exists (
                  select 1 from breastcare_private.app_permissions a
                  where a.account_id = sign_in_codes.account_id and a.app = %s and a.allowed
              )
            returning account_id
        """,
                (code_hash, breastcare_app),
            ).fetchone()
        )
        if not consumed:
            raise HTTPException(
                401, "Mã truy cập không hợp lệ hoặc đã hết hạn. Vui lòng mở lại ứng dụng."
            )
        token = open_app_session(db, portal)
    no_store(response)
    return {"session_token": token}


@router.get("/profile")
def profile(response: Response, user=Depends(identity)):
    no_store(response)
    return {**user, "is_admin": is_admin(user)}


@router.post("/logout", status_code=204, dependencies=[Depends(require_browser_origin)])
def logout(request: Request, response: Response):
    token_hash = session_token(request)
    with database() as db:
        ensure_portal_schema(db)
        db.execute(
            """
            delete from breastcare_private.portal_sessions
            where token_hash = (
                select portal_token_hash from breastcare_private.sessions where token_hash = %s
            )
        """,
            (token_hash,),
        )
        db.execute("delete from breastcare_private.sessions where token_hash = %s", (token_hash,))
    no_store(response)


@router.post("/password", dependencies=[Depends(require_json)])
def change_password(
    body: PasswordChange, request: Request, response: Response, user=Depends(identity)
):
    count_attempt("password_change", user["sub"], 10)
    token_hash = session_token(request)
    with database() as db:
        ensure_portal_schema(db)
        account = db.execute(
            """
            select password_hash from breastcare_private.accounts where id = %s for no key update
        """,
            (user["sub"],),
        ).fetchone()
        if not account or not verify_password(account["password_hash"], body.current_password):
            raise HTTPException(401, "Mật khẩu hiện tại không đúng.")
        portal = db.execute(
            """
            select p.token_hash, p.account_id, p.expires_at
            from breastcare_private.sessions s
            join breastcare_private.portal_sessions p on p.token_hash = s.portal_token_hash
            where s.token_hash = %s and p.expires_at > now()
            for update of p
        """,
            (token_hash,),
        ).fetchone()
        if not portal:
            raise HTTPException(401, "Vui lòng đăng nhập lại trước khi đổi mật khẩu.")
        db.execute(
            "update breastcare_private.accounts set password_hash = %s where id = %s",
            (hash_password(body.password), user["sub"]),
        )
        db.execute(
            """
            delete from breastcare_private.portal_sessions where account_id = %s and token_hash <> %s
        """,
            (user["sub"], portal["token_hash"]),
        )
        db.execute("delete from breastcare_private.sessions where account_id = %s", (user["sub"],))
        db.execute(
            "delete from breastcare_private.sign_in_codes where account_id = %s", (user["sub"],)
        )
        token = open_app_session(db, portal)
    no_store(response)
    return {"changed": True, "session_token": token}
