"""Reset all story content from the database.

Usage:
    cd backend
    python reset_db.py

Deletes all rows from: graph_edges, graph_nodes, nodes, scenes, characters, stories.
The schema (tables) is preserved.
"""
from database import engine
from sqlalchemy import text


def reset():
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM graph_edges"))
        conn.execute(text("DELETE FROM graph_nodes"))
        conn.execute(text("DELETE FROM nodes"))
        conn.execute(text("DELETE FROM scenes"))
        conn.execute(text("DELETE FROM characters"))
        conn.execute(text("DELETE FROM stories"))
    print("Database reset: all stories, scenes, nodes, graph_nodes, graph_edges deleted.")


if __name__ == "__main__":
    reset()
