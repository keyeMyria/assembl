"""id_to_uuid_in_extracts

Revision ID: 1f8852d18bbd
Revises: 26449b2a017b
Create Date: 2013-08-15 09:44:26.890569

"""

# revision identifiers, used by Alembic.
revision = '1f8852d18bbd'
down_revision = '26449b2a017b'

from alembic import context, op
import sqlalchemy as sa
import transaction


from assembl import models as m
from assembl.lib import config, types

db = m.DBSession


def upgrade(pyramid_env):
    with context.begin_transaction():
        ### commands auto generated by Alembic - please adjust! ###
        op.drop_column('extract', 'id')
        op.add_column(
            'extract',
            sa.Column('id', types.UUID, primary_key=True))

    # Do stuff with the app's models here.
    with transaction.manager:
        pass


def downgrade(pyramid_env):
    with context.begin_transaction():
        op.drop_column('extract', 'id')
        op.add_column(
            'extract',
            sa.Column('id', sa.Integer, primary_key=True))
