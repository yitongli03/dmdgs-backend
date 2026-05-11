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
from communication.models.language_model import LanguageModel

router = APIRouter()


# Create a Language Model:
@router.post("/", response_description="Create a new language model", status_code=status.HTTP_201_CREATED,
             response_model=LanguageModel)
async def create_llm(db=Depends(connect_to_db), llm: LanguageModel = Body(...)):
    try:
        llm_dict = jsonable_encoder(llm)
        new_llm = db["language_models"].insert_one(llm_dict)
        created_llm = db["language_models"].find_one({"_id": new_llm.inserted_id})
        return created_llm
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# GET all Language Models
@router.get("/", response_description="Get all language models", response_model=list[LanguageModel])
async def get_all_llms(db=Depends(connect_to_db)):
    llms = []
    query = {}
    cursor = db["language_models"].find(query)
    for llm in cursor:
        llms.append(llm)
    return llms


# GET a User:
@router.get("/{llm_id}/", response_description="Get a single language model", response_model=LanguageModel)
async def get_llm(llm_id: str, db=Depends(connect_to_db)):
    query = {"_id": llm_id}
    llm = db["language_models"].find_one(query)
    if llm:
        return llm
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Language model with {llm_id} not found")
