from time import sleep
from . import config_celery_app, CeleryWithConfig
from jobtastic import JobtasticTask

class RandomProgress(JobtasticTask, CeleryWithConfig):

    # Must be there
    significant_kwargs = []

    # The max timeout of a task, in case it crashes
    herd_avoidance_timeout = 300  # 5 min

    default_value = 100

    def calculate_result(self, **kwargs):
        freq = 10
        total_count = 100
        i = 0
        for j in range(0, total_count):
            i += j
            self.update_progress(i, total_count, update_frequency=freq)
            sleep(0.5)
        return i

# broker specified
export_celery_app = RandomProgress('celery_tasks.exports')


def includeme(config):
    config_celery_app(export_celery_app, config.registry.settings)
