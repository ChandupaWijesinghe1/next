from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String # things whi=ich use ti=o define the columns of the table
from sqlalchemy.orm import relationship # things which use to define the relationships between the tables   -  like one to many, many to many, etc.

from models.user import Base


class Project(Base): # this is the table name       -   this is a class that inherits from the Base class
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True) # this is the column name    -   this is a column that is an integer and is the primary key and is indexed
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False, index=True)
    # this is the column name    -   this is a column that is a string and is not nullable
    name = Column(String, nullable=False) 
    description = Column(String, nullable=True) # this is the column name    -   this is a column that is a string and is nullable
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False, index=True) # this is the column name    -   this is a column that is an integer and is a foreign key and is not nullable and is indexed
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    team = relationship("Team", back_populates="projects")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")
    creator = relationship("User", foreign_keys=[created_by])
