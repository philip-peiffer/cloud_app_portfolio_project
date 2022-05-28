// error messages below are split out by status code
const errorMessages = {
    400: {badKeys: {"Error": "Request object keys are bad. Check the API doc for required keys."}, gearNotFree: {"Error": "This gear is already rented."}, gearRentalNotRelated: {"Error": "The gear is not on this rental"}},
    401: {"Error": "The request requires a JWT but is either not provided or is invalid."},
    403: {"Error": "JWT provided does not match user of this rental"},
    404: {rentals: {"Error": "This rental does not exist."}, gear: {"Error": "This gear does not exist."}},
    406: {"Error": "Server will send back JSON data. Accept header indicates you cannot accept this."},
    415: {"Error": "Server can only handle JSON post, put, and patch requests. Please check the request body and content-type header."}
}

module.exports = errorMessages