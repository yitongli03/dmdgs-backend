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
from communication.models.domain import Domain

router = APIRouter()

# Create a domain:
@router.post("/", response_description="Create new domain", status_code=status.HTTP_201_CREATED, response_model=Domain)
async def create_domain(db=Depends(connect_to_db), domain: Domain = Body(...)):
    try:
        domain_dict = jsonable_encoder(domain)
        new_domain = db["domains"].insert_one(domain_dict)
        created_domain = db["domains"].find_one({"_id": new_domain.inserted_id})
        return created_domain
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# GET all domains
@router.get("/", response_description="Get all domains", response_model=list[Domain])
async def get_all_domains(db=Depends(connect_to_db)):
    domains = []
    query = {}
    cursor = db["domains"].find(query)
    for domain in cursor:
        domains.append(domain)
    return domains

# GET a domain:
@router.get("/{domain_id}/", response_description="Get a single domain", response_model=Domain)
async def get_domain(domain_id: str, db=Depends(connect_to_db)):
    query = {"_id": domain_id}
    domain = db["domains"].find_one(query)
    if domain:
        return domain
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User {domain_id} not found")
