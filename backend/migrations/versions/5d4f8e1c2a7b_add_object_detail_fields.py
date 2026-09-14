"""add Phase D object detail fields

Revision ID: 5d4f8e1c2a7b
Revises: 3fdc51e14691
"""
from alembic import op
import sqlalchemy as sa


revision = '5d4f8e1c2a7b'
down_revision = '3fdc51e14691'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('objects', schema=None) as batch_op:
        batch_op.add_column(sa.Column('local_name', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('common_name', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('scientific_name', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('significance', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('facts', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('images', sa.JSON(), nullable=True))


def downgrade():
    with op.batch_alter_table('objects', schema=None) as batch_op:
        batch_op.drop_column('images')
        batch_op.drop_column('facts')
        batch_op.drop_column('significance')
        batch_op.drop_column('scientific_name')
        batch_op.drop_column('common_name')
        batch_op.drop_column('local_name')