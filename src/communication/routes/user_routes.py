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

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from fastapi import APIRouter, Body, Depends, HTTPException, status
from fastapi.encoders import jsonable_encoder

from communication.database_connector.db_connector import connect_to_db
from communication.models.user import User
from communication.models.training_data import TrainingData

router = APIRouter()


# Create a User:
@router.post("/", response_description="Create a new user", status_code=status.HTTP_201_CREATED, response_model=User)
async def create_user(db=Depends(connect_to_db), user: User = Body(...)):
    try:
        user_dict = jsonable_encoder(user)
        user = db["users"].find_one({"_id": user_dict['_id']})
        if not user:
            new_user = db["users"].insert_one(user_dict)
            created_user = db["users"].find_one({"_id": new_user.inserted_id})
            return created_user
        else:
            return user
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# GET all users
@router.get("/", response_description="Get all users", response_model=list[User])
async def get_all_users(db=Depends(connect_to_db)):
    users = []
    query = {}
    cursor = db["users"].find(query)
    for user in cursor:
        users.append(user)
    return users


# GET a User:
@router.get("/{user_id}/", response_description="Get a single user", response_model=User)
async def get_user(user_id: str, db=Depends(connect_to_db)):
    query = {"_id": user_id}
    user = db["users"].find_one(query)
    if user:
        return user
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User {user_id} not found")


# GET all training data for user with user id:
@router.get("/{user_id}/training_data/", response_description="Get all training data stored in the user",
            response_model=list[TrainingData])
async def get_all_training_data_of_user(user_id: str, db=Depends(connect_to_db)):
    try:
        # Get user with id
        query = {"_id": user_id}
        user = db["users"].find_one(query)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User {user_id} not found")

        # Get list of risk assessments:
        training_data_ids = user['training_data']
        if not training_data_ids:
            return []
        else:
            training_data_list = []
            for training_data_id in training_data_ids:
                query = {"_id": training_data_id}
                training_data = db["training_data"].find_one(query)
                if training_data is not None:
                    training_data_list.append(training_data)
            return training_data_list
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# Update a User by adding a value for training data:
@router.put("/{user_id}/", response_description="Update a user by adding a value for risk assessment",
            response_model=User)
async def update_user_add_training_data(user_id: str, training_data_id: str = Body(...), db=Depends(connect_to_db)):
    try:
        # Find the user by user_id
        query_user = {"_id": user_id}
        user = db["users"].find_one(query_user)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        # Check that training_data wit id exist
        query_training_data = {"_id": training_data_id}
        training_data = db["training_data"].find_one(query_training_data)
        if training_data is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training Data does not exist")

        # Check hat training_data is not added to list yet
        training_data = user["training_data"]
        if training_data_id in training_data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail="Training Data is already in the list of the user")

        # Update user with id and add risk assessment to the list of risk assessments
        db["users"].update_one({"_id": user_id}, {"$push": {"training_data": training_data_id}})

        # Return the updated user
        updated_user = db["users"].find_one({"_id": user_id})

        return updated_user
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
