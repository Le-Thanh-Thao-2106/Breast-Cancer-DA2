import logging
import os
import re
from contextlib import contextmanager
from hashlib import sha256
from secrets import token_urlsafe
from threading import BoundedSemaphore
from urllib.parse import urlsplit
from uuid import uuid4

import psycopg
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from psycopg import errors
from psycopg.rows import dict_row
from pydantic import BaseModel, Field, field_validator


router = APIRouter(prefix='/account')
logger = logging.getLogger(__name__)
hasher = PasswordHasher()
dummy_hash = hasher.hash(token_urlsafe())
password_workers = BoundedSemaphore(2)
cookie_name = 'bc_session'
session_seconds = 7 * 24 * 60 * 60
local_hosts = {'localhost', '127.0.0.1', '::1'}


class Credentials(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(min_length=1, max_length=128, repr=False)

    @field_validator('email')
    @classmethod
    def normalize_email(cls, value):
        value = value.strip().lower()
        if not re.fullmatch(r'[^\s@\x00]+@[^\s@\x00]+\.[^\s@\x00]+', value):
            raise ValueError('Email không hợp lệ.')
        return value


class Registration(Credentials):
    full_name: str = Field(max_length=120)
    password: str = Field(min_length=8, max_length=128, repr=False)

    @field_validator('full_name')
    @classmethod
    def normalize_name(cls, value):
        value = value.strip()
        if not value or '\x00' in value:
            raise ValueError('Vui lòng nhập họ tên hợp lệ.')
        return value


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=128, repr=False)
    password: str = Field(min_length=8, max_length=128, repr=False)


@contextmanager
def database():
    url = os.environ.get('DATABASE_URL', '')
    if not url:
        raise HTTPException(503, 'Backend chưa cấu hình DATABASE_URL.')
    try:
        with psycopg.connect(url, connect_timeout=5, prepare_threshold=None, row_factory=dict_row) as connection:
            yield connection
    except (psycopg.OperationalError, errors.UndefinedTable, errors.InsufficientPrivilege) as exc:
        logger.warning('BreastCare database unavailable (%s)', type(exc).__name__)
        raise HTTPException(503, 'Cơ sở dữ liệu tạm thời không khả dụng.') from exc


def require_same_origin(request: Request):
    if request.headers.get('sec-fetch-site') in {'cross-site', 'same-site'}:
        raise HTTPException(403, 'Trang gửi yêu cầu không hợp lệ.')
    origin = request.headers.get('origin')
    if origin:
        scheme = 'http' if request.url.hostname in local_hosts and request.url.scheme == 'http' else 'https'
        expected = urlsplit(f'{scheme}://{request.url.netloc}')
        actual = urlsplit(origin)
        if actual != expected:
            raise HTTPException(403, 'Trang gửi yêu cầu không hợp lệ.')


def require_json(request: Request):
    require_same_origin(request)
    if request.headers.get('content-type', '').split(';', 1)[0].lower() != 'application/json':
        raise HTTPException(415, 'Yêu cầu phải dùng JSON.')


def digest(value):
    return sha256(value.encode()).digest()


def is_admin(user):
    return user['sub'] == os.environ.get('DA2_ADMIN_USER_ID', '').strip().lower()


def require_admin(user):
    if not is_admin(user):
        raise HTTPException(403, 'Tài khoản không có quyền quản trị.')


def session_token(request):
    token = request.cookies.get(cookie_name, '')
    if not re.fullmatch(r'[A-Za-z0-9_-]{43}', token):
        raise HTTPException(401, 'Vui lòng đăng nhập BreastCare.')
    return digest(token)


def identity(request: Request):
    token_hash = session_token(request)
    with database() as db:
        user = db.execute('''
            select a.id::text as sub, a.email, a.full_name
            from breastcare_private.sessions s
            join breastcare_private.accounts a on a.id = s.account_id
            where s.token_hash = %s and s.expires_at > now()
        ''', (token_hash,)).fetchone()
    if not user:
        raise HTTPException(401, 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
    return user


def count_attempt(scope, value, limit):
    with database() as db:
        db.execute('delete from breastcare_private.auth_limits where expires_at <= now()')
        result = db.execute('''
            insert into breastcare_private.auth_limits (scope, bucket, attempts, expires_at)
            values (%s, %s, 1, now() + interval '10 minutes')
            on conflict (scope, bucket) do update
            set attempts = least(breastcare_private.auth_limits.attempts + 1, %s)
            returning attempts
        ''', (scope, digest(value), limit + 1)).fetchone()
    if result['attempts'] > limit:
        raise HTTPException(429, 'Quá nhiều lần thử. Vui lòng thử lại sau vài phút.',
                            headers={'Retry-After': '600'})


def open_session(db, account_id):
    token = token_urlsafe(32)
    db.execute('delete from breastcare_private.sessions where account_id = %s and expires_at <= now()', (account_id,))
    db.execute('''
        insert into breastcare_private.sessions (token_hash, account_id, expires_at)
        values (%s, %s, now() + %s * interval '1 second')
    ''', (digest(token), account_id, session_seconds))
    return token


def set_cookie(response, request, token):
    response.headers['Cache-Control'] = 'no-store'
    response.set_cookie(cookie_name, token, max_age=session_seconds, httponly=True,
                        secure=request.url.hostname not in local_hosts, samesite='strict')


def verify_password(password_hash, password):
    try:
        with password_workers:
            return hasher.verify(password_hash, password)
    except VerifyMismatchError:
        return False


def hash_password(password):
    with password_workers:
        return hasher.hash(password)


@router.post('/register', status_code=201, dependencies=[Depends(require_json)])
def register(body: Registration, request: Request, response: Response):
    count_attempt('register_ip', request.client.host if request.client else 'unknown', 20)
    account_id = uuid4()
    password_hash = hash_password(body.password)
    try:
        with database() as db:
            db.execute('''
                insert into breastcare_private.accounts (id, email, full_name, password_hash)
                values (%s, %s, %s, %s)
            ''', (account_id, body.email, body.full_name, password_hash))
            token = open_session(db, account_id)
    except errors.UniqueViolation as exc:
        raise HTTPException(409, 'Email này đã được đăng ký. Vui lòng đăng nhập.') from exc
    set_cookie(response, request, token)
    return {'registered': True}


@router.post('/login', dependencies=[Depends(require_json)])
def login(body: Credentials, request: Request, response: Response):
    ip = request.client.host if request.client else 'unknown'
    count_attempt('login_ip', ip, 100)
    count_attempt('login_account_ip', f'{ip}|{body.email}', 10)
    with database() as db:
        account = db.execute('''
            select id, password_hash from breastcare_private.accounts where email = %s for update
        ''', (body.email,)).fetchone()
        valid = verify_password(account['password_hash'] if account else dummy_hash, body.password)
        if not account or not valid:
            raise HTTPException(401, 'Email hoặc mật khẩu không đúng.')
        db.execute("delete from breastcare_private.auth_limits where scope = 'login_account_ip' and bucket = %s",
                   (digest(f'{ip}|{body.email}'),))
        token = open_session(db, account['id'])
    set_cookie(response, request, token)
    return {'signed_in': True}


@router.get('/profile')
def profile(response: Response, user=Depends(identity)):
    response.headers['Cache-Control'] = 'no-store'
    return {**user, 'is_admin': is_admin(user)}


@router.post('/logout', status_code=204, dependencies=[Depends(require_same_origin)])
def logout(request: Request, response: Response):
    if cookie_name in request.cookies:
        try:
            token_hash = session_token(request)
        except HTTPException:
            pass
        else:
            with database() as db:
                db.execute('delete from breastcare_private.sessions where token_hash = %s', (token_hash,))
    response.delete_cookie(cookie_name, httponly=True, secure=request.url.hostname not in local_hosts, samesite='strict')


@router.post('/password', dependencies=[Depends(require_json)])
def change_password(body: PasswordChange, request: Request, response: Response, user=Depends(identity)):
    count_attempt('password_change', user['sub'], 10)
    with database() as db:
        account = db.execute('select password_hash from breastcare_private.accounts where id = %s for update',
                             (user['sub'],)).fetchone()
        if not account or not verify_password(account['password_hash'], body.current_password):
            raise HTTPException(401, 'Mật khẩu hiện tại không đúng.')
        db.execute('update breastcare_private.accounts set password_hash = %s where id = %s',
                   (hash_password(body.password), user['sub']))
        db.execute('delete from breastcare_private.sessions where account_id = %s', (user['sub'],))
        token = open_session(db, user['sub'])
    set_cookie(response, request, token)
    return {'changed': True}
