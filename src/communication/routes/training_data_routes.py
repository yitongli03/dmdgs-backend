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
from communication.models.training_data import TrainingData
from communication.models.training_data_check import TrainingDataCheck

router = APIRouter()

import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Create a training_data reference:
@router.post("/", response_description="Create new Training data Reference", status_code=status.HTTP_201_CREATED,
             response_model=TrainingData)
async def create_training_data(db=Depends(connect_to_db), train_data: TrainingData = Body(...)):
    try:
        td_dict = jsonable_encoder(train_data)
        new_td = db["training_data"].insert_one(td_dict)
        created_td = db["training_data"].find_one({"_id": new_td.inserted_id})
        return created_td
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# GET all training data
@router.get("/", response_description="Get all training data", response_model=list[TrainingData])
async def get_all_training_data(db=Depends(connect_to_db)):
    try:
        logger.info("Fetching all training data from the database")
        training_data = []
        query = {}
        cursor = db["training_data"].find(query)
        logger.info("Query executed successfully, processing data")
        for td in cursor:
            training_data.append(td)
        logger.info(f"Fetched {len(training_data)} records from the database")
        return training_data
    except Exception as e:
        logger.error(f"Error occurred while fetching training data: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


# GET a training data reference check:
@router.get("/{training_data_id}/", response_description="Get a single training data", response_model=TrainingData)
async def get_training_data(training_data_id: str, db=Depends(connect_to_db)):
    query = {"_id": training_data_id}
    td = db["training_data"].find_one(query)
    if td:
        return td
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Training data with id: {training_data_id} not found")


# Update a training data by adding a value for training data check:
@router.put("/{training_data_id}/", response_description="Update the trainings data by adding a check",
            response_model=TrainingData)
async def update_training_data_add_check(training_data_id: str, training_data_check: TrainingDataCheck = Body(...),
                                         db=Depends(connect_to_db)):
    try:
        # Find the training data by training_data_id
        query_training_data = {"_id": training_data_id}
        training_data = db["training_data"].find_one(query_training_data)
        if training_data is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training Data not found")

        # Check that training data check in training data is None
        training_data_check_current = training_data["training_data_check"]
        if training_data_check_current is None:
            # Update user with id and add risk assessment to the list of risk assessments
            training_data_check = training_data_check.model_dump()
            db["training_data"].update_one({"_id": training_data_id},
                                           {"$set": {"training_data_check": training_data_check}})
            # Return the updated user
            updated_training_data = db["training_data"].find_one({"_id": training_data_id})
            return updated_training_data

        else:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training Data already contains a check")

    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
