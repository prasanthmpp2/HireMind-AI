"""Small, versioned additive migrations for this SQLAlchemy-only app.

When the project adopts Alembic, these revisions can be ported directly. This
runner deliberately never rebuilds or drops business tables.
"""

from sqlalchemy import Column, Integer, MetaData, String, Table, inspect, text

_metadata = MetaData()
_revisions = Table(
    "schema_migrations",
    _metadata,
    Column("revision", String(100), primary_key=True),
)


def upgrade_auth_ownership(engine):
    """Add nullable owner fields and invalidate old dev-only resume tokens."""
    _metadata.create_all(engine, tables=[_revisions], checkfirst=True)
    revision = "20261020_auth_tenant_ownership"
    with engine.begin() as connection:
        if connection.execute(_revisions.select().where(_revisions.c.revision == revision)).first():
            return
        inspector = inspect(connection)
        additions = {
            "candidates": {
                "user_id": "INTEGER REFERENCES users(id) ON DELETE SET NULL",
                "created_by_user_id": "INTEGER REFERENCES users(id) ON DELETE SET NULL",
            },
            "job_descriptions": {"user_id": "INTEGER REFERENCES users(id) ON DELETE SET NULL"},
        }
        tables = set(inspector.get_table_names())
        for table, columns in additions.items():
            if table not in tables:
                continue
            existing = {column["name"] for column in inspector.get_columns(table)}
            for column, definition in columns.items():
                if column not in existing:
                    connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {definition}"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_candidates_user_id ON candidates(user_id)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_candidates_created_by_user_id ON candidates(created_by_user_id)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_job_descriptions_user_id ON job_descriptions(user_id)"))
        connection.execute(text("DELETE FROM candidate_ownership"))
        connection.execute(_revisions.insert().values(revision=revision))
