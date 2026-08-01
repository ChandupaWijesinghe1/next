import json

import logging



from core.database import SessionLocal

from services.background_job_service import (

    mark_job_completed,

    mark_job_running,

)

from services.report_service import build_project_report, save_project_report

from workers.retry import handle_job_retry



logger = logging.getLogger(__name__)





async def ping_task(ctx: dict, message: str = "pong") -> str:

    await ctx["redis"].set("worker:last_ping", message, ex=3600)

    return message





async def send_notification_email(

    ctx: dict,

    user_email: str,

    subject: str,

    body: str,

) -> None:

    job_id = ctx["job_id"]

    db = SessionLocal()

    try:

        if ctx["job_try"] == 1:

            mark_job_running(db, job_id)



        logger.info(

            "Simulated email | to=%s subject=%s body=%s",

            user_email,

            subject,

            body,

        )

        print(

            "[send_notification_email]",

            f"job_id={job_id!r}",

            f"to={user_email!r}",

            f"subject={subject!r}",

            f"body={body!r}",

            sep=" ",

        )

        result = f"Simulated email sent to {user_email}"

        mark_job_completed(db, job_id, result=result)

    except Exception as exc:

        handle_job_retry(ctx, db, job_id, "send_notification_email", exc)

    finally:

        db.close()





async def generate_project_report(ctx: dict, project_id: int) -> None:

    job_id = ctx["job_id"]

    db = SessionLocal()

    try:

        if ctx["job_try"] == 1:

            mark_job_running(db, job_id)



        report = build_project_report(db, project_id)

        paths = save_project_report(report, project_id, job_id)

        result = json.dumps(

            {

                "report_paths": paths,

                "project_id": project_id,

                "summary": report["summary"],

            }

        )

        logger.info(

            "Project report generated | project_id=%s json=%s",

            project_id,

            paths["json_path"],

        )

        print(

            "[generate_project_report]",

            f"job_id={job_id!r}",

            f"project_id={project_id}",

            f"json_path={paths['json_path']!r}",

            sep=" ",

        )

        mark_job_completed(db, job_id, result=result)

    except Exception as exc:

        handle_job_retry(ctx, db, job_id, "generate_project_report", exc)

    finally:

        db.close()

