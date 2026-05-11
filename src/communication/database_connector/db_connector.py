#
# This file is part of first_version_qmsAIA.
#
# first_version_qmsAIA is free software: you can redistribute it and/or modify it
# under the terms of the GNU Lesser General Public License as published by the
# Free Software Foundation, either version 3 of the License, or (at your
# option) any later version.
#
# social_network_miner_compliance_check is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
# FOR A PARTICULAR PURPOSE.  See the GNU Lesser General Public License for more
# details.
#
# You should have received a copy of the GNU Lesser General Public License
# along with first_version_qmsAIA (file COPYING in the main directory). If not, see
# http://www.gnu.org/licenses/.

import os
import certifi
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

_client = None
_db = None

def get_database():
    global _client, _db

    if _db is None:
        atlas_uri = os.getenv("ATLAS_URI")
        db_name = os.getenv("DB_NAME")

        _client = MongoClient(
            atlas_uri,
            tls=True,
            tlsCAFile=certifi.where()
        )
        _client.admin.command("ping")
        print("Connected to MongoDB successfully.")

        _db = _client[db_name]

    return _db


def close_database():
    global _client, _db

    if _client is not None:
        _client.close()
        _client = None
        _db = None