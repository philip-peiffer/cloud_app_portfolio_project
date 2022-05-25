// error messages below are split out by status code
const errorMessages = {
    404: {badKeys: {"Error": "Request object keys are bad. Check the API doc for required keys."}},
    406: {"Error": "Server will send back JSON data. Accept header indicates you cannot accept this."},
    415: {"Error": "Server can only handle JSON post requests. Please check the request body and content-type header."}
}

module.exports = errorMessages