import json
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from core.config import settings
from core.exceptions import NotFoundError
from models.comment import Comment
from models.project import Project
from models.task import Task
from models.team import TeamMember
from models.user import User

COMPLETED_STATUSES = {"done", "completed"}
OVERDUE_DAYS = 7
RECENT_ACTIVITY_DAYS = 7


def _ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _serialize_task(task: Task) -> dict:
    return {
        "id": task.id,
        "title": task.title,
        "status": task.status,
        "assigned_to": task.assigned_to,
        "created_at": _ensure_utc(task.created_at).isoformat(),
        "updated_at": _ensure_utc(task.updated_at).isoformat(),
    }


def _serialize_comment(comment: Comment, task: Task) -> dict:
    return {
        "id": comment.id,
        "task_id": task.id,
        "task_title": task.title,
        "body": comment.body,
        "created_by": comment.created_by,
        "created_at": _ensure_utc(comment.created_at).isoformat(),
    }


def build_project_report(db: Session, project_id: int) -> dict:
    project = db.query(Project).filter(Project.id == project_id).first()
    if project is None:
        raise NotFoundError("Project not found")

    now = datetime.now(timezone.utc)
    overdue_cutoff = now - timedelta(days=OVERDUE_DAYS)
    recent_cutoff = now - timedelta(days=RECENT_ACTIVITY_DAYS)

    tasks = db.query(Task).filter(Task.project_id == project_id).all()
    status_counts = dict(Counter(task.status for task in tasks))

    overdue_tasks = [
        _serialize_task(task)
        for task in tasks
        if task.status.lower() not in COMPLETED_STATUSES
        and _ensure_utc(task.updated_at) < overdue_cutoff
    ]

    recent_tasks = [
        _serialize_task(task)
        for task in tasks
        if _ensure_utc(task.updated_at) >= recent_cutoff
    ]

    recent_comments = [
        _serialize_comment(comment, task)
        for comment, task in (
            db.query(Comment, Task)
            .join(Task, Comment.task_id == Task.id)
            .filter(Task.project_id == project_id, Comment.created_at >= recent_cutoff)
            .order_by(Comment.created_at.desc())
            .all()
        )
    ]

    members = db.query(TeamMember).filter(TeamMember.team_id == project.team_id).all()
    workload: dict[str, int] = {}
    for member in members:
        user = db.query(User).filter(User.id == member.user_id).first()
        if user is None:
            continue
        label = user.full_name or user.email
        workload[label] = sum(1 for task in tasks if task.assigned_to == user.id)
    workload["unassigned"] = sum(1 for task in tasks if task.assigned_to is None)

    return {
        "project_id": project.id,
        "project_name": project.name,
        "team_id": project.team_id,
        "generated_at": now.isoformat(),
        "task_counts_by_status": status_counts,
        "overdue_tasks": overdue_tasks,
        "recent_activity": {
            "tasks": recent_tasks,
            "comments": recent_comments,
        },
        "team_member_workload": workload,
        "summary": {
            "total_tasks": len(tasks),
            "overdue_count": len(overdue_tasks),
            "recent_task_updates": len(recent_tasks),
            "recent_comments": len(recent_comments),
        },
    }


def _report_to_markdown(report: dict) -> str:
    lines = [
        f"# Project Report: {report['project_name']}",
        "",
        f"- **Project ID:** {report['project_id']}",
        f"- **Team ID:** {report['team_id']}",
        f"- **Generated at:** {report['generated_at']}",
        "",
        "## Task counts by status",
        "",
    ]

    for status, count in sorted(report["task_counts_by_status"].items()):
        lines.append(f"- **{status}:** {count}")

    lines.extend(["", "## Overdue tasks", ""])
    if report["overdue_tasks"]:
        for task in report["overdue_tasks"]:
            lines.append(
                f"- #{task['id']} {task['title']} ({task['status']}, updated {task['updated_at']})"
            )
    else:
        lines.append("- None")

    lines.extend(["", "## Recent activity", "", "### Task updates", ""])
    if report["recent_activity"]["tasks"]:
        for task in report["recent_activity"]["tasks"]:
            lines.append(f"- #{task['id']} {task['title']} ({task['status']})")
    else:
        lines.append("- None")

    lines.extend(["", "### Comments", ""])
    if report["recent_activity"]["comments"]:
        for comment in report["recent_activity"]["comments"]:
            lines.append(
                f"- Task #{comment['task_id']} ({comment['task_title']}): {comment['body']}"
            )
    else:
        lines.append("- None")

    lines.extend(["", "## Team member workload", ""])
    for member, count in sorted(report["team_member_workload"].items()):
        lines.append(f"- **{member}:** {count}")

    lines.extend(["", "## Summary", ""])
    for key, value in report["summary"].items():
        lines.append(f"- **{key.replace('_', ' ').title()}:** {value}")

    return "\n".join(lines) + "\n"


def save_project_report(report: dict, project_id: int, job_id: str) -> dict[str, str]:
    project_dir = Path(settings.reports_dir) / f"project_{project_id}"
    project_dir.mkdir(parents=True, exist_ok=True)

    json_path = project_dir / f"{job_id}.json"
    markdown_path = project_dir / f"{job_id}.md"

    json_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    markdown_path.write_text(_report_to_markdown(report), encoding="utf-8")

    return {
        "json_path": str(json_path.as_posix()),
        "markdown_path": str(markdown_path.as_posix()),
    }
