import os
from getpass import getpass
from uuid import UUID

from psycopg.errors import UniqueViolation
from pydantic import ValidationError

from app.accounts import Registration, database, hash_password


def main():
    try:
        admin_id = UUID(os.environ.get('DA2_ADMIN_USER_ID', '').strip())
    except ValueError:
        raise SystemExit('Hãy đặt DA2_ADMIN_USER_ID bằng UUID Auth cũ của admin.')

    email = input('Email admin: ')
    full_name = input('Họ tên admin: ')
    password = getpass('Mật khẩu mới: ')
    if password != getpass('Nhập lại mật khẩu: '):
        raise SystemExit('Mật khẩu xác nhận không khớp.')
    try:
        account = Registration(email=email, full_name=full_name, password=password)
    except ValidationError:
        raise SystemExit('Kiểm tra lại email, họ tên và mật khẩu từ 8 đến 128 ký tự.')

    password_hash = hash_password(account.password)
    try:
        with database() as db:
            db.execute('''
                insert into breastcare_private.accounts (id, email, full_name, password_hash)
                values (%s, %s, %s, %s)
                on conflict (id) do update
                set email = excluded.email, full_name = excluded.full_name,
                    password_hash = excluded.password_hash
            ''', (admin_id, account.email, account.full_name, password_hash))
            db.execute('delete from breastcare_private.sessions where account_id = %s', (admin_id,))
    except UniqueViolation:
        raise SystemExit('Email admin đã thuộc về một UUID khác trong bảng tài khoản BreastCare.')

    print(f'Admin UUID: {admin_id}')


if __name__ == '__main__':
    main()
