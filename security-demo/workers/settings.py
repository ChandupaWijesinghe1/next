from core.arq import get_arq_redis_settings
from core.config import settings
from workers.tasks import generate_project_report, ping_task, send_notification_email


class WorkerSettings:
    functions = [ping_task, send_notification_email, generate_project_report]
    redis_settings = get_arq_redis_settings()
    queue_name = settings.arq_queue_name
    max_jobs = settings.arq_max_jobs
    max_tries = 4
