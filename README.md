# About
This repository contains the files I used to create a Google cloud based REST API. The REST API is an MVP version of a rental equipment tracking API. Three types of entities are stored in a cloud based non-relational db (datastore):
1) Users (customers)
2) Rentals (agreements between customers and the store)
3) Gear (gear available at the store)

Relationships exist among the different entities. These relationships, as well as the methods allowed within the API, are explained in the peiffer_project.pdf file, which is located in the project_details.zip file. The store and customers would use the API to make reservations and track gear. 

## Testing
Tests for the various API endpoints were created in Postman. The tests have been exported as a Postman collection and are located in the project_details.zip file. This file can be uploaded to Postman for easier viewing. 

### Running Postman Test Collection
### THIS IS NO LONGER POSSIBLE - THE PROJECT HAS BEEN REMOVED FROM GCLOUD

#### 1.) Create 2 User Accounts
Create 2 user accounts by visiting the "/login" endpoint and logging in through Google.

#### 2.) Copy JWT and User ID
Copy the JWT provided on the "login_success" page for user 1 into jwt_1_id. Copy the user ID into user_1_id. Do the same for the user 2 counterpart.

#### 3.) Run and Enjoy
