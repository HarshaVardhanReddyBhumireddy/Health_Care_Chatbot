from pymongo import MongoClient
from pymongo.server_api import ServerApi
import os
from backend.logger import get_logger

logger = get_logger("Database")

class Database:
    _db = None

    @classmethod
    def get_db(cls):
        if cls._db is None:
            try:
                uri = os.getenv("MONGO_URI")
                db_name = os.getenv("MONGO_DB_NAME")

                if not uri:
                    raise ValueError("MONGO_URI is not set in environment variables")
                if not db_name:
                    raise ValueError("MONGO_DB_NAME is not set in environment variables")

                logger.info("Connecting to MongoDB")
                logger.info(f"Using MongoDB database: {db_name}")

                client = MongoClient(uri, server_api=ServerApi("1"))
                client.admin.command("ping")

                cls._db = client[db_name]
                logger.info("MongoDB connection successful")

            except Exception as e:
                logger.error(f"MongoDB connection failed: {type(e).__name__}: {str(e)}", exc_info=True)
                raise

        return cls._db
