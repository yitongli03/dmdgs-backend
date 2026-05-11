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
from communication.models.training_data_check import TrainingDataCheck

router = APIRouter()


# Create a training_data reference check:
@router.post("/", response_description="Create new Training data reference check", status_code=status.HTTP_201_CREATED,
             response_model=TrainingDataCheck)
async def create_training_data_check(db=Depends(connect_to_db), train_data_check: TrainingDataCheck = Body(...)):
    try:
        tdc_dict = jsonable_encoder(train_data_check)
        new_tdc = db["training_data_checks"].insert_one(tdc_dict)
        created_tdc = db["training_data_checks"].find_one({"_id": new_tdc.inserted_id})
        return created_tdc
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# GET all training data references checks
@router.get("/", response_description="Get all training data references", response_model=list[TrainingDataCheck])
async def get_all_training_data_checks(db=Depends(connect_to_db)):
    training_data_checks = []
    query = {}
    cursor = db["training_data_checks"].find(query)
    for tdc in cursor:
        training_data_checks.append(tdc)
    return training_data_checks


# GET a training data reference check:
@router.get("/{training_data_check_id}/", response_description="Get a single training data reference",
            response_model=TrainingDataCheck)
async def get_training_data_check(training_data_check_id: str, db=Depends(connect_to_db)):
    query = {"_id": training_data_check_id}
    tdc = db["training_data_check"].find_one(query)
    if tdc:
        return tdc
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Training data check with id: {training_data_check_id} not found")
