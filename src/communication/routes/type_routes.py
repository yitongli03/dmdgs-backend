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

from fastapi import APIRouter, Body, Depends, HTTPException, status
from fastapi.encoders import jsonable_encoder

from communication.database_connector.db_connector import connect_to_db
from communication.models.type import Type

router = APIRouter()


# Create a type:
@router.post("/", response_description="Create new type", status_code=status.HTTP_201_CREATED, response_model=Type)
async def create_type(db=Depends(connect_to_db), type: Type = Body(...)):
    try:
        type_dict = jsonable_encoder(type)
        new_type = db["types"].insert_one(type_dict)
        created_type = db["types"].find_one({"_id": new_type.inserted_id})
        return created_type
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# GET all types
@router.get("/", response_description="Get all types", response_model=list[Type])
async def get_all_types(db=Depends(connect_to_db)):
    types = []
    query = {}
    cursor = db["types"].find(query)
    for type in cursor:
        types.append(type)
    return types


# GET a type:
@router.get("/{type_id}/", response_description="Get a single type", response_model=Type)
async def get_user(type_id: str, db=Depends(connect_to_db)):
    query = {"_id": type_id}
    type = db["types"].find_one(query)
    if type:
        return type
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User {type_id} not found")
