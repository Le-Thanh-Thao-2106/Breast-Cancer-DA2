import os
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from .accounts import database, identity, require_admin

router = APIRouter(prefix="/admin", tags=["admin"])
PageSize = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]


def verify_admin(user=Depends(identity)):
    require_admin(user)
    return user


Admin = Annotated[dict, Depends(verify_admin)]


@router.get("/activity/overview")
def activity_overview(user: Admin):
    with database() as db:
        return db.execute("""
            select
                (select count(*) from breastcare_private.accounts) as total_users,
                count(*) as total_sessions,
                coalesce(sum(sample_count), 0) as total_samples
            from public.bc_analysis_sessions
        """).fetchone()


@router.get("/users")
def list_users(
    user: Admin,
    q: Annotated[str, Query(max_length=255)] = "",
    limit: PageSize = 15,
    offset: Offset = 0,
):
    search = q.strip()
    admin_id = os.environ.get("DA2_ADMIN_USER_ID", "").strip().lower()
    with database() as db:
        totals = db.execute(
            """
            select count(*) as total
            from breastcare_private.accounts
            where strpos(lower(full_name), lower(%s)) > 0
               or strpos(lower(email), lower(%s)) > 0
        """,
            (search, search),
        ).fetchone()
        users = db.execute(
            """
            with page as (
                select id, full_name, email, created_at
                from breastcare_private.accounts
                where strpos(lower(full_name), lower(%s)) > 0
                   or strpos(lower(email), lower(%s)) > 0
                order by created_at desc, id
                limit %s offset %s
            )
            select id, full_name, email, created_at, id::text = %s as is_admin,
                   (
                       select count(*) from public.bc_analysis_sessions s
                       where s.user_id = page.id::text
                   ) as session_count
            from page
            order by created_at desc, id
        """,
            (search, search, limit, offset, admin_id),
        ).fetchall()
    return {"users": users, "total": totals["total"]}


@router.get("/activity/sessions")
def list_activity(
    user: Admin,
    user_id: Annotated[str | None, Query(min_length=1, max_length=255)] = None,
    limit: PageSize = 15,
    offset: Offset = 0,
):
    with database() as db:
        totals = db.execute(
            """
            select count(*) as total
            from public.bc_analysis_sessions
            where %s::text is null or user_id = %s
        """,
            (user_id, user_id),
        ).fetchone()
        sessions = db.execute(
            """
            with page as (
                select id, user_id, user_email, kind, created_at, filename, sample_count, kernels,
                       case when kind = 'batch' then details ? 'labels' else false end as has_labels
                from public.bc_analysis_sessions
                where %s::text is null or user_id = %s
                order by created_at desc, id desc
                limit %s offset %s
            )
            select page.*,
                   coalesce(nullif(a.full_name, ''), a.email, nullif(page.user_email, '')) as full_name
            from page
            left join breastcare_private.accounts a on a.id::text = page.user_id
            order by page.created_at desc, page.id desc
        """,
            (user_id, user_id, limit, offset),
        ).fetchall()
    return {"sessions": sessions, "total": totals["total"]}
