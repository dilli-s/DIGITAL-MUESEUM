"""add_virtual_tour_models

Revision ID: 24b2c06bb96e
Revises: 5d4f8e1c2a7b
Create Date: 2026-09-21 19:59:09.351726

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '24b2c06bb96e'
down_revision = '5d4f8e1c2a7b'
branch_labels = None
depends_on = None


def upgrade():
    # ── Create tour_nodes table ──────────────────────────────────────────────
    op.create_table('tour_nodes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('museum_id', sa.Integer(), nullable=False),
        sa.Column('gallery_id', sa.Integer(), nullable=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('panorama_url', sa.Text(), nullable=True),
        sa.Column('tile_status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('tile_base_url', sa.Text(), nullable=True),
        sa.Column('tile_config', sa.JSON(), nullable=True),
        sa.Column('compass_bearing_ref', sa.Float(), nullable=True),
        sa.Column('pos_x', sa.Float(), nullable=True),
        sa.Column('pos_y', sa.Float(), nullable=True),
        sa.Column('is_start', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['gallery_id'], ['galleries.id']),
        sa.ForeignKeyConstraint(['museum_id'], ['museums.id']),
        sa.PrimaryKeyConstraint('id')
    )

    # ── Create tour_edges table ──────────────────────────────────────────────
    op.create_table('tour_edges',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('museum_id', sa.Integer(), nullable=False),
        sa.Column('source_node_id', sa.Integer(), nullable=False),
        sa.Column('target_node_id', sa.Integer(), nullable=False),
        sa.Column('yaw', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('pitch', sa.Float(), nullable=False, server_default='-45.0'),
        sa.Column('facing_yaw', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('target_entry_yaw', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('label', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['museum_id'], ['museums.id']),
        sa.ForeignKeyConstraint(['source_node_id'], ['tour_nodes.id']),
        sa.ForeignKeyConstraint(['target_node_id'], ['tour_nodes.id']),
        sa.PrimaryKeyConstraint('id')
    )

    # ── Add virtual-tour columns to objects table ────────────────────────────
    with op.batch_alter_table('objects', schema=None) as batch_op:
        batch_op.add_column(sa.Column('tour_node_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('tour_yaw', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('tour_pitch', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('angle_photos', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('materials', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('dimensions', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('provenance', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('custom_fields', sa.JSON(), nullable=True))
        batch_op.create_foreign_key(
            'fk_objects_tour_node_id',
            'tour_nodes',
            ['tour_node_id'],
            ['id'],
            ondelete='SET NULL'
        )


def downgrade():
    with op.batch_alter_table('objects', schema=None) as batch_op:
        batch_op.drop_constraint('fk_objects_tour_node_id', type_='foreignkey')
        batch_op.drop_column('custom_fields')
        batch_op.drop_column('provenance')
        batch_op.drop_column('dimensions')
        batch_op.drop_column('materials')
        batch_op.drop_column('angle_photos')
        batch_op.drop_column('tour_pitch')
        batch_op.drop_column('tour_yaw')
        batch_op.drop_column('tour_node_id')

    op.drop_table('tour_edges')
    op.drop_table('tour_nodes')
