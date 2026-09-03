"""Shared short critical section; never hold these locks across network IO.

All onboarding/feed writes acquire the same transaction advisory lock first.
Rows are then locked control -> organization -> domain -> rights -> feed -> run.
The deliberately coarse advisory lock favors auditable correctness for this pilot.
"""

from functools import wraps

from sqlalchemy import event, select, text
from sqlalchemy.orm import Session

from nuzenio_api.models import (
    FeedControl,
    PublisherDomain,
    PublisherOrganization,
    RightsPolicy,
    SourceFeed,
)


def control_lock(session):
    session.execute(text("SELECT pg_advisory_xact_lock(739204)"))
    session.info["controls_locked"] = True


def serialized_controls(function):
    @wraps(function)
    def wrapped(session, *args, **kwargs):
        control_lock(session)
        session.expire_all()
        return function(session, *args, **kwargs)

    return wrapped


def locked_feed(session, feed_id):
    control_lock(session)
    session.flush()
    session.expire_all()
    session.scalar(select(FeedControl).where(FeedControl.id == 1).with_for_update())
    identifiers = session.execute(
        select(SourceFeed.organization_id, SourceFeed.domain_id, SourceFeed.rights_policy_id).where(
            SourceFeed.id == feed_id
        )
    ).first()
    if not identifiers:
        return None
    for model, key in [
        (PublisherOrganization, identifiers.organization_id),
        (PublisherDomain, identifiers.domain_id),
        (RightsPolicy, identifiers.rights_policy_id),
    ]:
        session.scalar(select(model).where(model.id == key).with_for_update())
    return session.scalar(select(SourceFeed).where(SourceFeed.id == feed_id).with_for_update())


def approval_versions(session, feed):
    control = session.get(FeedControl, 1)
    domain = session.get(PublisherDomain, feed.domain_id)
    return (
        control.version,
        feed.organization.version,
        domain.version if domain else None,
        feed.rights_policy.version,
        feed.version,
    )


@event.listens_for(Session, "before_commit")
def cancel_disallowed_pending_work(session):
    # Run within the SAME transaction as every serialized control mutation.
    if not session.info.pop("controls_locked", False):
        return
    from nuzenio_api.feed_operations import rights_issues
    from nuzenio_api.models import FeedRun, FeedRunState

    session.flush()
    for run in session.scalars(
        select(FeedRun).where(FeedRun.state.in_([FeedRunState.QUEUED, FeedRunState.RETRYING]))
    ):
        if rights_issues(session, session.get(SourceFeed, run.feed_id)):
            run.state = FeedRunState.SKIPPED
            run.error_code = "approval_revoked"
